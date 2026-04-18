import { inngest } from "./client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { syncCompetitorById } from "@/lib/competitors/sync";
import { processScheduledDrafts } from "@/lib/snipradar/scheduler";
import { processAutoDmAutomations } from "@/lib/snipradar/auto-dm";
import { runSnipRadarMaintenance } from "@/lib/snipradar/maintenance";
import { sendSnipRadarAlert } from "@/lib/snipradar/alerts";
import {
  getUserTweets,
  getMediaType,
  lookupUserById,
  getTweetMetrics,
} from "@/lib/integrations/x-api";
import { analyzeTweetBatch, generateDrafts } from "@/lib/ai/snipradar-analyzer";

/**
 * Health Check
 */
export const healthCheck = inngest.createFunction(
  {
    id: "health-check",
    name: "Health Check",
    retries: 0,
  },
  { event: "system/health-check" },
  async ({ event }) => {
    logger.info("Health check triggered", {
      timestamp: new Date().toISOString(),
    });
    return { success: true, timestamp: new Date().toISOString() };
  }
);

// ============================================
// SNIPRADAR BACKGROUND JOBS
// ============================================

/**
 * Job 1: Fetch Viral Tweets from tracked accounts (every 6 hours)
 */
export const snipRadarFetchViral = inngest.createFunction(
  {
    id: "snipradar-fetch-viral",
    name: "SnipRadar: Fetch Viral Tweets",
    retries: 3,
  },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const trackedAccounts = await step.run(
      "get-tracked-accounts",
      async () => {
        return prisma.xTrackedAccount.findMany({
          where: { isActive: true },
        });
      }
    );

    let totalFetched = 0;

    for (const tracked of trackedAccounts) {
      await step.run(`fetch-tweets-${tracked.id}`, async () => {
        try {
          const response = await getUserTweets({
            userId: tracked.trackedXUserId,
            maxResults: 20,
          });

          if (!response.data?.length) return;

          const minLikes = tracked.followerCount > 10000 ? 500 : 100;
          const viralTweets = response.data.filter(
            (t) => (t.public_metrics?.like_count ?? 0) >= minLikes
          );

          for (const tweet of viralTweets) {
            const mediaType = getMediaType(tweet, response.includes?.media);

            await prisma.viralTweet.upsert({
              where: { tweetId: tweet.id },
              update: {
                likes: tweet.public_metrics?.like_count ?? 0,
                retweets: tweet.public_metrics?.retweet_count ?? 0,
                replies: tweet.public_metrics?.reply_count ?? 0,
                impressions: tweet.public_metrics?.impression_count ?? 0,
                bookmarks: tweet.public_metrics?.bookmark_count ?? 0,
                quoteTweets: tweet.public_metrics?.quote_count ?? 0,
              },
              create: {
                trackedAccountId: tracked.id,
                tweetId: tweet.id,
                text: tweet.text,
                authorUsername: tracked.trackedUsername,
                authorDisplayName: tracked.trackedDisplayName,
                likes: tweet.public_metrics?.like_count ?? 0,
                retweets: tweet.public_metrics?.retweet_count ?? 0,
                replies: tweet.public_metrics?.reply_count ?? 0,
                impressions: tweet.public_metrics?.impression_count ?? 0,
                bookmarks: tweet.public_metrics?.bookmark_count ?? 0,
                quoteTweets: tweet.public_metrics?.quote_count ?? 0,
                mediaType,
                publishedAt: new Date(tweet.created_at),
              },
            });

            totalFetched++;
          }
        } catch (err) {
          logger.error(
            `Failed to fetch tweets for @${tracked.trackedUsername}`,
            { error: err }
          );
        }
      });
    }

    // Trigger analysis after fetching
    await step.sendEvent("trigger-analysis", {
      name: "snipradar/tweets.fetched",
      data: { totalFetched },
    });

    return { totalFetched };
  }
);

/**
 * Job 2: Analyze Viral Tweets with AI (triggered after fetch)
 */
