export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequiredPlanForFeature } from "@/lib/billing/access";
import { prisma } from "@/lib/prisma";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import {
  getAnalyticsWindowDaysFromState,
  getNextBillingPlan,
} from "@/lib/snipradar/billing-gates";
import { withSnipRadarErrorContract } from "@/lib/snipradar/api-errors";
import { loadSnipRadarBillingState } from "@/lib/snipradar/billing-gates-server";
import { isDbPoolSaturationError, withDbPoolRetry } from "@/lib/snipradar/db-resilience";
import { lookupUserById } from "@/lib/integrations/x-api";
import {
  buildAiSummary,
  buildSummary,
  derivePatternBreakdowns,
  deriveTopPostTypes,
  selectBestPerformingTweet,
  type AnalyticsTweetRow,
} from "@/lib/snipradar/analytics";
import { getUserTweetsWithAutoRefresh } from "@/lib/snipradar/x-auth";

const metricsCache = new Map<string, { data: unknown; expiresAt: number }>();
const METRICS_CACHE_TTL_MS = 30_000;

const MAX_PERIOD_DAYS = 30;
const MIN_PERIOD_DAYS = 7;

function parsePeriodDays(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(MIN_PERIOD_DAYS, Math.min(MAX_PERIOD_DAYS, Math.round(parsed)));
}

/**
 * GET /api/snipradar/metrics
 * Growth metrics and posted tweet performance
 */
