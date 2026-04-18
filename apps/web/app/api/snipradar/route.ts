export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  buildActivationSummary,
  getActivationCheckpointStatuses,
  recordActivationCheckpointSafe,
} from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthorizationUrl,
  lookupUser,
  getTweetMetrics,
} from "@/lib/integrations/x-api";
import { getUserTweetsWithAutoRefresh } from "@/lib/snipradar/x-auth";
import { seedStarterTrackedAccountsForUser } from "@/lib/snipradar/starter-account-seeding";
import { summarizeXApiUnitEconomics } from "@/lib/snipradar/x-unit-economics";
import { cookies } from "next/headers";
import { isDbPoolSaturationError, withDbPoolRetry } from "@/lib/snipradar/db-resilience";
import { snipradarErrorResponse } from "@/lib/snipradar/api-errors";

const refreshLocks = new Map<string, number>();
const REFRESH_LOCK_TTL_MS = 20_000;
const ACCOUNT_REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;
const MAX_SUMMARY_PERIOD_DAYS = 30;
const MIN_SUMMARY_PERIOD_DAYS = 7;
const DASHBOARD_CACHE_TTL_MS = 8_000;
const SUMMARY_CACHE_TTL_MS = 12_000;
const dashboardCache = new Map<string, { data: unknown; expiresAt: number }>();

function getActiveAutoDmAutomationCount(params: { userId: string; xAccountId: string }) {
  return prisma.xAutoDmAutomation.count({
    where: {
      userId: params.userId,
      xAccountId: params.xAccountId,
      isActive: true,
    },
  });
}

type PostedMetricRow = {
  postedAt: Date | null;
  actualLikes: number | null;
  actualRetweets: number | null;
  actualReplies: number | null;
  actualImpressions: number | null;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  const run = async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  };

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () =>
    run()
  );
  await Promise.all(runners);
  return results;
}

function parseSummaryPeriodDays(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 7;
  return Math.max(MIN_SUMMARY_PERIOD_DAYS, Math.min(MAX_SUMMARY_PERIOD_DAYS, Math.round(parsed)));
}

function calculateEngagementStats(
  rows: Array<{
    actualLikes: number | null;
    actualRetweets: number | null;
    actualReplies: number | null;
    actualImpressions: number | null;
  }>
) {
  const validRows = rows.filter((t) => (t.actualImpressions ?? 0) > 0);
  if (validRows.length === 0) {
    return {
      avgEngagementRate: 0,
      avgImpressionsPerPost: 0,
    };
  }

  const totalEngagement = validRows.reduce((sum, t) => {
    return sum + (t.actualLikes ?? 0) + (t.actualRetweets ?? 0) + (t.actualReplies ?? 0);
  }, 0);
  const totalImpressions = validRows.reduce((sum, t) => sum + (t.actualImpressions ?? 0), 0);

  return {
    avgEngagementRate:
      totalImpressions > 0 ? Math.round(((totalEngagement / totalImpressions) * 100) * 100) / 100 : 0,
    avgImpressionsPerPost: Math.round(totalImpressions / validRows.length),
  };
}