export const snipRadarAnalyze = inngest.createFunction(
  {
    id: "snipradar-analyze",
    name: "SnipRadar: Analyze Viral Tweets",
    retries: 2,
  },
  { event: "snipradar/tweets.fetched" },
  async ({ step }) => {
    const unanalyzed = await step.run("get-unanalyzed", async () => {
      return prisma.viralTweet.findMany({
        where: { isAnalyzed: false },
        orderBy: { likes: "desc" },
        take: 30,
      });
    });

    if (unanalyzed.length === 0) {
      return { analyzed: 0 };
    }

    const results = await step.run("analyze-batch", async () => {
      try {
        const resultMap = await analyzeTweetBatch(
          unanalyzed.map((t) => ({
            id: t.id,
            text: t.text,
            authorUsername: t.authorUsername,
            likes: t.likes,
            retweets: t.retweets,
            replies: t.replies,
            impressions: t.impressions,
          }))
        );
        // Convert Map to array for JSON serialization (Inngest step results are serialized)
        return Array.from(resultMap.entries());
      } catch (err) {
        logger.error("[snipradar-analyze] AI batch analysis failed", { error: err, count: unanalyzed.length });
        return [] as Array<[string, unknown]>;
      }
    });

    let analyzedCount = 0;
    for (const [tweetId, rawAnalysis] of results) {
      // Cast from the serialized step result — shape matches TweetAnalysisResult
      const analysis = rawAnalysis as {
        hookType?: string | null;
        format?: string | null;
        emotionalTrigger?: string | null;
        viralScore?: number | null;
        whyItWorked?: string | null;
        lessonsLearned?: string[] | null;
      };
      await step.run(`update-${tweetId}`, async () => {
        await prisma.viralTweet.update({
          where: { id: tweetId },
          data: {
            isAnalyzed: true,
            hookType: analysis.hookType,
            format: analysis.format,
            emotionalTrigger: analysis.emotionalTrigger,
            viralScore: analysis.viralScore,
            whyItWorked: analysis.whyItWorked,
            lessonsLearned: analysis.lessonsLearned ?? [],
            analyzedAt: new Date(),
          },
        });
        analyzedCount++;
      });
    }

    return { analyzed: analyzedCount };
  }
);

/**
 * Job 3: Generate Daily Drafts (every morning at 7am UTC)
 */
export const snipRadarDailyDrafts = inngest.createFunction(
  {
    id: "snipradar-daily-drafts",
    name: "SnipRadar: Generate Daily Drafts",
    retries: 2,
  },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    const activeAccounts = await step.run("get-accounts", async () => {
      return prisma.xAccount.findMany({
        where: { isActive: true },
        include: {
          user: { select: { id: true, selectedNiche: true } },
        },
      });
    });

    let totalGenerated = 0;

    for (const xAccount of activeAccounts) {
      await step.run(`generate-for-${xAccount.id}`, async () => {
        try {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const viralPatterns = await prisma.viralTweet.findMany({
            where: {
              isAnalyzed: true,
              trackedAccount: {
                userId: xAccount.userId,
                xAccountId: xAccount.id,
              },
              publishedAt: { gte: sevenDaysAgo },
            },
            orderBy: { viralScore: "desc" },
            take: 10,
          });

          const niche = xAccount.user.selectedNiche ?? "general";

          const generatedTweets = await generateDrafts({
            niche,
            followerCount: xAccount.followerCount,
            viralPatterns: viralPatterns.map((p) => ({
              text: p.text,
              hookType: p.hookType ?? "unknown",
              format: p.format ?? "unknown",
              emotionalTrigger: p.emotionalTrigger ?? "unknown",
              likes: p.likes,
              whyItWorked: p.whyItWorked ?? "",
            })),
          });

          for (const tweet of generatedTweets) {
            await prisma.tweetDraft.create({
              data: {
                userId: xAccount.userId,
                xAccountId: xAccount.id,
                text: tweet.text,
                hookType: tweet.hookType,
                format: tweet.format,
                emotionalTrigger: tweet.emotionalTrigger,
                aiReasoning: tweet.reasoning,
                viralPrediction: tweet.viralPrediction,
              },
            });
            totalGenerated++;
          }
        } catch (err) {
          logger.error(
            `[snipradar-daily-drafts] Draft generation failed for @${xAccount.xUsername}`,
            { error: err, xAccountId: xAccount.id, userId: xAccount.userId }
          );
        }
      });
    }

    return { totalGenerated };
  }
);

/**
 * Job 4: Track Growth Snapshots (daily at midnight UTC)
 */
