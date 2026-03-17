export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { incrementUsage } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getUserTweets, getMediaType } from "@/lib/integrations/x-api";
import { snipradarErrorResponse, withSnipRadarErrorContract } from "@/lib/snipradar/api-errors";
import { requireSnipRadarUsage } from "@/lib/snipradar/billing-gates-server";
import { withDbPoolRetry } from "@/lib/snipradar/db-resilience";

/**
 * Calculate if a tweet is viral based on engagement rate and account size
 */
function calculateViralMetrics(params: {
  likes: number;
  retweets: number;
  replies: number;
  followerCount: number;
}): { isViral: boolean; engagementRate: number; score: number } {
  const { likes, retweets, replies, followerCount } = params;

  // Weighted engagement (retweets and replies are more valuable than likes)
  const weightedEngagement = likes + retweets * 2 + replies * 3;

  // Calculate engagement rate (% of followers who engaged)
  const engagementRate =
    followerCount > 0 ? weightedEngagement / followerCount : 0;

  // Dynamic viral threshold based on account size
  let viralThreshold: number;
  if (followerCount > 1_000_000) {
    viralThreshold = 0.003; // 0.3% for mega accounts (1M+)
  } else if (followerCount > 100_000) {
    viralThreshold = 0.002; // 0.2% for large accounts (100K-1M)
  } else if (followerCount > 10_000) {
    viralThreshold = 0.008; // 0.8% for medium accounts (10K-100K)
  } else if (followerCount > 1_000) {
    viralThreshold = 0.02; // 2% for small-medium accounts (1K-10K)
  } else {
    viralThreshold = 0.05; // 5% for very small accounts (<1K)
  }

  // Minimum absolute engagement to avoid false positives
  const minAbsoluteEngagement = followerCount > 100_000 ? 200 : followerCount > 10_000 ? 100 : 50;
  const meetsAbsoluteThreshold = weightedEngagement >= minAbsoluteEngagement;

  // Tweet is viral if it meets BOTH the rate threshold AND absolute threshold
  const isViral = engagementRate >= viralThreshold && meetsAbsoluteThreshold;

  // Calculate a 0-100 score for ranking
  const scoreMultiplier = engagementRate / viralThreshold;
  const score = Math.min(100, Math.round(scoreMultiplier * 50));

  return {
    isViral,
    engagementRate: Math.round(engagementRate * 10000) / 100,
    score: isViral ? Math.max(score, 1) : 0,
  };
}

/**
 * GET /api/snipradar/viral
 * Fetch viral tweets feed with analysis
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") ?? "all";
    const sort = url.searchParams.get("sort") ?? "score";
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(limitRaw !== null ? (Number(limitRaw) || 20) : 20, 50);

    const xAccount = await withDbPoolRetry("viral.get.find-active-account", () =>
      prisma.xAccount.findFirst({
        where: { userId: user.id, isActive: true },
      })
    );

    if (!xAccount) {
      return NextResponse.json({ tweets: [] });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const where: any = {
      trackedAccount: {
        userId: user.id,
        xAccountId: xAccount.id,
        isActive: true,
      },
      publishedAt: { gte: sevenDaysAgo },
    };

    if (filter === "analyzed") where.isAnalyzed = true;
    if (filter === "unanalyzed") where.isAnalyzed = false;

    const orderBy: any =
      sort === "likes"
        ? { likes: "desc" }
        : sort === "recent"
          ? { publishedAt: "desc" }
          : [{ viralScore: "desc" }, { likes: "desc" }];

    const tweets = await withDbPoolRetry("viral.get.find-feed", () =>
      prisma.viralTweet.findMany({
        where,
        orderBy,
        take: limit,
        include: {
          trackedAccount: {
            select: {
              trackedUsername: true,
              trackedDisplayName: true,
              profileImageUrl: true,
            },
          },
        },
      })
    );

    return NextResponse.json({
      tweets: tweets.map((t) => ({
        id: t.id,
        tweetId: t.tweetId,
        text: t.text,
        authorUsername: t.authorUsername,
        authorDisplayName: t.authorDisplayName,
        trackedAccountImage: t.trackedAccount.profileImageUrl,
        likes: t.likes,
        retweets: t.retweets,
        replies: t.replies,
        impressions: t.impressions,
        bookmarks: t.bookmarks,
        quoteTweets: t.quoteTweets,
        mediaType: t.mediaType,
        hookType: t.hookType,
        format: t.format,
        emotionalTrigger: t.emotionalTrigger,
        viralScore: t.viralScore,
        whyItWorked: t.whyItWorked,
        lessonsLearned: t.lessonsLearned,
        publishedAt: t.publishedAt.toISOString(),
        isAnalyzed: t.isAnalyzed,
      })),
    });
  } catch (error) {
    console.error("[SnipRadar Viral] GET error:", error);
    return snipradarErrorResponse("Failed to fetch viral tweets", 500);
  }
}

/**
 * POST /api/snipradar/viral
 * Manually trigger fetching viral tweets from tracked accounts
 * Fetches recent tweets per account and stores only those detected as viral
 */