function buildImpressionsTrend(
  periodDays: number,
  rows: Array<{ postedAt: Date | string; impressions: number }>
): Array<{ date: string; impressions: number }> {
  const impressionsByDate = new Map<string, number>();
  for (let offset = periodDays - 1; offset >= 0; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    impressionsByDate.set(d.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const postedAt =
      row.postedAt instanceof Date ? row.postedAt : new Date(row.postedAt);
    if (Number.isNaN(postedAt.getTime())) continue;
    const key = postedAt.toISOString().slice(0, 10);
    if (!impressionsByDate.has(key)) continue;
    impressionsByDate.set(key, (impressionsByDate.get(key) ?? 0) + Math.max(0, row.impressions));
  }

  return [...impressionsByDate.entries()].map(([date, impressions]) => ({
    date,
    impressions,
  }));
}

async function fetchLiveTweetStats(params: {
  xAccountId: string;
  xUserId: string;
  xUsername: string;
  accessToken: string;
  refreshToken: string | null;
  periodStart: Date;
  periodDays: number;
}): Promise<{
  stats: {
    avgEngagementRate: number;
    avgImpressionsPerPost: number;
    impressionsTrend: Array<{ date: string; impressions: number }>;
    sampleSize: number;
  } | null;
  auth: {
    reauthRequired: boolean;
    message: string | null;
    refreshedToken: boolean;
  };
}> {
  try {
    const { response, reauthRequired, refreshedToken, authMessage } =
      await getUserTweetsWithAutoRefresh({
        account: {
          id: params.xAccountId,
          xUserId: params.xUserId,
          xUsername: params.xUsername,
          accessToken: params.accessToken,
          refreshToken: params.refreshToken,
        },
        maxResults: 100,
        startTime: params.periodStart,
      });

    const liveRows = (response.data ?? [])
      .map((tweet) => {
        const metrics = tweet.public_metrics;
        return {
          postedAt: tweet.created_at,
          likes: metrics?.like_count ?? 0,
          retweets: metrics?.retweet_count ?? 0,
          replies: metrics?.reply_count ?? 0,
          impressions: metrics?.impression_count ?? 0,
        };
      })
      .filter((row) => row.impressions > 0);

    if (liveRows.length === 0) {
      return {
        stats: null,
        auth: {
          reauthRequired,
          message: authMessage,
          refreshedToken,
        },
      };
    }

    const totalEngagement = liveRows.reduce(
      (sum, row) => sum + row.likes + row.retweets + row.replies,
      0
    );
    const totalImpressions = liveRows.reduce((sum, row) => sum + row.impressions, 0);
    const avgEngagementRate =
      totalImpressions > 0
        ? Math.round(((totalEngagement / totalImpressions) * 100) * 100) / 100
        : 0;
    const avgImpressionsPerPost =
      liveRows.length > 0 ? Math.round(totalImpressions / liveRows.length) : 0;

    return {
      stats: {
        avgEngagementRate,
        avgImpressionsPerPost,
        impressionsTrend: buildImpressionsTrend(
          params.periodDays,
          liveRows.map((row) => ({ postedAt: row.postedAt, impressions: row.impressions }))
        ),
        sampleSize: liveRows.length,
      },
      auth: {
        reauthRequired,
        message: authMessage,
        refreshedToken,
      },
    };
  } catch (error) {
    console.warn("[SnipRadar Summary] Live tweet stats fetch failed, using DB fallback", {
      userId: params.xUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      stats: null,
      auth: {
        reauthRequired: false,
        message: null,
        refreshedToken: false,
      },
    };
  }
}

/**
 * GET /api/snipradar
 * Dashboard data: account info, stats, tracked accounts, recent drafts, viral tweets
 */
export async function GET(request: Request) {
  const requestStartedAt = Date.now();
  let cacheKey = "";
  let requestScope: "summary" | "full" = "full";
  let requestPeriodDays = 7;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") === "summary" ? "summary" : "full";
    requestScope = scope;
    const periodDays = parseSummaryPeriodDays(url.searchParams.get("periodDays"));
    requestPeriodDays = periodDays;
    cacheKey = `${user.id}:${scope}:${periodDays}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      const response = NextResponse.json(cached.data);
      response.headers.set("Server-Timing", `snipradar_${scope};dur=${Date.now() - requestStartedAt}`);
      response.headers.set("X-SnipRadar-Cache", "hit");
      return response;
    }
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch connected X account
    const xAccount = await withDbPoolRetry("summary.find-active-account", () =>
      prisma.xAccount.findFirst({
        where: { userId: user.id, isActive: true },
        include: {
          snapshots: {
            orderBy: { createdAt: "desc" },
            take: 30,
          },
        },
      })
    );

    if (scope === "summary") {
      const previousFollowerCount = xAccount?.followerCount ?? 0;
      const actualTweetCount = xAccount?.snapshots?.[0]?.tweetCount ?? 0;

      let followerGrowth7d = 0;
      if (xAccount) {
        const baselineInWindow = [...xAccount.snapshots]
          .filter((s) => s.createdAt >= periodStart)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

        const oldestKnownSnapshot = [...xAccount.snapshots]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

        const baselineFollowerCount =
          baselineInWindow?.followerCount ??
          oldestKnownSnapshot?.followerCount ??
          previousFollowerCount;

        followerGrowth7d = xAccount.followerCount - baselineFollowerCount;
      }

      const now = new Date();
      const summaryDbReadsPromise = xAccount
        ? withDbPoolRetry("summary.fetch-db-reads", () =>
            Promise.all([
              prisma.xTrackedAccount.count({
                where: { userId: user.id, xAccountId: xAccount.id, isActive: true },
              }),
              prisma.tweetDraft.count({
                where: { userId: user.id, xAccountId: xAccount.id, status: "draft" },
              }),
              prisma.tweetDraft.count({
                where: { userId: user.id, xAccountId: xAccount.id, status: "scheduled" },
              }),
              prisma.tweetDraft.count({
                where: { userId: user.id, xAccountId: xAccount.id, status: "posted" },
              }),
              prisma.tweetDraft.count({
                where: {
                  userId: user.id,
                  xAccountId: xAccount.id,
                  status: "scheduled",
                  scheduledFor: { lte: now },
                },
              }),
              prisma.viralTweet.count({
                where: {
                  trackedAccount: { userId: user.id, xAccountId: xAccount.id },
                  publishedAt: { gte: sevenDaysAgo },
                },
              }),
              prisma.viralTweet.count({
                where: {
                  trackedAccount: { userId: user.id, xAccountId: xAccount.id },
                  publishedAt: { gte: sevenDaysAgo },
                  isAnalyzed: true,
                },
              }),
              getActiveAutoDmAutomationCount({
                userId: user.id,
                xAccountId: xAccount.id,
              }),
              prisma.xResearchInboxItem.findFirst({
                where: {
                  userId: user.id,
                  generatedReply: { not: null },
                },
                select: { updatedAt: true },
                orderBy: { updatedAt: "asc" },
              }),
              prisma.tweetDraft.findMany({
                where: {
                  userId: user.id,
                  xAccountId: xAccount.id,
                  status: "posted",
                  postedAt: { gte: periodStart },
                  actualImpressions: { gt: 0 },
                },
                select: {
                  actualLikes: true,
                  actualRetweets: true,
                  actualReplies: true,
                  actualImpressions: true,
                  postedAt: true,
                },
                orderBy: { postedAt: "desc" },
                take: 100,
              }),
            ])
          )
        : Promise.resolve(
            [0, 0, 0, 0, 0, 0, 0, 0, null, [] as PostedMetricRow[]] as [
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              { updatedAt: Date } | null,
              PostedMetricRow[],
            ]
          );
      const activationStatusesPromise = getActivationCheckpointStatuses(user.id);

      const liveTweetStatsPromise = xAccount
        ? fetchLiveTweetStats({
            xAccountId: xAccount.id,
            xUserId: xAccount.xUserId,
            xUsername: xAccount.xUsername,
            accessToken: xAccount.accessToken,
            refreshToken: xAccount.refreshToken,
            periodStart,
            periodDays,
          })
        : Promise.resolve(null);

      const profilePromise = withDbPoolRetry("summary.fetch-user-profile", () =>
        prisma.user.findUnique({
          where: { id: user.id },
          select: {
            name: true,
            selectedNiche: true,
            onboardingCompleted: true,
          },
        })
      );

      const [summaryDbReads, activationStatuses, liveTweetStats, profile] = await Promise.all([
        summaryDbReadsPromise,
        activationStatusesPromise,
        liveTweetStatsPromise,
        profilePromise,
      ]);

      const [
        trackedAccountsCount,
        draftsCount,
        scheduledDraftsCount,
        postedDraftsCount,
        dueScheduledDraftsCount,
        viralTweetsCount,
        analyzedViralTweetsCount,
        activeAutoDmAutomationsCount,
        firstReplyAssist,
        postedWithMetrics,
      ] = summaryDbReads;

      const dbStats = calculateEngagementStats(postedWithMetrics);
      const dbImpressionsTrend = buildImpressionsTrend(
        periodDays,
        postedWithMetrics
          .filter((row) => row.postedAt)
          .map((row) => ({
            postedAt: row.postedAt as Date,
            impressions: row.actualImpressions ?? 0,
          }))
      );
      const avgEngagementRate =
        liveTweetStats?.stats?.avgEngagementRate ?? dbStats.avgEngagementRate;
      const avgImpressionsPerPost =
        liveTweetStats?.stats?.avgImpressionsPerPost ?? dbStats.avgImpressionsPerPost;
      const impressionsTrend = liveTweetStats?.stats?.impressionsTrend ?? dbImpressionsTrend;
      const activation = buildActivationSummary("snipradar", {
        ...activationStatuses,
        ...(xAccount
          ? {
              snipradar_x_account_connected: {
                completed: true,
                completedAt: xAccount.createdAt,
                source: "derived",
              },
            }
          : {}),
        ...(trackedAccountsCount > 0
          ? {
              snipradar_first_tracked_account_added: {
                completed: true,
                completedAt: null,
                source: "derived",
              },
            }
          : {}),
        ...(firstReplyAssist
          ? {
              snipradar_first_reply_assist_used: {
                completed: true,
                completedAt: firstReplyAssist.updatedAt,
                source: "derived",
              },
            }
          : {}),
        ...(scheduledDraftsCount > 0
          ? {
              snipradar_first_scheduled_post: {
                completed: true,
                completedAt: null,
                source: "derived",
              },
            }
          : {}),
      });
      const unitEconomics = summarizeXApiUnitEconomics({
        trackedAccounts: trackedAccountsCount,
        hydrationCandidates: postedWithMetrics.length,
        scheduledDrafts: scheduledDraftsCount,
      });

      const payload = {
        account: xAccount
          ? {
              id: xAccount.id,
              xUsername: xAccount.xUsername,
              xDisplayName: xAccount.xDisplayName,
              profileImageUrl: xAccount.profileImageUrl,
              followerCount: xAccount.followerCount,
              followingCount: xAccount.followingCount,
              isActive: xAccount.isActive,
            }
          : null,
        auth: xAccount
          ? {
              reauthRequired: liveTweetStats?.auth?.reauthRequired ?? false,
              message: liveTweetStats?.auth?.message ?? null,
              refreshedToken: liveTweetStats?.auth?.refreshedToken ?? false,
            }
          : null,
        profile: {
          name: profile?.name ?? null,
          selectedNiche: profile?.selectedNiche ?? null,
          onboardingCompleted: profile?.onboardingCompleted ?? false,
        },
        stats: {
          periodDays,
          followerCount: xAccount?.followerCount ?? 0,
          followerGrowth7d,
          tweetsPosted: postedDraftsCount,
          actualTweetCount,
          avgEngagementRate,
          avgImpressionsPerPost,
          impressionsTrend,
        },
        counts: {
          trackedAccounts: trackedAccountsCount,
          drafts: draftsCount,
          scheduledDrafts: scheduledDraftsCount,
          postedDrafts: postedDraftsCount,
          dueScheduledDrafts: dueScheduledDraftsCount,
          viralTweets: viralTweetsCount,
          analyzedViralTweets: analyzedViralTweetsCount,
          activeAutoDmAutomations: activeAutoDmAutomationsCount,
        },
        activation,
        unitEconomics,
      };
      dashboardCache.set(cacheKey, {
        data: payload,
        expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
      });
      const response = NextResponse.json(payload);
      response.headers.set("Server-Timing", `snipradar_summary;dur=${Date.now() - requestStartedAt}`);
      response.headers.set("X-SnipRadar-Cache", "miss");
      return response;
    }

    const previousFollowerCount = xAccount?.followerCount ?? 0;
    const actualTweetCount = xAccount?.snapshots?.[0]?.tweetCount ?? 0;

    // Calculate follower growth over 7 days
    let followerGrowth7d = 0;
    if (xAccount) {
      const baselineInWindow = [...xAccount.snapshots]
        .filter((s) => s.createdAt >= periodStart)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

      const oldestKnownSnapshot = [...xAccount.snapshots]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

      const baselineFollowerCount =
        baselineInWindow?.followerCount ??
        oldestKnownSnapshot?.followerCount ??
        previousFollowerCount;

      followerGrowth7d = xAccount.followerCount - baselineFollowerCount;
    }

    // Run independent queries in parallel
    const fullDbReadsPromise = xAccount
      ? withDbPoolRetry("dashboard.fetch-db-reads", () =>
          Promise.all([
            prisma.xTrackedAccount.findMany({
              where: { userId: user.id, xAccountId: xAccount.id, isActive: true },
              include: { _count: { select: { viralTweets: true } } },
              orderBy: { createdAt: "desc" },
            }),
            prisma.tweetDraft.findMany({
              where: {
                userId: user.id,
                xAccountId: xAccount.id,
                status: "draft",
                createdAt: { gte: sevenDaysAgo },
              },
              select: {
                id: true,
                text: true,
                hookType: true,
                format: true,
                emotionalTrigger: true,
                viralPrediction: true,
                aiReasoning: true,
                threadGroupId: true,
                threadOrder: true,
                status: true,
                scheduledFor: true,
                postedAt: true,
                postedTweetId: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 20,
            }),
            prisma.tweetDraft.findMany({
              where: {
                userId: user.id,
                xAccountId: xAccount.id,
                status: "scheduled",
              },
              select: {
                id: true,
                text: true,
                hookType: true,
                format: true,
                emotionalTrigger: true,
                viralPrediction: true,
                aiReasoning: true,
                threadGroupId: true,
                threadOrder: true,
                status: true,
                scheduledFor: true,
                postedAt: true,
                postedTweetId: true,
                createdAt: true,
              },
              orderBy: { scheduledFor: "asc" },
              take: 20,
            }),
            prisma.tweetDraft.findMany({
              where: {
                userId: user.id,
                xAccountId: xAccount.id,
                status: "posted",
              },
              select: {
                id: true,
                text: true,
                hookType: true,
                format: true,
                emotionalTrigger: true,
                viralPrediction: true,
                aiReasoning: true,
                threadGroupId: true,
                threadOrder: true,
                status: true,
                scheduledFor: true,
                postedAt: true,
                postedTweetId: true,
                createdAt: true,
              },
              orderBy: { postedAt: "desc" },
              take: 20,
            }),
            prisma.tweetDraft.count({
              where: {
                userId: user.id,
                xAccountId: xAccount.id,
                status: "posted",
              },
            }),
            prisma.tweetDraft.findMany({
              where: {
                userId: user.id,
                xAccountId: xAccount.id,
                status: "posted",
                postedAt: { gte: periodStart },
                actualImpressions: { gt: 0 },
              },
              select: {
                actualLikes: true,
                actualRetweets: true,
                actualReplies: true,
                actualImpressions: true,
                postedAt: true,
              },
              orderBy: { postedAt: "desc" },
              take: 100,
            }),
            prisma.viralTweet.findMany({
              where: {
                trackedAccount: {
                  userId: user.id,
                  xAccountId: xAccount.id,
                },
                publishedAt: { gte: sevenDaysAgo },
              },
              select: {
                id: true,
                trackedAccountId: true,
                tweetId: true,
                text: true,
                authorUsername: true,
                authorDisplayName: true,
                likes: true,
                retweets: true,
                replies: true,
                impressions: true,
                hookType: true,
                format: true,
                emotionalTrigger: true,
                viralScore: true,
                whyItWorked: true,
                lessonsLearned: true,
                publishedAt: true,
                isAnalyzed: true,
              },
              orderBy: [{ viralScore: "desc" }, { likes: "desc" }],
              take: 20,
            }),
          ])
        )
      : Promise.resolve(
          [[], [], [], [], 0, [], []] as [
            any[],
            any[],
            any[],
            any[],
            number,
            PostedMetricRow[],
            any[],
          ]
        );

    const liveTweetStatsPromise = xAccount
      ? fetchLiveTweetStats({
          xAccountId: xAccount.id,
          xUserId: xAccount.xUserId,
          xUsername: xAccount.xUsername,
          accessToken: xAccount.accessToken,
          refreshToken: xAccount.refreshToken,
          periodStart,
          periodDays,
        })
      : Promise.resolve(null);

    const [fullDbReads, liveTweetStats] = await Promise.all([
      fullDbReadsPromise,
      liveTweetStatsPromise,
    ]);

    const [
      trackedAccounts,
      draftTweets,
      scheduledTweets,
      postedTweets,
      tweetsPostedViaRadar,
      postedWithMetrics,
      viralTweets,
    ] = fullDbReads;

    const dbStats = calculateEngagementStats(postedWithMetrics);
    const dbImpressionsTrend = buildImpressionsTrend(
      periodDays,
      postedWithMetrics
        .filter((row) => row.postedAt)
        .map((row) => ({
          postedAt: row.postedAt as Date,
          impressions: row.actualImpressions ?? 0,
        }))
    );
    const avgEngagementRate =
      liveTweetStats?.stats?.avgEngagementRate ?? dbStats.avgEngagementRate;
    const avgImpressionsPerPost =
      liveTweetStats?.stats?.avgImpressionsPerPost ?? dbStats.avgImpressionsPerPost;
    const impressionsTrend = liveTweetStats?.stats?.impressionsTrend ?? dbImpressionsTrend;

    const mapDraft = (d: any) => ({
      id: d.id,
      text: d.text,
      hookType: d.hookType,
      format: d.format,
      emotionalTrigger: d.emotionalTrigger,
      viralPrediction: d.viralPrediction,
      aiReasoning: d.aiReasoning,
      threadGroupId: d.threadGroupId ?? null,
      threadOrder: d.threadOrder ?? null,
      status: d.status,
      scheduledFor: d.scheduledFor?.toISOString() ?? null,
      postedAt: d.postedAt?.toISOString() ?? null,
      postedTweetId: d.postedTweetId ?? null,
      createdAt: d.createdAt.toISOString(),
    });

    const draftsMapped = draftTweets.map(mapDraft);
    const scheduledMapped = scheduledTweets.map(mapDraft);
    const postedMapped = postedTweets.map(mapDraft);

    // Backward-compatible aggregate field used by the current UI.
    const recentDrafts = [...draftsMapped, ...scheduledMapped, ...postedMapped]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    const payload = {
      account: xAccount
        ? {
            id: xAccount.id,
            xUsername: xAccount.xUsername,
            xDisplayName: xAccount.xDisplayName,
            profileImageUrl: xAccount.profileImageUrl,
            followerCount: xAccount.followerCount,
            followingCount: xAccount.followingCount,
            isActive: xAccount.isActive,
          }
        : null,
      auth: xAccount
        ? {
            reauthRequired: liveTweetStats?.auth?.reauthRequired ?? false,
            message: liveTweetStats?.auth?.message ?? null,
            refreshedToken: liveTweetStats?.auth?.refreshedToken ?? false,
          }
        : null,
      stats: {
        periodDays,
        followerCount: xAccount?.followerCount ?? 0,
        followerGrowth7d,
        tweetsPosted: tweetsPostedViaRadar,
        actualTweetCount,
        avgEngagementRate,
        avgImpressionsPerPost,
        impressionsTrend,
      },
      trackedAccounts: trackedAccounts.map((ta) => ({
        id: ta.id,
        trackedUsername: ta.trackedUsername,
        trackedDisplayName: ta.trackedDisplayName,
        profileImageUrl: ta.profileImageUrl,
        followerCount: ta.followerCount,
        niche: ta.niche,
        viralTweetCount: ta._count.viralTweets,
      })),
      drafts: draftsMapped,
      scheduledDrafts: scheduledMapped,
      postedDrafts: postedMapped,
      recentDrafts,
      viralTweets: viralTweets.map((vt) => ({
        id: vt.id,
        trackedAccountId: vt.trackedAccountId,
        tweetId: vt.tweetId,
        text: vt.text,
        authorUsername: vt.authorUsername,
        authorDisplayName: vt.authorDisplayName,
        likes: vt.likes,
        retweets: vt.retweets,
        replies: vt.replies,
        impressions: vt.impressions,
        hookType: vt.hookType,
        format: vt.format,
        emotionalTrigger: vt.emotionalTrigger,
        viralScore: vt.viralScore,
        whyItWorked: vt.whyItWorked,
        lessonsLearned: vt.lessonsLearned,
        publishedAt: vt.publishedAt.toISOString(),
        isAnalyzed: vt.isAnalyzed,
      })),
    };
    dashboardCache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    });
    const response = NextResponse.json(payload);
    response.headers.set("Server-Timing", `snipradar_get;dur=${Date.now() - requestStartedAt}`);
    response.headers.set("X-SnipRadar-Cache", "miss");
    return response;
  } catch (error) {
    console.error("[SnipRadar API] GET error:", error);
    if (cacheKey && isDbPoolSaturationError(error)) {
      const stale = dashboardCache.get(cacheKey);
      if (stale?.data) {
        const response = NextResponse.json(stale.data);
        response.headers.set("Server-Timing", `snipradar_get;dur=${Date.now() - requestStartedAt}`);
        response.headers.set("X-SnipRadar-Cache", "stale-fallback");
        return response;
      }
      return NextResponse.json(
        requestScope === "summary"
          ? {
              account: null,
              stats: {
                periodDays: requestPeriodDays,
                followerCount: 0,
                followerGrowth7d: 0,
                tweetsPosted: 0,
                actualTweetCount: 0,
                avgEngagementRate: 0,
                avgImpressionsPerPost: 0,
                impressionsTrend: [],
              },
              counts: {
                trackedAccounts: 0,
                drafts: 0,
                scheduledDrafts: 0,
                postedDrafts: 0,
                dueScheduledDrafts: 0,
                viralTweets: 0,
                analyzedViralTweets: 0,
                activeAutoDmAutomations: 0,
              },
              degraded: true,
            }
          : {
              account: null,
              stats: {
                periodDays: requestPeriodDays,
                followerCount: 0,
                followerGrowth7d: 0,
                tweetsPosted: 0,
                actualTweetCount: 0,
                avgEngagementRate: 0,
                avgImpressionsPerPost: 0,
                impressionsTrend: [],
              },
              trackedAccounts: [],
              drafts: [],
              scheduledDrafts: [],
              postedDrafts: [],
              recentDrafts: [],
              viralTweets: [],
              degraded: true,
            }
      );
    }
    return snipradarErrorResponse("Failed to fetch dashboard data", 500);
  }
}

/**
 * POST /api/snipradar
 * Connect X account — supports two modes:
 * 1. Manual connect: { mode: "manual", username: "@handle" } — uses Bearer token lookup
 * 2. OAuth connect: { mode: "oauth" } — initiates OAuth 2.0 PKCE flow
 */
export async function POST(request: Request) {
  try {
    const requestStartedAt = Date.now();
    const user = await getCurrentUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const body = await request.json().catch(() => ({}));
    const mode = body.mode ?? "manual";

    // Background refresh mode: update account stats + snapshot + hydrate recent posted metrics.
    if (mode === "refresh") {
      const refreshStartedAt = Date.now();
      const currentLock = refreshLocks.get(user.id);
      if (currentLock && Date.now() - currentLock < REFRESH_LOCK_TTL_MS) {
        return NextResponse.json({
          success: true,
          refreshed: false,
          hydratedMetrics: 0,
          skipped: "refresh_in_progress",
        });
      }
      refreshLocks.set(user.id, Date.now());
      try {
        const xAccount = await prisma.xAccount.findFirst({
          where: { userId: user.id, isActive: true },
          include: {
            snapshots: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        if (!xAccount) {
          return NextResponse.json({ success: true, refreshed: false, reason: "not_connected" });
        }

        let refreshedAccount = false;
        let hydratedMetrics = 0;
        let accountRefreshDurationMs = 0;
        let metricsHydrationDurationMs = 0;

        try {
          const accountRefreshStart = Date.now();
          const shouldRefreshAccount =
            Date.now() - new Date(xAccount.updatedAt).getTime() >=
            ACCOUNT_REFRESH_MIN_INTERVAL_MS;

          if (shouldRefreshAccount) {
            const freshData = await lookupUser(xAccount.xUsername);
            if (freshData) {
              const nextFollowerCount =
                freshData.public_metrics?.followers_count ?? xAccount.followerCount;
              const nextFollowingCount =
                freshData.public_metrics?.following_count ?? xAccount.followingCount;
              const nextTweetCount = freshData.public_metrics?.tweet_count ?? 0;

              await prisma.xAccount.update({
                where: { id: xAccount.id },
                data: {
                  followerCount: nextFollowerCount,
                  followingCount: nextFollowingCount,
                  profileImageUrl: freshData.profile_image_url ?? xAccount.profileImageUrl,
                },
              });

              const latestSnapshot = xAccount.snapshots[0];
              const now = new Date();
              const oneDayMs = 24 * 60 * 60 * 1000;
              const shouldCreateSnapshot =
                !latestSnapshot ||
                now.getTime() - latestSnapshot.createdAt.getTime() >= oneDayMs ||
                latestSnapshot.followerCount !== nextFollowerCount ||
                latestSnapshot.followingCount !== nextFollowingCount;

              if (shouldCreateSnapshot) {
                await prisma.xAccountSnapshot.create({
                  data: {
                    xAccountId: xAccount.id,
                    followerCount: nextFollowerCount,
                    followingCount: nextFollowingCount,
                    tweetCount: nextTweetCount,
                    followerGrowth: latestSnapshot
                      ? nextFollowerCount - latestSnapshot.followerCount
                      : 0,
                  },
                });
              }

              refreshedAccount = true;
            }
          }
          accountRefreshDurationMs = Date.now() - accountRefreshStart;
        } catch {
          // Non-critical; continue to metrics hydration.
        }

        const metricsHydrationStart = Date.now();
        const metricsStaleBefore = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const postedMissingMetrics = await prisma.tweetDraft.findMany({
          where: {
            userId: user.id,
            xAccountId: xAccount.id,
            status: "posted",
            postedTweetId: { not: null },
            OR: [
              { actualImpressions: null },
              { actualImpressions: { lte: 0 } },
              { updatedAt: { lte: metricsStaleBefore } },
            ],
          },
          select: { id: true, postedTweetId: true },
          orderBy: { postedAt: "desc" },
          take: 15,
        });

        const hydrationResults = await mapWithConcurrency(
          postedMissingMetrics,
          3,
          async (draft) => {
            if (!draft.postedTweetId) return false;
            try {
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
            } catch {
              // Non-critical.
              return false;
            }
          }
        );
        hydratedMetrics = hydrationResults.filter(Boolean).length;
        metricsHydrationDurationMs = Date.now() - metricsHydrationStart;
        const totalDurationMs = Date.now() - refreshStartedAt;

        console.info("[SnipRadar Refresh] completed", {
          userId: user.id,
          accountId: xAccount.id,
          refreshedAccount,
          hydratedMetrics,
          pendingMetricsChecked: postedMissingMetrics.length,
          accountRefreshDurationMs,
          metricsHydrationDurationMs,
          totalDurationMs,
        });

        const response = NextResponse.json({
          success: true,
          refreshed: refreshedAccount,
          hydratedMetrics,
          durationMs: totalDurationMs,
        });
        response.headers.set("Server-Timing", `snipradar_refresh;dur=${Date.now() - requestStartedAt}`);
        return response;
      } finally {
        refreshLocks.delete(user.id);
      }
    }

    // Manual connect (Bearer token lookup)
    if (mode === "manual") {
      const username = (body.username as string | undefined)?.replace("@", "").trim();
      if (!username) {
        return NextResponse.json({ error: "Username is required" }, { status: 400 });
      }

      const xUser = await lookupUser(username);
      if (!xUser) {
        return NextResponse.json(
          { error: `Could not find X account @${username}. Please check the handle.` },
          { status: 404 }
        );
      }

      const xAccount = await prisma.xAccount.upsert({
        where: {
          userId_xUserId: { userId: user.id, xUserId: xUser.id },
        },
        update: {
          xUsername: xUser.username,
          xDisplayName: xUser.name,
          profileImageUrl: xUser.profile_image_url ?? null,
          followerCount: xUser.public_metrics?.followers_count ?? 0,
          followingCount: xUser.public_metrics?.following_count ?? 0,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          xUserId: xUser.id,
          xUsername: xUser.username,
          xDisplayName: xUser.name,
          profileImageUrl: xUser.profile_image_url ?? null,
          followerCount: xUser.public_metrics?.followers_count ?? 0,
          followingCount: xUser.public_metrics?.following_count ?? 0,
          accessToken: "bearer-only",
          isActive: true,
        },
      });

      await prisma.xAccountSnapshot.create({
        data: {
          xAccountId: xAccount.id,
          followerCount: xUser.public_metrics?.followers_count ?? 0,
          followingCount: xUser.public_metrics?.following_count ?? 0,
          tweetCount: xUser.public_metrics?.tweet_count ?? 0,
        },
      });

      await recordActivationCheckpointSafe({
        userId: user.id,
        checkpoint: "snipradar_x_account_connected",
        metadata: {
          source: "manual_connect",
          xUsername: xUser.username,
        },
      });

      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { selectedNiche: true },
      });
      const seeded = await seedStarterTrackedAccountsForUser({
        userId: user.id,
        xAccountId: xAccount.id,
        selectedNiche: profile?.selectedNiche ?? null,
      });

      return NextResponse.json({
        success: true,
        username: xUser.username,
        seededStarterAccounts: seeded.seeded,
      });
    }

    // OAuth connect
    const clientId = process.env.X_CLIENT_ID;
    const redirectUri = process.env.X_CALLBACK_URL;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "X API not configured. Please set X_CLIENT_ID and X_CALLBACK_URL." },
        { status: 503 }
      );
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const cookieStore = await cookies();
    cookieStore.set("x_oauth_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
      sameSite: "lax",
    });
    cookieStore.set("x_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
      sameSite: "lax",
    });

    const authUrl = buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("[SnipRadar API] POST error:", error);
    return snipradarErrorResponse("Failed to connect X account", 500);
  }
}

/**
 * DELETE /api/snipradar
 * Soft-disconnect the user's X account (deactivates but preserves all data)
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!xAccount) {
      return snipradarErrorResponse("No X account connected", 404);
    }

    // Soft disconnect: deactivate and clear tokens, but keep all data intact
    await prisma.xAccount.update({
      where: { id: xAccount.id },
      data: {
        isActive: false,
        accessToken: "",
        refreshToken: null,
        tokenExpiresAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SnipRadar API] DELETE error:", error);
    return snipradarErrorResponse("Failed to disconnect X account", 500);
  }
}
