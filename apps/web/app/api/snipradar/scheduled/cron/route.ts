export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { processScheduledDrafts } from "@/lib/snipradar/scheduler";
import { processAutoDmAutomations } from "@/lib/snipradar/auto-dm";
import { prisma } from "@/lib/prisma";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import { extractMachineSecret, timingSafeSecretEqual } from "@/lib/snipradar/request-guards";

function isAuthorizedCronCall(req: NextRequest): boolean {
  const secret = process.env.SNIPRADAR_SCHEDULER_CRON_SECRET;
  if (!secret) return false;
  return timingSafeSecretEqual(extractMachineSecret(req), secret);
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      // Preserve completion order for summary purposes only
      results.push(await worker(next));
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * POST /api/snipradar/scheduled/cron
 * Secure machine endpoint for cron schedulers (Vercel Cron / external scheduler).
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  if (!isAuthorizedCronCall(req)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    attachServerTiming(response, "snipradar_scheduler_cron", startedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/scheduled/cron",
      method: "POST",
      status: 401,
      durationMs: Date.now() - startedAt,
    });
    return response;
  }

  const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
  const perUserLimit = Math.max(
    5,
    Math.min(100, Number(req.nextUrl.searchParams.get("perUserLimit") ?? 25))
  );

  if (userId) {
    const run = await processScheduledDrafts({
      source: "api_cron",
      userId,
      limit: perUserLimit,
    });
    const autoDm = await processAutoDmAutomations({
      source: "api_cron",
      userId,
    });
    const response = NextResponse.json({ mode: "single_user", run, autoDm });
    attachServerTiming(response, "snipradar_scheduler_cron", startedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/scheduled/cron",
      method: "POST",
      status: 200,
      durationMs: Date.now() - startedAt,
      userId,
      meta: { mode: "single_user", autoDmSent: autoDm.sent, autoDmFailed: autoDm.failed },
    });
    return response;
  }

  const dispatchLimit = Math.max(
    20,
    Math.min(500, Number(req.nextUrl.searchParams.get("dispatchLimit") ?? 200))
  );
  const concurrency = Math.max(
    1,
    Math.min(
      40,
      Number(
        req.nextUrl.searchParams.get("concurrency") ??
          process.env.SNIPRADAR_SCHEDULER_CRON_CONCURRENCY ??
          10
      )
    )
  );
  const [dueUsers, automationUsers] = await Promise.all([
    prisma.tweetDraft.findMany({
      where: {
        status: "scheduled",
        scheduledFor: { lte: new Date() },
      },
      select: { userId: true },
      distinct: ["userId"],
      take: dispatchLimit,
    }),
    prisma.xAutoDmAutomation.findMany({
      where: { isActive: true },
      select: { userId: true },
      distinct: ["userId"],
      take: dispatchLimit,
    }),
  ]);

  const users = Array.from(new Set([...dueUsers, ...automationUsers].map((row) => row.userId))).slice(0, dispatchLimit);
  const runs = await runWithConcurrency(users, concurrency, async (id) => {
    const [schedulerRun, autoDm] = await Promise.all([
      processScheduledDrafts({
        source: "api_cron",
        userId: id,
        limit: perUserLimit,
      }),
      processAutoDmAutomations({
        source: "api_cron",
        userId: id,
      }),
    ]);

    return { schedulerRun, autoDm };
  });

  const summary = runs.reduce(
    (acc, result) => {
      acc.attempted += result.schedulerRun.attempted;
      acc.posted += result.schedulerRun.posted;
      acc.failed += result.schedulerRun.failed;
      acc.skipped += result.schedulerRun.skipped;
      acc.autoDmSent += result.autoDm.sent;
      acc.autoDmFailed += result.autoDm.failed;
      return acc;
    },
    { attempted: 0, posted: 0, failed: 0, skipped: 0, autoDmSent: 0, autoDmFailed: 0 }
  );

  const response = NextResponse.json({
    mode: "fanout_users",
    usersProcessed: users.length,
    dispatchLimit,
    perUserLimit,
    concurrency,
    summary,
  });
  attachServerTiming(response, "snipradar_scheduler_cron", startedAt);
  logSnipRadarApiTelemetry({
    route: "/api/snipradar/scheduled/cron",
    method: "POST",
    status: 200,
    durationMs: Date.now() - startedAt,
    meta: { mode: "fanout_users", usersProcessed: users.length, concurrency, ...summary },
  });
  return response;
}
