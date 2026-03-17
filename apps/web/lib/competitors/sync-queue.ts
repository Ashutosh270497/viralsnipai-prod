import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { syncCompetitorById } from "@/lib/competitors/sync";

type CompetitorSyncReason =
  | "stale_list"
  | "analytics_stale"
  | "analytics_incomplete"
  | "manual_force"
  | "added"
  | "reactivated"
  | "cron_stale";

export async function enqueueCompetitorSync(
  competitorId: string,
  reason: CompetitorSyncReason,
  refreshVideos = true,
  options?: {
    bypassDedup?: boolean;
    dedupWindowMs?: number;
    fallbackToInlineSync?: boolean;
  },
) {
  try {
    const dedupWindowMs = options?.dedupWindowMs ?? 5 * 60 * 1000;
    const competitor = await prisma.competitor.findUnique({
      where: { id: competitorId },
      select: {
        id: true,
        isActive: true,
        syncStatus: true,
        lastSyncQueuedAt: true,
      },
    });

    if (!competitor || !competitor.isActive) {
      return false;
    }

    const shouldDedup = !options?.bypassDedup && reason !== "manual_force";
    if (shouldDedup && competitor.lastSyncQueuedAt) {
      const queuedRecently = Date.now() - competitor.lastSyncQueuedAt.getTime() < dedupWindowMs;
      if (
        queuedRecently &&
        (competitor.syncStatus === "queued" || competitor.syncStatus === "syncing")
      ) {
        return false;
      }
    }

    await prisma.competitor.update({
      where: { id: competitorId },
      data: {
        syncStatus: "queued",
        lastSyncQueuedAt: new Date(),
        lastSyncReason: reason,
      },
    });

    await inngest.send({
      name: "competitors/sync.requested",
      data: { competitorId, reason, refreshVideos },
    });
    return true;
  } catch (error) {
    const enqueueError = error instanceof Error ? error.message : "Failed to enqueue sync job";

    if (!options?.fallbackToInlineSync) {
      await prisma.competitor
        .update({
          where: { id: competitorId },
          data: {
            syncStatus: "idle",
            lastSyncError: null,
          },
        })
        .catch(() => null);
      return false;
    }

    // Fallback path for local/dev setups where Inngest event delivery is unavailable.
    const fallback = await syncCompetitorById({
      competitorId,
      refreshVideos,
      reason,
    }).catch(() => ({ synced: false as const, reason: "fallback_sync_error" as const }));

    if (fallback.synced) {
      await prisma.competitor
        .update({
          where: { id: competitorId },
          data: {
            syncStatus: "success",
            lastSyncAt: new Date(),
            lastSyncError: null,
            syncFailureCount: 0,
          },
        })
        .catch(() => null);
      return true;
    }

    await prisma.competitor
      .update({
        where: { id: competitorId },
        data: {
          syncStatus: "failed",
          lastSyncError: `Queue failed: ${enqueueError}; Fallback failed: ${fallback.reason}`,
          syncFailureCount: { increment: 1 },
        },
      })
      .catch(() => null);
    return false;
  }
}

export async function enqueueCompetitorSyncBatch(
  items: Array<{ competitorId: string; reason: CompetitorSyncReason; refreshVideos?: boolean }>,
  options?: {
    fallbackToInlineSync?: boolean;
    dedupWindowMs?: number;
    bypassDedup?: boolean;
  },
) {
  for (const item of items) {
    await enqueueCompetitorSync(item.competitorId, item.reason, item.refreshVideos ?? true, {
      fallbackToInlineSync: options?.fallbackToInlineSync,
      dedupWindowMs: options?.dedupWindowMs,
      bypassDedup: options?.bypassDedup,
    });
  }
}
