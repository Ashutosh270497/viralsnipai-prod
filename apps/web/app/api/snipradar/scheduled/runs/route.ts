export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import { withSnipRadarErrorContract } from "@/lib/snipradar/api-errors";
import { isDbPoolSaturationError, withDbPoolRetry } from "@/lib/snipradar/db-resilience";

const RUNS_CACHE_TTL_MS = 8_000;
const runsCache = new Map<string, { data: unknown; expiresAt: number }>();
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_WINDOW_HOURS = 48;
const MAX_WINDOW_HOURS = 168;

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * GET /api/snipradar/scheduled/runs?limit=20
 * Returns recent scheduler runs for the current user.
 */
export async function GET(req: NextRequest) {
  const requestStartedAt = Date.now();
  let cacheKey = "";
  let currentUserId: string | undefined;
  const respond = (
    body: unknown,
    status = 200,
    meta?: Record<string, unknown>
  ) => {
    const responseBody =
      status >= 400 ? withSnipRadarErrorContract(body, status) : body;
    const response = NextResponse.json(responseBody, { status });
    if (responseBody !== body) {
      response.headers.set("X-SnipRadar-Error-Contract", "normalized");
    }
    attachServerTiming(response, "snipradar_scheduler_runs", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/scheduled/runs",
      method: "GET",
      status,
      durationMs: Date.now() - requestStartedAt,
      userId: currentUserId,
      meta,
    });
    return response;
  };

  try {
    const user = await getCurrentUser();
    currentUserId = user?.id;
    if (!user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const limit = clampInt(
      Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT),
      1,
      MAX_LIMIT,
      DEFAULT_LIMIT
    );
    const windowHours = clampInt(
      Number(req.nextUrl.searchParams.get("windowHours") ?? DEFAULT_WINDOW_HOURS),
      1,
      MAX_WINDOW_HOURS,
      DEFAULT_WINDOW_HOURS
    );
    cacheKey = `${user.id}:${limit}:${windowHours}`;
    const cached = runsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return respond(cached.data, 200, { cache: "hit", limit, windowHours });
    }

    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [runs, windowRuns, sourceBreakdownRaw] = await withDbPoolRetry(
      "scheduler-runs.read",
      () =>
        Promise.all([
          prisma.xSchedulerRun.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
              id: true,
              source: true,
              status: true,
              attempted: true,
              posted: true,
              failed: true,
              skipped: true,
              lockAcquired: true,
              durationMs: true,
              errorSummary: true,
              createdAt: true,
            },
          }),
          prisma.xSchedulerRun.findMany({
            where: { userId: user.id, createdAt: { gte: windowStart } },
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
              status: true,
              durationMs: true,
              errorSummary: true,
              failureReasons: true,
            },
          }),
          prisma.xSchedulerRun.groupBy({
            by: ["source"],
            where: { userId: user.id, createdAt: { gte: windowStart } },
            _count: { _all: true },
          }),
        ])
    );

    const totalRuns = windowRuns.length;
    const successRuns = windowRuns.filter((r) => r.status === "success").length;
    const partialRuns = windowRuns.filter((r) => r.status === "partial").length;
    const failedRuns = windowRuns.filter((r) => r.status === "failed").length;
    const lockedRuns = windowRuns.filter((r) => r.status === "locked").length;
    const emptyRuns = windowRuns.filter((r) => r.status === "empty").length;
    const successRatePct =
      totalRuns > 0
        ? Math.round((((successRuns + partialRuns + emptyRuns) / totalRuns) * 100) * 10) / 10
        : 100;
    const failureRatePct =
      totalRuns > 0 ? Math.round(((failedRuns / totalRuns) * 100) * 10) / 10 : 0;
    const avgDurationMs =
      totalRuns > 0
        ? Math.round(
            windowRuns.reduce((sum, run) => sum + (run.durationMs ?? 0), 0) / totalRuns
          )
        : 0;

    const failureReasonCounts = windowRuns.reduce<Record<string, number>>((acc, run) => {
      if (run.status !== "failed" && run.status !== "partial") {
        return acc;
      }
      if (run.failureReasons && typeof run.failureReasons === "object") {
        for (const [reason, count] of Object.entries(
          run.failureReasons as Record<string, unknown>
        )) {
          if (typeof reason !== "string" || !reason.trim()) continue;
          if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) continue;
          const normalizedReason = reason.slice(0, 140);
          acc[normalizedReason] = (acc[normalizedReason] ?? 0) + count;
        }
      } else if (run.errorSummary) {
        const normalizedReason = run.errorSummary.slice(0, 140);
        acc[normalizedReason] = (acc[normalizedReason] ?? 0) + 1;
      }
      return acc;
    }, {});

    const totalFailureReasonCount = Object.values(failureReasonCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    const failureCategories = Object.entries(failureReasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([reason, count]) => ({
        reason,
        count,
        sharePct:
          totalFailureReasonCount > 0
            ? Math.round((count / totalFailureReasonCount) * 100)
            : 0,
      }));

    const sourceBreakdown = sourceBreakdownRaw.map((item) => ({
      source: item.source,
      count: item._count._all,
    }));

    const payload = {
      runs,
      summary: {
        windowHours,
        totalRuns,
        successRuns,
        partialRuns,
        failedRuns,
        lockedRuns,
        emptyRuns,
        successRatePct,
        failureRatePct,
        avgDurationMs,
      },
      failureCategories,
      sourceBreakdown,
      generatedAt: new Date().toISOString(),
    };
    runsCache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + RUNS_CACHE_TTL_MS,
    });
    return respond(payload, 200, { cache: "miss", limit, windowHours });
  } catch (error) {
    console.error("[SnipRadar Scheduled Runs] GET error:", error);
    if (cacheKey && isDbPoolSaturationError(error)) {
      const stale = runsCache.get(cacheKey);
      if (stale?.data) {
        return respond(stale.data, 200, { cache: "stale-fallback", degraded: true });
      }
      return respond(
        {
          runs: [],
          summary: {
            windowHours: DEFAULT_WINDOW_HOURS,
            totalRuns: 0,
            successRuns: 0,
            partialRuns: 0,
            failedRuns: 0,
            lockedRuns: 0,
            emptyRuns: 0,
            successRatePct: 100,
            failureRatePct: 0,
            avgDurationMs: 0,
          },
          failureCategories: [],
          sourceBreakdown: [],
          generatedAt: new Date().toISOString(),
          degraded: true,
        },
        200,
        { cache: "degraded-fallback", error: "DB_POOL_SATURATED", degraded: true }
      );
    }
    return respond({ error: "Failed to fetch scheduler runs" }, 500, { error: "GET_FAILED" });
  }
}
