export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runSnipRadarMaintenance } from "@/lib/snipradar/maintenance";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import { isDbPoolSaturationError } from "@/lib/snipradar/db-resilience";
import { extractMachineSecret, timingSafeSecretEqual } from "@/lib/snipradar/request-guards";

function isAuthorizedMachineCall(req: NextRequest): boolean {
  const secret = process.env.SNIPRADAR_MAINTENANCE_CRON_SECRET;
  if (!secret) return false;
  return timingSafeSecretEqual(extractMachineSecret(req), secret);
}

/**
 * POST /api/snipradar/maintenance/repair
 * - User call: repairs current user's SnipRadar data only.
 * - Machine call (secret): can run global maintenance, optional ?userId=...
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const machineCall = isAuthorizedMachineCall(req);
    const user = machineCall ? null : await getCurrentUser();
    const respond = (
      body: unknown,
      status = 200,
      meta?: Record<string, unknown>
    ) => {
      const response = NextResponse.json(body, { status });
      attachServerTiming(response, "snipradar_maintenance_repair", startedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/maintenance/repair",
        method: "POST",
        status,
        durationMs: Date.now() - startedAt,
        userId: user?.id,
        meta,
      });
      return response;
    };

    if (!machineCall && !user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const params = req.nextUrl.searchParams;
    const userId = machineCall ? params.get("userId") ?? undefined : user!.id;
    const metricsLimit = Number(params.get("metricsLimit") ?? 100);
    const metricsConcurrency = Number(params.get("metricsConcurrency") ?? 4);

    const result = await runSnipRadarMaintenance({
      userId,
      metricsLimit: Number.isFinite(metricsLimit) ? metricsLimit : 100,
      metricsConcurrency: Number.isFinite(metricsConcurrency) ? metricsConcurrency : 4,
    });

    return respond(result);
  } catch (error) {
    console.error("[SnipRadar Maintenance] repair error:", error);
    if (isDbPoolSaturationError(error)) {
      const response = NextResponse.json({
        scannedDrafts: 0,
        repairedDrafts: 0,
        failedDraftRepairs: 0,
        cleanedSchedulerRuns: 0,
        cleanedEngagementRows: 0,
        durationMs: Date.now() - startedAt,
        degraded: true,
      });
      attachServerTiming(response, "snipradar_maintenance_repair", startedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/maintenance/repair",
        method: "POST",
        status: 200,
        durationMs: Date.now() - startedAt,
        meta: { cache: "degraded-fallback", error: "DB_POOL_SATURATED", degraded: true },
      });
      return response;
    }
    const response = NextResponse.json(
      { error: "Failed to run maintenance repair" },
      { status: 500 }
    );
    attachServerTiming(response, "snipradar_maintenance_repair", startedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/maintenance/repair",
      method: "POST",
      status: 500,
      durationMs: Date.now() - startedAt,
      meta: { error: "POST_FAILED" },
    });
    return response;
  }
}
