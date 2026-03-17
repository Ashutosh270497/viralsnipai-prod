export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { processScheduledDrafts } from "@/lib/snipradar/scheduler";
import { processAutoDmAutomations } from "@/lib/snipradar/auto-dm";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import { withSnipRadarErrorContract } from "@/lib/snipradar/api-errors";

/**
 * POST /api/snipradar/scheduled/process
 * Process due scheduled drafts — posts them to X.
 * Called by client-side polling (every 60s) and also by Inngest cron as backup.
 */
export async function POST() {
  const requestStartedAt = Date.now();
  try {
    const user = await getCurrentUser();
    const respond = (
      body: unknown,
      status = 200,
      meta?: Record<string, unknown>
    ) => {
      const responseBody =
        status >= 400 ? withSnipRadarErrorContract(body, status) : body;
      const response = NextResponse.json(responseBody, { status });
      attachServerTiming(response, "snipradar_scheduler_process", requestStartedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/scheduled/process",
        method: "POST",
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
    const run = await processScheduledDrafts({
      source: "api_user",
      userId: user.id,
      limit: 5,
    });
    const autoDm = await processAutoDmAutomations({
      source: "api_user",
      userId: user.id,
    });
    return respond(
      {
        ...run,
        autoDm,
      },
      200,
      {
        attempted: run.attempted,
        posted: run.posted,
        failed: run.failed,
        autoDmSent: autoDm.sent,
        autoDmFailed: autoDm.failed,
      }
    );
  } catch (error) {
    console.error("[Scheduler] Process error", error);
    const response = NextResponse.json(
      withSnipRadarErrorContract(
        { error: "Failed to process scheduled posts" },
        500
      ),
      { status: 500 }
    );
    attachServerTiming(response, "snipradar_scheduler_process", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/scheduled/process",
      method: "POST",
      status: 500,
      durationMs: Date.now() - requestStartedAt,
      meta: { error: "PROCESS_FAILED" },
    });
    return response;
  }
}
