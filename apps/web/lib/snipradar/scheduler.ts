import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { postTweetWithAutoRefresh } from "@/lib/snipradar/x-auth";
import { sendSnipRadarAlert } from "@/lib/snipradar/alerts";
import { emitSnipRadarWebhookEvent } from "@/lib/snipradar/webhooks";

type SchedulerSource = "api_user" | "api_cron" | "inngest";

interface ProcessScheduledOptions {
  source: SchedulerSource;
  userId?: string;
  limit?: number;
}

interface ProcessResultItem {
  draftId: string;
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

export interface ProcessScheduledResult {
  runId: string;
  source: SchedulerSource;
  userId?: string;
  attempted: number;
  posted: number;
  failed: number;
  skipped: number;
  lockAcquired: boolean;
  durationMs: number;
  results: ProcessResultItem[];
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const ALERT_FAILURE_RATIO = 0.5;
const ALERT_MIN_ATTEMPTS = 3;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const STALE_POSTING_RECOVERY_MS = 15 * 60 * 1000;
const lastAlertAtByKey = new Map<string, number>();

function shouldSendAlert(key: string): boolean {
  const lastAt = lastAlertAtByKey.get(key) ?? 0;
  const now = Date.now();
  if (now - lastAt < ALERT_COOLDOWN_MS) {
    return false;
  }
  lastAlertAtByKey.set(key, now);
  return true;
}

async function tryAcquireAdvisoryLock(lockKey: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(hashtext(${lockKey})) AS locked
    `;
    return !!rows?.[0]?.locked;
  } catch (error) {
    logger.warn("[Scheduler] advisory lock acquire failed; continuing without lock", {
      lockKey,
      error,
    });
    return true;
  }
}

async function releaseAdvisoryLock(lockKey: string): Promise<void> {
  try {
    await prisma.$queryRaw`
      SELECT pg_advisory_unlock(hashtext(${lockKey}))
    `;
  } catch (error) {
    logger.warn("[Scheduler] advisory lock release failed", { lockKey, error });
  }
}

async function persistSchedulerRun(
  payload: Omit<ProcessScheduledResult, "results"> & {
    status: "success" | "partial" | "failed" | "locked" | "empty";
    errorSummary?: string;
    failureReasons?: Record<string, number>;
  }
) {
  try {
    await prisma.xSchedulerRun.create({
      data: {
        userId: payload.userId ?? null,
        source: payload.source,
        status: payload.status,
        attempted: payload.attempted,
        posted: payload.posted,
        failed: payload.failed,
        skipped: payload.skipped,
        lockAcquired: payload.lockAcquired,
        durationMs: payload.durationMs,
        errorSummary: payload.errorSummary ?? null,
        failureReasons: payload.failureReasons ?? {},
      },
    });
  } catch (error) {
    logger.warn("[Scheduler] failed to persist scheduler run", { error, payload });
  }
}

async function postTweetWithRetry(params: {
  account: {
    id: string;
    xUserId: string;
    xUsername: string;
    accessToken: string;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
  };
  text: string;
  replyToTweetId?: string;
}) {
  let lastError: unknown = null;
  let latestAccessToken: string | null = params.account.accessToken;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await postTweetWithAutoRefresh({
        account: {
          ...params.account,
          accessToken: latestAccessToken ?? params.account.accessToken,
        },
        text: params.text,
        replyToTweetId: params.replyToTweetId,
      });
      if (result.reauthRequired) {
        throw new Error(result.authMessage ?? "Reconnect X account required for posting.");
      }
      if (result.tweetId) {
        return { tweetId: result.tweetId, accessToken: result.accessToken ?? latestAccessToken };
      }
      latestAccessToken = result.accessToken ?? latestAccessToken;
      lastError = new Error(result.authMessage ?? "Empty result from X API");
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to post tweet");
}

export async function processScheduledDrafts(
  options: ProcessScheduledOptions
): Promise<ProcessScheduledResult> {
  const startedAt = Date.now();
  const runId = `sched_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
  const limit = Math.max(1, Math.min(MAX_LIMIT, options.limit ?? DEFAULT_LIMIT));
  const lockKey = options.userId
    ? `snipradar:scheduler:user:${options.userId}`
    : "snipradar:scheduler:global";

  const lockAcquired = await tryAcquireAdvisoryLock(lockKey);
  if (!lockAcquired) {
    const result: ProcessScheduledResult = {
      runId,
      source: options.source,
      userId: options.userId,
      attempted: 0,
      posted: 0,
      failed: 0,
      skipped: 0,
      lockAcquired: false,
      durationMs: Date.now() - startedAt,
      results: [],
    };
    await persistSchedulerRun({
      ...result,
      status: "locked",
      errorSummary: "Another scheduler run already holds the lock",
      failureReasons: {},
    });
    return result;
  }

  try {
    // Recover stale in-flight records when a previous worker died mid-run.
    await prisma.tweetDraft.updateMany({
      where: {
        ...(options.userId ? { userId: options.userId } : {}),
        status: "posting",
        updatedAt: { lt: new Date(Date.now() - STALE_POSTING_RECOVERY_MS) },
      },
      data: { status: "scheduled" },
    });

    const dueDrafts = await prisma.tweetDraft.findMany({
      where: {
        ...(options.userId ? { userId: options.userId } : {}),
        status: "scheduled",
        scheduledFor: { lte: new Date() },
        postedTweetId: null,
      },
      include: {
        xAccount: {
          select: {
            id: true,
            xUserId: true,
            xUsername: true,
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { scheduledFor: "asc" },
        // Secondary sort ensures thread tweets come out in threadOrder sequence.
        // Standalone drafts (threadOrder=null) are unaffected.
        { threadOrder: "asc" },
      ],
      take: limit,
    });

    if (dueDrafts.length === 0) {
      const result: ProcessScheduledResult = {
        runId,
        source: options.source,
        userId: options.userId,
        attempted: 0,
        posted: 0,
        failed: 0,
        skipped: 0,
        lockAcquired: true,
        durationMs: Date.now() - startedAt,
        results: [],
      };
      await persistSchedulerRun({
        ...result,
        status: "empty",
        failureReasons: {},
      });
      return result;
    }

    const results: ProcessResultItem[] = [];
    const accessTokenByAccountId = new Map<string, string>();
    // Tracks the last posted tweet ID per threadGroupId so each tweet in a
    // thread can reply to the previous one, forming the reply chain on X.
    const threadGroupLastTweetId = new Map<string, string>();

    for (const draft of dueDrafts) {
      const claimed = await prisma.tweetDraft.updateMany({
        where: { id: draft.id, status: "scheduled", postedTweetId: null },
        data: { status: "posting" },
      });
      if (claimed.count === 0) {
        results.push({
          draftId: draft.id,
          success: false,
          error: "Skipped: already claimed by another worker",
        });
        continue;
      }

      const xAccount = draft.xAccount;
      if (!xAccount.isActive || !xAccount.accessToken || xAccount.accessToken === "bearer-only") {
        await prisma.tweetDraft.update({
          where: { id: draft.id },
          data: { status: "draft" },
        });
        results.push({
          draftId: draft.id,
          success: false,
          error: "Account requires OAuth connection; reverted to draft",
        });
        continue;
      }

      try {
        const accountAccessToken = accessTokenByAccountId.get(xAccount.id) ?? xAccount.accessToken;

        // Resolve reply-to ID for thread tweets.
        // For tweet #2+ in a thread: reply to the previous tweet in the chain.
        // Check the in-memory map first (tweets posted in this run), then fall
        // back to the DB (handles partial threads split across scheduler runs).
        let replyToTweetId: string | undefined;
        if (draft.threadGroupId && (draft.threadOrder ?? 1) > 1) {
          replyToTweetId = threadGroupLastTweetId.get(draft.threadGroupId);
          if (!replyToTweetId) {
            const prevTweet = await prisma.tweetDraft.findFirst({
              where: {
                threadGroupId: draft.threadGroupId,
                threadOrder: (draft.threadOrder ?? 1) - 1,
                status: "posted",
                postedTweetId: { not: null },
              },
              select: { postedTweetId: true },
            });
            replyToTweetId = prevTweet?.postedTweetId ?? undefined;
          }
        }

        const postResult = await postTweetWithRetry({
          account: {
            id: xAccount.id,
            xUserId: xAccount.xUserId,
            xUsername: xAccount.xUsername,
            accessToken: accountAccessToken,
            refreshToken: xAccount.refreshToken,
            tokenExpiresAt: xAccount.tokenExpiresAt,
          },
          text: draft.text,
          replyToTweetId,
        });
        if (postResult.accessToken) {
          accessTokenByAccountId.set(xAccount.id, postResult.accessToken);
        }
        // Record this tweet's ID so subsequent tweets in the same thread can reply to it.
        if (draft.threadGroupId && postResult.tweetId) {
          threadGroupLastTweetId.set(draft.threadGroupId, postResult.tweetId);
        }

        await prisma.tweetDraft.update({
          where: { id: draft.id },
          data: {
            status: "posted",
            postedAt: new Date(),
            postedTweetId: postResult.tweetId,
            scheduledFor: null,
          },
        });

        await emitSnipRadarWebhookEvent({
          userId: draft.userId,
          eventType: "draft.posted",
          resourceType: "tweet_draft",
          resourceId: draft.id,
          payload: {
            draftId: draft.id,
            tweetId: postResult.tweetId,
            tweetUrl: `https://x.com/${xAccount.xUsername}/status/${postResult.tweetId}`,
            text: draft.text,
            postedAt: new Date().toISOString(),
            origin: "scheduler",
            schedulerSource: options.source,
          },
        });

        results.push({
          draftId: draft.id,
          success: true,
          tweetId: postResult.tweetId,
          tweetUrl: `https://x.com/${xAccount.xUsername}/status/${postResult.tweetId}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown post error";
        const requiresReconnect =
          message.toLowerCase().includes("reconnect x account") ||
          message.toLowerCase().includes("authorization") ||
          message.toLowerCase().includes("token refresh");

        await prisma.tweetDraft.update({
          where: { id: draft.id },
          data: { status: requiresReconnect ? "draft" : "scheduled" },
        });

        await emitSnipRadarWebhookEvent({
          userId: draft.userId,
          eventType: "draft.publish_failed",
          resourceType: "tweet_draft",
          resourceId: draft.id,
          payload: {
            draftId: draft.id,
            text: draft.text,
            reason: message,
            origin: "scheduler",
            schedulerSource: options.source,
          },
        });
        logger.error("[Scheduler] post failed", {
          runId,
          source: options.source,
          draftId: draft.id,
          xUsername: xAccount.xUsername,
          error,
        });
        results.push({
          draftId: draft.id,
          success: false,
          error: message,
        });
      }
    }

    const posted = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const skipped = results.filter((r) =>
      (r.error ?? "").toLowerCase().includes("skipped")
    ).length;

    const failureReasons = results
      .filter((r) => !r.success)
      .reduce<Record<string, number>>((acc, item) => {
        const reason = (item.error ?? "unknown_error").slice(0, 140);
        acc[reason] = (acc[reason] ?? 0) + 1;
        return acc;
      }, {});
    const errorSummary =
      Object.entries(failureReasons)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? undefined;

    const status: "success" | "partial" | "failed" =
      failed === 0 ? "success" : posted > 0 ? "partial" : "failed";

    if (dueDrafts.length >= ALERT_MIN_ATTEMPTS && failed / dueDrafts.length >= ALERT_FAILURE_RATIO) {
      logger.error("[Scheduler][ALERT] high failure ratio", {
        runId,
        source: options.source,
        userId: options.userId ?? null,
        attempted: dueDrafts.length,
        posted,
        failed,
        failureRatio: failed / dueDrafts.length,
        failureReasons,
      });

      const alertKey = `${options.source}:${options.userId ?? "global"}:failure_ratio`;
      if (shouldSendAlert(alertKey)) {
        sendSnipRadarAlert({
          type: "scheduler_high_failure_ratio",
          severity: failed === dueDrafts.length ? "critical" : "warning",
          message: `Scheduler failure ratio ${Math.round((failed / dueDrafts.length) * 100)}%`,
          context: {
            runId,
            source: options.source,
            userId: options.userId ?? null,
            attempted: dueDrafts.length,
            posted,
            failed,
            failureReasons,
          },
        });
      }
    }

    logger.info("[Scheduler] run completed", {
      runId,
      source: options.source,
      userId: options.userId ?? null,
      attempted: dueDrafts.length,
      posted,
      failed,
      skipped,
      durationMs: Date.now() - startedAt,
    });

    const result: ProcessScheduledResult = {
      runId,
      source: options.source,
      userId: options.userId,
      attempted: dueDrafts.length,
      posted,
      failed,
      skipped,
      lockAcquired: true,
      durationMs: Date.now() - startedAt,
      results,
    };
    await persistSchedulerRun({
      ...result,
      status,
      errorSummary,
      failureReasons,
    });
    return result;
  } finally {
    await releaseAdvisoryLock(lockKey);
  }
}