export async function GET(req: NextRequest) {
  const requestStartedAt = Date.now();
  let cacheKey = "";
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
      attachServerTiming(response, "snipradar_metrics", requestStartedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/metrics",
        method: "GET",
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
    const periodDays = parsePeriodDays(req.nextUrl.searchParams.get("periodDays"));
    const billingState = await loadSnipRadarBillingState(user.id);
    const analyticsWindowDays = getAnalyticsWindowDaysFromState(billingState);

    if (analyticsWindowDays === 0) {
      return respond(
        {
          error: "Analytics is available on Pro plans.",
          code: "UPGRADE_REQUIRED",
          retryable: false,
          details: {
            kind: "upgrade_required",
            feature: "analytics",
            currentPlan: billingState.plan.id,
            requiredPlan: getRequiredPlanForFeature("analytics"),
            upgradePlan: getNextBillingPlan(billingState.plan.id),
            analyticsWindowDays,
          },
        },
        403,
        { analyticsWindowDays }
      );
    }

    if (periodDays > analyticsWindowDays) {
      return respond(
        {
          error: `${billingState.plan.name} includes ${analyticsWindowDays}-day analytics. Upgrade for the 30-day window.`,
          code: "UPGRADE_REQUIRED",
          retryable: false,
          details: {
            kind: "upgrade_required",
            feature: "analytics",
            currentPlan: billingState.plan.id,
            requiredPlan: getRequiredPlanForFeature("analytics"),
            upgradePlan: getNextBillingPlan(billingState.plan.id),
            analyticsWindowDays,
            suggestedPeriodDays: analyticsWindowDays,
          },
        },
        403,
        { analyticsWindowDays, requestedPeriodDays: periodDays }
      );
    }

    cacheKey = `${user.id}:${periodDays}`;
    const cached = metricsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return respond(cached.data, 200, { cache: "hit", periodDays });
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    const xAccount = await withDbPoolRetry("metrics.find-active-account", () =>
      prisma.xAccount.findFirst({
        where: { userId: user.id, isActive: true },
      })
    );

    if (!xAccount) {
      return respond({
        periodDays,
        auth: null,
        summary: {
          accountTweetCount: 0,
          totalRadarPosts: 0,
          totalImpressions: 0,
          totalEngagement: 0,
          avgEngagementRate: 0,
          windowPostsTracked: 0,
          windowRepliesTracked: 0,
          avgImpressionsPerPost: 0,
          avgImpressionsPerReply: 0,
        },
        growthChart: [],
        postedTweets: [],
        replyTweets: [],
        sources: {
          summary: "none",
          posts: "none",
          replies: "none",
          summarySampleSize: 0,
          livePostsSampleSize: 0,
          liveRepliesSampleSize: 0,
          patternSource: "none",
        },
        aiSummary: { text: "No metrics available yet.", confidence: "low" as const },
        topPostTypes: [],
        bestPerforming: null,
        hookTypeBreakdown: {},
        formatBreakdown: {},
        emotionBreakdown: {},
      });
    }

    const userAccessToken =
      xAccount.accessToken && xAccount.accessToken !== "bearer-only"
        ? xAccount.accessToken
        : undefined;

    // Growth chart, local DB analytics, and live X reads in parallel.
    const dbReadsPromise = withDbPoolRetry("metrics.fetch-db-reads", () =>
      Promise.all([
        prisma.xAccountSnapshot.findMany({
          where: {
            xAccountId: xAccount.id,
            createdAt: { gte: periodStart },
          },
          orderBy: { createdAt: "asc" },
          take: 30,
        }),
        prisma.xAccountSnapshot.findFirst({
          where: { xAccountId: xAccount.id },
          orderBy: { createdAt: "desc" },
          select: { tweetCount: true },
        }),
        prisma.tweetDraft.findMany({
          where: {
            userId: user.id,
            xAccountId: xAccount.id,
            status: "posted",
            postedAt: { gte: periodStart },
          },
          orderBy: { postedAt: "desc" },
          take: 50,
        }),
        prisma.tweetDraft.aggregate({
          where: {
            userId: user.id,
            xAccountId: xAccount.id,
            status: "posted",
            postedAt: { gte: periodStart },
          },
          _count: { _all: true },
          _sum: {
            actualLikes: true,
            actualRetweets: true,
            actualReplies: true,
            actualImpressions: true,
          },
        }),
      ])
    );

    const [dbReads, liveUser, liveTweetsResult] = await Promise.all([
      dbReadsPromise,
      lookupUserById(xAccount.xUserId, userAccessToken),
      getUserTweetsWithAutoRefresh({
        account: {
          id: xAccount.id,
          xUserId: xAccount.xUserId,
          xUsername: xAccount.xUsername,
          accessToken: xAccount.accessToken,
          refreshToken: xAccount.refreshToken,
        },
        maxResults: 100,
        startTime: periodStart,
        includeReplies: true,
      }),
    ]);

    const [snapshots, latestSnapshot, postedTweets, postedAggregate] = dbReads;

    const liveTweetsResponse = liveTweetsResult.response;

    const dbPostedTweets: AnalyticsTweetRow[] = postedTweets.map((d) => ({
      id: d.id,
      tweetId: d.postedTweetId ?? null,
      tweetUrl: d.postedTweetId ? `https://x.com/i/web/status/${d.postedTweetId}` : null,
      text: d.text,
      hookType: d.hookType,
      format: d.format,
      emotionalTrigger: d.emotionalTrigger,
      viralPrediction: d.viralPrediction,
      postType: "post",
      postedAt: d.postedAt?.toISOString() ?? null,
      actualLikes: d.actualLikes,
      actualRetweets: d.actualRetweets,
      actualReplies: d.actualReplies,
      actualImpressions: d.actualImpressions,
    }));

    const radarByPostedTweetId = new Map(
      postedTweets
        .filter((d) => Boolean(d.postedTweetId))
        .map((d) => [d.postedTweetId as string, d])
    );

    const liveAllTweets: AnalyticsTweetRow[] = (liveTweetsResponse.data ?? []).map((tweet) => {
      const metrics = tweet.public_metrics;
      const linkedDraft = radarByPostedTweetId.get(tweet.id);
      const isReply =
        tweet.referenced_tweets?.some((reference) => reference.type === "replied_to") ?? false;
      return {
        id: linkedDraft?.id ?? `live-${tweet.id}`,
        tweetId: tweet.id,
        tweetUrl: `https://x.com/i/web/status/${tweet.id}`,
        text: linkedDraft?.text ?? tweet.text,
        hookType: linkedDraft?.hookType ?? null,
        format: linkedDraft?.format ?? null,
        emotionalTrigger: linkedDraft?.emotionalTrigger ?? null,
        viralPrediction: linkedDraft?.viralPrediction ?? null,
        postType: isReply ? "reply" : "post",
        postedAt: tweet.created_at ?? linkedDraft?.postedAt?.toISOString() ?? null,
        actualLikes: metrics?.like_count ?? linkedDraft?.actualLikes ?? 0,
        actualRetweets: metrics?.retweet_count ?? linkedDraft?.actualRetweets ?? 0,
        actualReplies: metrics?.reply_count ?? linkedDraft?.actualReplies ?? 0,
        actualImpressions: metrics?.impression_count ?? linkedDraft?.actualImpressions ?? 0,
      };
    });

    const livePostedTweets = liveAllTweets.filter((tweet) => tweet.postType === "post");
    const liveReplyTweets = liveAllTweets.filter((tweet) => tweet.postType === "reply");

    const tweetsForSummary = livePostedTweets.filter((t) => (t.actualImpressions ?? 0) > 0);
    const dbTweetsForSummary = dbPostedTweets.filter((t) => (t.actualImpressions ?? 0) > 0);
    const summarySource = tweetsForSummary.length > 0 ? tweetsForSummary : dbTweetsForSummary;
    const summarySourceType =
      tweetsForSummary.length > 0
        ? "live_x"
        : dbTweetsForSummary.length > 0
          ? "db_posted_drafts"
          : "none";

    const totalRadarPosts = postedAggregate._count._all;
    const accountTweetCount =
      liveUser?.public_metrics?.tweet_count ?? latestSnapshot?.tweetCount ?? 0;

    const postedTweetsForUi = (livePostedTweets.length > 0 ? livePostedTweets : dbPostedTweets)
      .slice()
      .sort((a, b) => {
        const aTs = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const bTs = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return bTs - aTs;
      })
      .slice(0, 60);
    const postsSourceType =
      livePostedTweets.length > 0 ? "live_x" : dbPostedTweets.length > 0 ? "db_posted_drafts" : "none";

    const replyTweetsForUi = liveReplyTweets
      .slice()
      .sort((a, b) => {
        const aTs = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const bTs = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return bTs - aTs;
      })
      .slice(0, 60);
    const repliesSourceType = liveReplyTweets.length > 0 ? "live_x" : "none";
    const bestPerforming = selectBestPerformingTweet(postedTweetsForUi);
    const patternSourceTweets = postedTweetsForUi.length > 0 ? postedTweetsForUi : summarySource;
    const { hookTypeBreakdown, formatBreakdown, emotionBreakdown } =
      derivePatternBreakdowns(patternSourceTweets);
    const topPostTypes = deriveTopPostTypes(postedTweetsForUi);
    const growthChart = snapshots.map((s) => ({
      date: s.createdAt.toISOString(),
      followers: s.followerCount,
      following: s.followingCount,
      tweets: s.tweetCount,
      growth: s.followerGrowth,
    }));
    const aiSummary = buildAiSummary({
      growthChart,
      postedTweets: postedTweetsForUi,
      replyTweets: replyTweetsForUi,
    });
    const summary = buildSummary({
      accountTweetCount,
      totalRadarPosts,
      postedTweets: postedTweetsForUi,
      replyTweets: replyTweetsForUi,
      summaryTweets: summarySource,
    });

    const payload = {
      periodDays,
      auth: {
        reauthRequired: liveTweetsResult.reauthRequired,
        message: liveTweetsResult.authMessage,
        refreshedToken: liveTweetsResult.refreshedToken,
      },
      summary,
      growthChart,
      postedTweets: postedTweetsForUi,
      replyTweets: replyTweetsForUi,
      sources: {
        summary: summarySourceType,
        posts: postsSourceType,
        replies: repliesSourceType,
        summarySampleSize: summarySource.length,
        livePostsSampleSize: livePostedTweets.length,
        liveRepliesSampleSize: liveReplyTweets.length,
        patternSource:
          patternSourceTweets.length > 0
            ? postsSourceType === "live_x"
              ? "live_x_posts"
              : "db_posted_drafts"
            : "none",
      },
      aiSummary,
      topPostTypes,
      bestPerforming: bestPerforming
        ? {
            id: bestPerforming.id,
            tweetId: bestPerforming.tweetId,
            tweetUrl: bestPerforming.tweetUrl,
            text: bestPerforming.text,
            actualLikes: bestPerforming.actualLikes,
            actualRetweets: bestPerforming.actualRetweets,
            actualReplies: bestPerforming.actualReplies,
            actualImpressions: bestPerforming.actualImpressions,
          }
        : null,
      hookTypeBreakdown,
      formatBreakdown,
      emotionBreakdown,
    };
    metricsCache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + METRICS_CACHE_TTL_MS,
    });
    return respond(payload, 200, { cache: "miss", periodDays });
  } catch (error) {
    console.error("[SnipRadar Metrics] GET error:", error);
    if (cacheKey && isDbPoolSaturationError(error)) {
      const stale = metricsCache.get(cacheKey);
      if (stale?.data) {
        const response = NextResponse.json(stale.data);
        attachServerTiming(response, "snipradar_metrics", requestStartedAt);
        logSnipRadarApiTelemetry({
          route: "/api/snipradar/metrics",
          method: "GET",
          status: 200,
          durationMs: Date.now() - requestStartedAt,
          meta: { cache: "stale-fallback", degraded: true },
        });
        return response;
      }
      const busy = NextResponse.json({
        periodDays: 30,
        summary: {
          accountTweetCount: 0,
          totalRadarPosts: 0,
          totalImpressions: 0,
          totalEngagement: 0,
          avgEngagementRate: 0,
          windowPostsTracked: 0,
          windowRepliesTracked: 0,
          avgImpressionsPerPost: 0,
          avgImpressionsPerReply: 0,
        },
        growthChart: [],
        postedTweets: [],
        replyTweets: [],
        sources: {
          summary: "none",
          posts: "none",
          replies: "none",
          summarySampleSize: 0,
          livePostsSampleSize: 0,
          liveRepliesSampleSize: 0,
          patternSource: "none",
        },
        bestPerforming: null,
        hookTypeBreakdown: {},
        formatBreakdown: {},
        emotionBreakdown: {},
        aiSummary: { text: "No metrics available yet.", confidence: "low" },
        topPostTypes: [],
        degraded: true,
      });
      attachServerTiming(busy, "snipradar_metrics", requestStartedAt);
      logSnipRadarApiTelemetry({
        route: "/api/snipradar/metrics",
        method: "GET",
        status: 200,
        durationMs: Date.now() - requestStartedAt,
        meta: { cache: "degraded-fallback", error: "DB_POOL_SATURATED", degraded: true },
      });
      return busy;
    }
    const response = NextResponse.json(
      withSnipRadarErrorContract({ error: "Failed to fetch metrics" }, 500),
      { status: 500 }
    );
    attachServerTiming(response, "snipradar_metrics", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/metrics",
      method: "GET",
      status: 500,
      durationMs: Date.now() - requestStartedAt,
      meta: { error: "GET_FAILED" },
    });
    return response;
  }
}