export async function POST(request: Request) {
  try {
    const requestStartedAt = Date.now();
    const user = await getCurrentUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const xAccount = await withDbPoolRetry("viral.post.find-active-account", () =>
      prisma.xAccount.findFirst({
        where: { userId: user.id, isActive: true },
      })
    );

    if (!xAccount) {
      return snipradarErrorResponse("Please connect your X account first.", 400);
    }

    const viralFetchGate = await requireSnipRadarUsage(user.id, "viral_fetch", {
      feature: "viralFeed",
      message: "You have used all viral feed refreshes included in your current plan this month.",
    });
    if (!viralFetchGate.ok) {
      return viralFetchGate.response;
    }

    const body = await request.json().catch(() => ({}));
    const trackedAccountIds =
      Array.isArray(body?.trackedAccountIds) && body.trackedAccountIds.length > 0
        ? (body.trackedAccountIds as string[])
        : null;

    const trackedAccounts = await withDbPoolRetry("viral.post.find-tracked-accounts", () =>
      prisma.xTrackedAccount.findMany({
        where: {
          userId: user.id,
          xAccountId: xAccount.id,
          isActive: true,
          ...(trackedAccountIds ? { id: { in: trackedAccountIds } } : {}),
        },
      })
    );

    if (trackedAccounts.length === 0) {
      return snipradarErrorResponse(
        "No tracked accounts. Add accounts to track first.",
        400
      );
    }

    let totalFetched = 0;
    const accountResults: Array<{
      accountId: string;
      username: string;
      fetchedTweets: number;
      viralDetected: number;
      savedTweets: number;
      fallbackSaved: number;
      error: string | null;
    }> = [];

    // Slightly wider window to reduce false "no data" perception on quieter accounts
    const lookbackHours = 7 * 24;
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - lookbackHours);
    const maxTweetsPerAccount = 50;

    for (const tracked of trackedAccounts) {
      let fetchedTweets = 0;
      let viralDetected = 0;
      let savedTweets = 0;
      let fallbackSaved = 0;
      let accountError: string | null = null;

      try {
        const response = await getUserTweets({
          userId: tracked.trackedXUserId,
          maxResults: maxTweetsPerAccount,
          startTime,
        });

        fetchedTweets = response.data?.length ?? 0;

        if (!response.data?.length) {
          accountResults.push({
            accountId: tracked.id,
            username: tracked.trackedUsername,
            fetchedTweets,
            viralDetected,
            savedTweets,
            fallbackSaved,
            error: null,
          });
          continue;
        }

        // Filter by viral detection algorithm
        const scoredTweets = response.data
          .map((tweet) => {
            const metrics = calculateViralMetrics({
              likes: tweet.public_metrics?.like_count ?? 0,
              retweets: tweet.public_metrics?.retweet_count ?? 0,
              replies: tweet.public_metrics?.reply_count ?? 0,
              followerCount: tracked.followerCount,
            });
            return { tweet, metrics };
          });

        const viralTweets = scoredTweets.filter((item) => item.metrics.isViral);

        viralDetected = viralTweets.length;

        const tweetsToPersist =
          viralTweets.length > 0
            ? viralTweets
            : scoredTweets
                // Fallback: keep top high-engagement tweets so feed doesn't appear empty.
                .sort((a, b) => {
                  const aWeighted =
                    (a.tweet.public_metrics?.like_count ?? 0) +
                    (a.tweet.public_metrics?.retweet_count ?? 0) * 2 +
                    (a.tweet.public_metrics?.reply_count ?? 0) * 3;
                  const bWeighted =
                    (b.tweet.public_metrics?.like_count ?? 0) +
                    (b.tweet.public_metrics?.retweet_count ?? 0) * 2 +
                    (b.tweet.public_metrics?.reply_count ?? 0) * 3;
                  return bWeighted - aWeighted;
                })
                .slice(0, 3);

        if (viralTweets.length === 0) {
          fallbackSaved = tweetsToPersist.length;
        }

        for (const item of tweetsToPersist) {
          const { tweet, metrics } = item;
          const mediaType = getMediaType(tweet, response.includes?.media);
          const fallbackScore = Math.max(
            1,
            Math.round(
              ((tweet.public_metrics?.like_count ?? 0) +
                (tweet.public_metrics?.retweet_count ?? 0) * 2 +
                (tweet.public_metrics?.reply_count ?? 0) * 3) /
                Math.max(10, tracked.followerCount) *
                1000
            )
          );
          const finalScore = metrics.isViral
            ? metrics.score
            : Math.min(60, fallbackScore);

          await withDbPoolRetry("viral.post.upsert-tweet", () =>
            prisma.viralTweet.upsert({
              where: { tweetId: tweet.id },
              update: {
                likes: tweet.public_metrics?.like_count ?? 0,
                retweets: tweet.public_metrics?.retweet_count ?? 0,
                replies: tweet.public_metrics?.reply_count ?? 0,
                impressions: tweet.public_metrics?.impression_count ?? 0,
                bookmarks: tweet.public_metrics?.bookmark_count ?? 0,
                quoteTweets: tweet.public_metrics?.quote_count ?? 0,
                viralScore: finalScore,
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
                viralScore: finalScore,
                publishedAt: new Date(tweet.created_at),
              },
            })
          );

          totalFetched++;
          savedTweets++;
        }
      } catch (err: any) {
        accountError = err?.message ?? "Unknown fetch error";
        console.error(
          `[SnipRadar] Failed to fetch tweets for @${tracked.trackedUsername}:`,
          err?.message ?? err
        );
      }

      accountResults.push({
        accountId: tracked.id,
        username: tracked.trackedUsername,
        fetchedTweets,
        viralDetected,
        savedTweets,
        fallbackSaved,
        error: accountError,
      });
    }

    await incrementUsage(user.id, "viral_fetch", 1);

    const response = NextResponse.json({
      success: true,
      fetched: totalFetched,
      processedAccounts: trackedAccounts.length,
      accountResults,
    });
    response.headers.set("Server-Timing", `snipradar_viral_fetch;dur=${Date.now() - requestStartedAt}`);
    return response;
  } catch (error) {
    console.error("[SnipRadar Viral] POST error:", error);
    return NextResponse.json(
      withSnipRadarErrorContract({ error: "Failed to fetch viral tweets" }, 500),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/snipradar/viral
 * Clear all viral tweets from the DB for this user's tracked accounts.
 * Used after draft generation to clean up the feed.
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const xAccount = await withDbPoolRetry("viral.delete.find-active-account", () =>
      prisma.xAccount.findFirst({
        where: { userId: user.id, isActive: true },
      })
    );

    if (!xAccount) {
      return NextResponse.json({ deleted: 0 });
    }

    // Get all tracked account IDs for this user
    const trackedAccounts = await withDbPoolRetry("viral.delete.find-tracked", () =>
      prisma.xTrackedAccount.findMany({
        where: { userId: user.id, xAccountId: xAccount.id },
        select: { id: true },
      })
    );

    if (trackedAccounts.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const trackedIds = trackedAccounts.map((a) => a.id);

    const result = await withDbPoolRetry("viral.delete.bulk-delete", () =>
      prisma.viralTweet.deleteMany({
        where: { trackedAccountId: { in: trackedIds } },
      })
    );

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("[SnipRadar Viral] DELETE error:", error);
    return snipradarErrorResponse("Failed to clear viral tweets", 500);
  }
}
