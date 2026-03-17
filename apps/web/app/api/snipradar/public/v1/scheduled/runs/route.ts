export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  authenticateSnipRadarApiRequest,
  buildSnipRadarPlatformHeaders,
} from "@/lib/snipradar/public-api";

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export async function GET(request: NextRequest) {
  const auth = await authenticateSnipRadarApiRequest(request, ["scheduler:read"]);
  if (!auth.ok) return auth.response;

  try {
    const limit = clamp(Number(request.nextUrl.searchParams.get("limit") ?? 20), 1, 100, 20);
    const windowHours = clamp(
      Number(request.nextUrl.searchParams.get("windowHours") ?? 48),
      1,
      168,
      48
    );
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [runs, sourceBreakdown] = await Promise.all([
      prisma.xSchedulerRun.findMany({
        where: { userId: auth.context.userId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.xSchedulerRun.groupBy({
        by: ["source", "status"],
        where: { userId: auth.context.userId, createdAt: { gte: windowStart } },
        _count: { _all: true },
      }),
    ]);

    return NextResponse.json(
      {
        runs: runs.map((run) => ({
          id: run.id,
          source: run.source,
          status: run.status,
          attempted: run.attempted,
          posted: run.posted,
          failed: run.failed,
          skipped: run.skipped,
          lockAcquired: run.lockAcquired,
          durationMs: run.durationMs,
          errorSummary: run.errorSummary,
          failureReasons: run.failureReasons,
          createdAt: run.createdAt.toISOString(),
        })),
        sourceBreakdown: sourceBreakdown.map((row) => ({
          source: row.source,
          status: row.status,
          count: row._count._all,
        })),
      },
      { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] Scheduler runs error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load scheduler runs" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}