export const snipRadarGrowthSnapshot = inngest.createFunction(
  {
    id: "snipradar-growth-snapshot",
    name: "SnipRadar: Growth Snapshots",
    retries: 3,
  },
  { cron: "0 0 * * *" },
  async ({ step }) => {
    const accounts = await step.run("get-accounts", async () => {
      return prisma.xAccount.findMany({
        where: { isActive: true },
        include: {
          snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
    });

    let snapshotsCreated = 0;

    for (const account of accounts) {
      await step.run(`snapshot-${account.id}`, async () => {
        try {
          const xUser = await lookupUserById(account.xUserId);
          if (!xUser?.public_metrics) return;

          const lastSnapshot = account.snapshots[0];
          const followerGrowth = lastSnapshot
            ? xUser.public_metrics.followers_count - lastSnapshot.followerCount
            : 0;

          await prisma.xAccountSnapshot.create({
            data: {
              xAccountId: account.id,
              followerCount: xUser.public_metrics.followers_count,
              followingCount: xUser.public_metrics.following_count,
              tweetCount: xUser.public_metrics.tweet_count,
              followerGrowth,
            },
          });

          await prisma.xAccount.update({
            where: { id: account.id },
            data: {
              followerCount: xUser.public_metrics.followers_count,
              followingCount: xUser.public_metrics.following_count,
            },
          });

          snapshotsCreated++;
        } catch (err) {
          logger.error(`Growth snapshot failed for ${account.xUsername}`, {
            error: err,
          });
        }
      });
    }

    return { snapshotsCreated };
  }
);

/**
 * Job 5: Fetch Posted Tweet Metrics (triggered 24h after posting)
 */
export const snipRadarPostMetrics = inngest.createFunction(
  {
    id: "snipradar-post-metrics",
    name: "SnipRadar: Fetch Post Metrics",
    retries: 2,
  },
  { event: "snipradar/tweet.posted" },
  async ({ event, step }) => {
    // Wait 24 hours
    await step.sleep("wait-24h", "24h");

    const draftId = event.data.draftId as string;

    const draft = await step.run("get-draft", async () => {
      return prisma.tweetDraft.findUnique({
        where: { id: draftId },
      });
    });

    if (!draft?.postedTweetId) {
      return { success: false, reason: "No posted tweet ID" };
    }

    const metrics = await step.run("fetch-metrics", async () => {
      return getTweetMetrics(draft.postedTweetId!);
    });

    if (metrics) {
      await step.run("update-draft", async () => {
        await prisma.tweetDraft.update({
          where: { id: draftId },
          data: {
            actualLikes: metrics.likes,
            actualRetweets: metrics.retweets,
            actualReplies: metrics.replies,
            actualImpressions: metrics.impressions,
          },
        });
      });
    }

    return { success: true, metrics };
  }
);

/**
 * Job 6: Post Scheduled Tweets (every minute)
 * Checks for drafts with status='scheduled' and scheduledFor <= now, then posts them.
 */
export const snipRadarPostScheduled = inngest.createFunction(
  {
    id: "snipradar-post-scheduled",
    name: "SnipRadar: Dispatch Scheduled Tweet Processing",
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { cron: "* * * * *" }, // Every minute
  async ({ step }) => {
    const dispatchLimit = Math.max(
      20,
      Math.min(500, Number(process.env.SNIPRADAR_SCHEDULER_USER_DISPATCH_LIMIT ?? 200))
    );

    const dueUsers = await step.run("get-due-users", async () => {
      const rows = await prisma.tweetDraft.findMany({
        where: {
          status: "scheduled",
          scheduledFor: { lte: new Date() },
        },
        select: { userId: true },
        distinct: ["userId"],
        take: dispatchLimit,
      });
      return rows.map((r) => r.userId);
    });

    if (dueUsers.length === 0) {
      return { enqueuedUsers: 0, dispatchLimit };
    }

    for (const userId of dueUsers) {
      await step.sendEvent(`enqueue-user-${userId}`, {
        name: "snipradar/scheduled.process-user",
        data: { userId },
      });
    }

    if (dueUsers.length >= dispatchLimit) {
      sendSnipRadarAlert({
        type: "scheduler_dispatch_backlog",
        severity: "warning",
        message: "Scheduler dispatch limit reached; queue may be backlogged.",
        context: { dispatchLimit, enqueuedUsers: dueUsers.length },
      });
    }

    return { enqueuedUsers: dueUsers.length, dispatchLimit };
  }
);

/**
 * Job 6b: Process scheduled tweets for a specific user (fan-out worker).
 */
export const snipRadarPostScheduledPerUser = inngest.createFunction(
  {
    id: "snipradar-post-scheduled-per-user",
    name: "SnipRadar: Post Scheduled Tweets (Per User)",
    retries: 1,
    concurrency: [{ limit: 30 }],
  },
  { event: "snipradar/scheduled.process-user" },
  async ({ event, step }) => {
    const userId = String(event.data?.userId ?? "");
    if (!userId) {
      return { processed: false, reason: "missing_user_id" };
    }

    const perUserLimit = Math.max(
      5,
      Math.min(100, Number(process.env.SNIPRADAR_SCHEDULER_PER_USER_LIMIT ?? 25))
    );
    const result = await step.run(`process-user-${userId}`, async () => {
      // Run scheduling and auto-DM independently so a failure in one doesn't block the other.
      const schedulerRun = await processScheduledDrafts({
        source: "inngest",
        userId,
        limit: perUserLimit,
      });

      let autoDm: { sent: number; skipped: number; failed: number } | null = null;
      try {
        autoDm = await processAutoDmAutomations({
          source: "inngest",
          userId,
        });
      } catch (err) {
        logger.error("[snipradar-post-scheduled] Auto-DM processing failed", {
          error: err,
          userId,
        });
      }

      return {
        ...schedulerRun,
        autoDm,
      };
    });

    if (result.attempted >= 3 && result.failed === result.attempted) {
      sendSnipRadarAlert({
        type: "scheduler_user_run_failed",
        severity: "warning",
        message: "Scheduler run failed for user batch.",
        context: {
          userId,
          attempted: result.attempted,
          failed: result.failed,
          posted: result.posted,
          runId: result.runId,
          autoDmSent: result.autoDm?.sent ?? 0,
        },
      });
    }

    return result;
  }
);

/**
 * Job 7: Repair missing metrics + data hygiene.
 */
export const snipRadarMaintenanceCron = inngest.createFunction(
  {
    id: "snipradar-maintenance-cron",
    name: "SnipRadar: Maintenance",
    retries: 1,
  },
  { cron: "15 */2 * * *" }, // every 2 hours at :15
  async ({ step }) => {
    const metricsLimit = Math.max(
      20,
      Math.min(400, Number(process.env.SNIPRADAR_MAINTENANCE_METRICS_LIMIT ?? 200))
    );
    const metricsConcurrency = Math.max(
      1,
      Math.min(10, Number(process.env.SNIPRADAR_MAINTENANCE_METRICS_CONCURRENCY ?? 4))
    );

    const result = await step.run("run-maintenance", async () =>
      runSnipRadarMaintenance({
        metricsLimit,
        metricsConcurrency,
      })
    );

    return result;
  }
);

// ============================================
// COMPETITORS BACKGROUND JOBS
// ============================================

/**
 * Event-driven sync for a single competitor.
 */
export const competitorsSyncRequested = inngest.createFunction(
  {
    id: "competitors-sync-requested",
    name: "Competitors: Sync Requested",
    retries: 2,
    concurrency: [{ limit: 5 }],
  },
  { event: "competitors/sync.requested" },
  async ({ event, step }) => {
    const competitorId = event.data?.competitorId as string | undefined;
    const refreshVideos = Boolean(event.data?.refreshVideos ?? true);
    const reason = String(event.data?.reason ?? "unknown");

    if (!competitorId) {
      return { synced: false, reason: "missing_competitor_id" };
    }

    await step.run(`mark-syncing-${competitorId}`, async () => {
      await prisma.competitor.updateMany({
        where: { id: competitorId, isActive: true },
        data: {
          syncStatus: "syncing",
          lastSyncReason: reason,
          lastSyncError: null,
        },
      });
    });

    const result = await step.run(`sync-${competitorId}`, async () =>
      syncCompetitorById({
        competitorId,
        refreshVideos,
        reason,
      })
    );

    if (result.synced) {
      await step.run(`mark-success-${competitorId}`, async () => {
        await prisma.competitor.updateMany({
          where: { id: competitorId, isActive: true },
          data: {
            syncStatus: "success",
            lastSyncAt: new Date(),
            lastSyncError: null,
            syncFailureCount: 0,
          },
        });
      });
    } else {
      await step.run(`mark-failed-${competitorId}`, async () => {
        await prisma.competitor.updateMany({
          where: { id: competitorId, isActive: true },
          data: {
            syncStatus: "failed",
            lastSyncError: `Sync failed: ${result.reason}`,
            syncFailureCount: { increment: 1 },
          },
        });
      });
    }

    return { competitorId, ...result, reason };
  }
);

/**
 * Periodic stale sync safety net.
 * Keeps competitors fresh even if no user hits the page.
 */
export const competitorsSyncStaleCron = inngest.createFunction(
  {
    id: "competitors-sync-stale-cron",
    name: "Competitors: Sync Stale Cron",
    retries: 1,
  },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const active = await step.run("get-active-competitors", async () => {
      return prisma.competitor.findMany({
        where: { isActive: true },
        select: {
          id: true,
          snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        take: 100,
      });
    });

    const maxAgeMs = 24 * 60 * 60 * 1000;
    const staleIds = active
      .filter((c) => {
        const latest = c.snapshots[0];
        if (!latest) return true;
        return Date.now() - new Date(latest.createdAt).getTime() > maxAgeMs;
      })
      .slice(0, 30)
      .map((c) => c.id);

    for (const competitorId of staleIds) {
      await step.sendEvent(`enqueue-sync-${competitorId}`, {
        name: "competitors/sync.requested",
        data: {
          competitorId,
          reason: "cron_stale",
          refreshVideos: true,
        },
      });
    }

    return { scanned: active.length, enqueued: staleIds.length };
  }
);

// Export all functions
export const functions = [
  healthCheck,
  snipRadarFetchViral,
  snipRadarAnalyze,
  snipRadarDailyDrafts,
  snipRadarGrowthSnapshot,
  snipRadarPostMetrics,
  snipRadarPostScheduled,
  snipRadarPostScheduledPerUser,
  snipRadarMaintenanceCron,
  competitorsSyncRequested,
  competitorsSyncStaleCron,
];
