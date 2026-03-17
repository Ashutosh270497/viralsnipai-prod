import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getTweetMetrics } from "@/lib/integrations/x-api";
import { sendSnipRadarAlert } from "@/lib/snipradar/alerts";

interface RunSnipRadarMaintenanceOptions {
  userId?: string;
  metricsLimit?: number;
  metricsConcurrency?: number;
  schedulerRunRetentionDays?: number;
  engagementRetentionDays?: number;
}

export interface SnipRadarMaintenanceResult {
  userId?: string;
  scannedDrafts: number;
  repairedDrafts: number;
  failedDraftRepairs: number;
  cleanedSchedulerRuns: number;
  cleanedEngagementRows: number;
  durationMs: number;
}

const DEFAULT_METRICS_LIMIT = 100;
const DEFAULT_METRICS_CONCURRENCY = 4;
const DEFAULT_SCHEDULER_RETENTION_DAYS = 45;
const DEFAULT_ENGAGEMENT_RETENTION_DAYS = 60;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.round(parsed));
}

export async function runSnipRadarMaintenance(
  options: RunSnipRadarMaintenanceOptions = {}
): Promise<SnipRadarMaintenanceResult> {
  const startedAt = Date.now();
  const metricsLimit = parsePositiveInt(options.metricsLimit, DEFAULT_METRICS_LIMIT);
  const metricsConcurrency = parsePositiveInt(
    options.metricsConcurrency,
    DEFAULT_METRICS_CONCURRENCY
  );
  const schedulerRetentionDays = parsePositiveInt(
    options.schedulerRunRetentionDays,
    DEFAULT_SCHEDULER_RETENTION_DAYS
  );
  const engagementRetentionDays = parsePositiveInt(
    options.engagementRetentionDays,
    DEFAULT_ENGAGEMENT_RETENTION_DAYS
  );

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const schedulerCutoff = new Date(Date.now() - schedulerRetentionDays * 24 * 60 * 60 * 1000);
  const engagementCutoff = new Date(Date.now() - engagementRetentionDays * 24 * 60 * 60 * 1000);

  const pendingDrafts = await prisma.tweetDraft.findMany({
    where: {
      ...(options.userId ? { userId: options.userId } : {}),
      status: "posted",
      postedTweetId: { not: null },
      postedAt: {
        not: null,
        lte: twoHoursAgo,
        gte: fourteenDaysAgo,
      },
      OR: [
        { actualLikes: null },
        { actualRetweets: null },
        { actualReplies: null },
        { actualImpressions: null },
      ],
    },
    select: {
      id: true,
      userId: true,
      postedTweetId: true,
    },
    orderBy: { postedAt: "desc" },
    take: metricsLimit,
  });

  let repairedDrafts = 0;
  let failedDraftRepairs = 0;
  const draftChunks = chunkArray(pendingDrafts, metricsConcurrency);

  for (const batch of draftChunks) {
    const batchResults = await Promise.allSettled(
      batch.map(async (draft) => {
        if (!draft.postedTweetId) return false;
        const metrics = await getTweetMetrics(draft.postedTweetId);
        if (!metrics) return false;
        await prisma.tweetDraft.update({
          where: { id: draft.id },
          data: {
            actualLikes: metrics.likes,
            actualRetweets: metrics.retweets,
            actualReplies: metrics.replies,
            actualImpressions: metrics.impressions,
          },
        });
        return true;
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        repairedDrafts += 1;
      } else if (result.status === "rejected" || !result.value) {
        failedDraftRepairs += 1;
      }
    }
  }

  const [cleanedSchedulerRuns, cleanedEngagementRows] = await Promise.all([
    prisma.xSchedulerRun.deleteMany({
      where: {
        ...(options.userId ? { userId: options.userId } : {}),
        createdAt: { lt: schedulerCutoff },
      },
    }),
    prisma.xEngagementOpportunity.deleteMany({
      where: {
        ...(options.userId ? { userId: options.userId } : {}),
        status: { in: ["ignored", "replied"] },
        updatedAt: { lt: engagementCutoff },
      },
    }),
  ]);

  const result: SnipRadarMaintenanceResult = {
    userId: options.userId,
    scannedDrafts: pendingDrafts.length,
    repairedDrafts,
    failedDraftRepairs,
    cleanedSchedulerRuns: cleanedSchedulerRuns.count,
    cleanedEngagementRows: cleanedEngagementRows.count,
    durationMs: Date.now() - startedAt,
  };

  logger.info("[SnipRadar Maintenance] completed", { ...result });

  if (pendingDrafts.length >= 10 && failedDraftRepairs / pendingDrafts.length >= 0.5) {
    sendSnipRadarAlert({
      type: "maintenance_metrics_backfill_failure_ratio",
      severity: "warning",
      message: "SnipRadar maintenance metrics backfill has high failure ratio",
      context: { ...result },
    });
  }

  return result;
}
