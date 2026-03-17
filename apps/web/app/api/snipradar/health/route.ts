export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import { isDbPoolSaturationError } from "@/lib/snipradar/db-resilience";
import { HAS_OPENROUTER_KEY } from "@/lib/openrouter-client";

const healthCache = new Map<string, { data: unknown; expiresAt: number }>();
const HEALTH_CACHE_TTL_MS = 10_000;

/**
 * GET /api/snipradar/health
 * Lightweight health snapshot for analytics page.
 */
export async function GET() {
  const requestStartedAt = Date.now();
  let cacheKey = "";
  try {
    const user = await getCurrentUser();
    const respond = (
      body: unknown,
      status = 200,
      meta?: Record<string, unknown>
    ) => {
      const response = NextResponse.json(body, { status });
      attachServerTiming(response, "snipradar_health", requestStartedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/health",
        method: "GET",
        status,
        durationMs: Date.now() - requestStartedAt,
        userId: user?.id,
        meta,
      });
      return response;
    };

    if (!user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    cacheKey = user.id;
    const cached = healthCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return respond(cached.data, 200, { cache: "hit" });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [xAccount, recentRuns, opportunityGrouped, staleOpportunities, scheduledCount] =
      await Promise.all([
        prisma.xAccount.findFirst({
          where: { userId: user.id, isActive: true },
          select: { id: true },
        }),
        prisma.xSchedulerRun.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            status: true,
            durationMs: true,
            createdAt: true,
            failed: true,
          },
        }),
        prisma.xEngagementOpportunity.groupBy({
          by: ["status"],
          where: { userId: user.id },
          _count: { _all: true },
        }),
        prisma.xEngagementOpportunity.count({
          where: { userId: user.id, lastSeenAt: { lt: twentyFourHoursAgo } },
        }),
        prisma.tweetDraft.count({
          where: { userId: user.id, status: "scheduled" },
        }),
      ]);

    const successfulRunStatuses = new Set(["success", "partial", "empty"]);
    const consideredRuns = recentRuns.filter((run) => run.status !== "locked");
    const successfulRuns = consideredRuns.filter((run) =>
      successfulRunStatuses.has(run.status)
    ).length;
    const failedRuns = consideredRuns.filter((run) => run.status === "failed").length;
    const avgDurationMs =
      consideredRuns.length > 0
        ? Math.round(
            consideredRuns.reduce((sum, run) => sum + (run.durationMs ?? 0), 0) /
              consideredRuns.length
          )
        : 0;

    let consecutiveFailures = 0;
    for (const run of recentRuns) {
      if (run.status === "failed") {
        consecutiveFailures += 1;
      } else {
        break;
      }
    }

    const counts = {
      all: opportunityGrouped.reduce((sum, g) => sum + g._count._all, 0),
      new: opportunityGrouped.find((g) => g.status === "new")?._count._all ?? 0,
      saved: opportunityGrouped.find((g) => g.status === "saved")?._count._all ?? 0,
      replied: opportunityGrouped.find((g) => g.status === "replied")?._count._all ?? 0,
      ignored: opportunityGrouped.find((g) => g.status === "ignored")?._count._all ?? 0,
    };

    const schedulerSuccessRate =
      consideredRuns.length > 0 ? Math.round((successfulRuns / consideredRuns.length) * 100) : 100;

    const payload = {
      scheduler: {
        recentRuns: recentRuns.length,
        successfulRuns,
        failedRuns,
        successRatePct: schedulerSuccessRate,
        avgDurationMs,
        consecutiveFailures,
        lastRunAt: recentRuns[0]?.createdAt?.toISOString() ?? null,
      },
      engagement: {
        counts,
        staleCount: staleOpportunities,
      },
      queue: {
        scheduledDrafts: scheduledCount,
      },
      account: {
        connected: Boolean(xAccount),
      },
      ai: {
        openRouterActive: HAS_OPENROUTER_KEY,
        openAiDirectActive: Boolean(process.env.OPENAI_API_KEY),
        provider: HAS_OPENROUTER_KEY ? "openrouter" : Boolean(process.env.OPENAI_API_KEY) ? "openai" : "none",
      },
    };

    healthCache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + HEALTH_CACHE_TTL_MS,
    });

    return respond(payload, 200, { cache: "miss" });
  } catch (error) {
    console.error("[SnipRadar Health] GET error:", error);
    if (cacheKey && isDbPoolSaturationError(error)) {
      const stale = healthCache.get(cacheKey);
      if (stale?.data) {
        const response = NextResponse.json(stale.data);
        attachServerTiming(response, "snipradar_health", requestStartedAt);
        logSnipRadarApiTelemetry({
          route: "/api/snipradar/health",
          method: "GET",
          status: 200,
          durationMs: Date.now() - requestStartedAt,
          meta: { cache: "stale-fallback", degraded: true },
        });
        return response;
      }
      const busy = NextResponse.json({
        scheduler: {
          recentRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          successRatePct: 100,
          avgDurationMs: 0,
          consecutiveFailures: 0,
          lastRunAt: null,
        },
        engagement: {
          counts: { all: 0, new: 0, saved: 0, replied: 0, ignored: 0 },
          staleCount: 0,
        },
        queue: {
          scheduledDrafts: 0,
        },
        account: {
          connected: true,
        },
        degraded: true,
      });
      attachServerTiming(busy, "snipradar_health", requestStartedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/health",
        method: "GET",
        status: 200,
        durationMs: Date.now() - requestStartedAt,
        meta: { cache: "degraded-fallback", error: "DB_POOL_SATURATED", degraded: true },
      });
      return busy;
    }
    const response = NextResponse.json({ error: "Failed to fetch health" }, { status: 500 });
    attachServerTiming(response, "snipradar_health", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/health",
      method: "GET",
      status: 500,
      durationMs: Date.now() - requestStartedAt,
      meta: { error: "GET_FAILED" },
    });
    return response;
  }
}
