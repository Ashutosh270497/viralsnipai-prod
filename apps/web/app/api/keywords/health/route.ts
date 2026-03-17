export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKeywordSearchQueue } from "@/lib/keywords/search-queue";
import { getKeywordRuntimeMetricsCollector } from "@/lib/keywords/runtime-metrics";

/**
 * GET /api/keywords/health
 * Lightweight runtime health for Keyword Research APIs.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      unauthorized.headers.set("Cache-Control", "no-store");
      unauthorized.headers.set("Server-Timing", `keywords_health;dur=${Date.now() - startedAt}`);
      return unauthorized;
    }

    const queue = getKeywordSearchQueue();
    const metrics = getKeywordRuntimeMetricsCollector();
    const queueStats = queue.getStats();
    const runtimeSummary = metrics.getSummary();

    const payload = {
      status:
        runtimeSummary.slo.latencyMet && runtimeSummary.slo.errorRateMet ? "healthy" : "degraded",
      slo: runtimeSummary.slo,
      runtime: runtimeSummary,
      queue: queueStats,
    };

    const response = NextResponse.json(payload);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Server-Timing", `keywords_health;dur=${Date.now() - startedAt}`);
    return response;
  } catch (error) {
    console.error("[Keywords Health] GET error:", error);
    const response = NextResponse.json(
      { error: "Failed to fetch keyword health" },
      { status: 500 },
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Server-Timing", `keywords_health;dur=${Date.now() - startedAt}`);
    return response;
  }
}
