export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/snipradar/accounts/[id]/details
 * Get detailed analytics for a tracked account
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")), 50);
    const skip = (page - 1) * limit;

    // Get tracked account with paginated viral tweets
    const tracked = await prisma.xTrackedAccount.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      include: {
        viralTweets: {
          orderBy: [{ viralScore: "desc" }, { likes: "desc" }],
          skip,
          take: limit,
        },
      },
    });

    if (!tracked) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Get total count for pagination (separate query since tweets are paginated)
    const totalTweetsCount = await prisma.viralTweet.count({
      where: { trackedAccountId: tracked.id },
    });

    // Use aggregation for analytics instead of loading all tweets into memory
    const aggregation = await prisma.viralTweet.aggregate({
      where: { trackedAccountId: tracked.id },
      _sum: { likes: true, retweets: true, replies: true, impressions: true, viralScore: true },
      _avg: { likes: true, retweets: true, replies: true, viralScore: true },
      _count: true,
    });

    const analyzedCount = await prisma.viralTweet.count({
      where: { trackedAccountId: tracked.id, isAnalyzed: true },
    });

    // Calculate analytics
    const totalTweets = aggregation._count;
    const analyzedTweets = analyzedCount;

    // Total engagement (from aggregation)
    const totalLikes = aggregation._sum.likes ?? 0;
    const totalRetweets = aggregation._sum.retweets ?? 0;
    const totalReplies = aggregation._sum.replies ?? 0;
    const totalImpressions = aggregation._sum.impressions ?? 0;

    // Average engagement (from aggregation)
    const avgLikes = Math.round(aggregation._avg.likes ?? 0);
    const avgRetweets = Math.round(aggregation._avg.retweets ?? 0);
    const avgReplies = Math.round(aggregation._avg.replies ?? 0);
    const avgViralScore = Math.round(aggregation._avg.viralScore ?? 0);

    // Pattern distributions via groupBy for accuracy across all tweets
    const [hookGroups, formatGroups, emotionGroups, mediaGroups] = await Promise.all([
      prisma.viralTweet.groupBy({
        by: ["hookType"],
        where: { trackedAccountId: tracked.id, hookType: { not: null } },
        _count: true,
      }),
      prisma.viralTweet.groupBy({
        by: ["format"],
        where: { trackedAccountId: tracked.id, format: { not: null } },
        _count: true,
      }),
      prisma.viralTweet.groupBy({
        by: ["emotionalTrigger"],
        where: { trackedAccountId: tracked.id, emotionalTrigger: { not: null } },
        _count: true,
      }),
      prisma.viralTweet.groupBy({
        by: ["mediaType"],
        where: { trackedAccountId: tracked.id },
        _count: true,
      }),
    ]);

    const hookTypes: Record<string, number> = {};
    for (const g of hookGroups) {
      if (g.hookType) hookTypes[g.hookType] = g._count;
    }

    const formats: Record<string, number> = {};
    for (const g of formatGroups) {
      if (g.format) formats[g.format] = g._count;
    }

    const emotions: Record<string, number> = {};
    for (const g of emotionGroups) {
      if (g.emotionalTrigger) emotions[g.emotionalTrigger] = g._count;
    }

    const mediaTypes: Record<string, number> = {};
    for (const g of mediaGroups) {
      mediaTypes[g.mediaType || "text-only"] = g._count;
    }

    // Top performing tweets (by viral score) — separate query for accuracy
    const topTweets = await prisma.viralTweet.findMany({
      where: { trackedAccountId: tracked.id, viralScore: { gt: 0 } },
      orderBy: [{ viralScore: "desc" }, { likes: "desc" }],
      take: 10,
    });

    return NextResponse.json({
      account: {
        id: tracked.id,
        trackedUsername: tracked.trackedUsername,
        trackedDisplayName: tracked.trackedDisplayName,
        profileImageUrl: tracked.profileImageUrl,
        followerCount: tracked.followerCount,
        niche: tracked.niche,
        createdAt: tracked.createdAt.toISOString(),
      },
      analytics: {
        totalTweets,
        analyzedTweets,
        analysisProgress: totalTweets > 0 ? Math.round((analyzedTweets / totalTweets) * 100) : 0,
        totalEngagement: {
          likes: totalLikes,
          retweets: totalRetweets,
          replies: totalReplies,
          impressions: totalImpressions,
        },
        averageEngagement: {
          likes: avgLikes,
          retweets: avgRetweets,
          replies: avgReplies,
          viralScore: avgViralScore,
        },
        patterns: {
          hookTypes,
          formats,
          emotions,
          mediaTypes,
        },
      },
      topTweets: topTweets.map((t) => ({
        id: t.id,
        tweetId: t.tweetId,
        text: t.text,
        authorUsername: t.authorUsername,
        authorDisplayName: t.authorDisplayName,
        likes: t.likes,
        retweets: t.retweets,
        replies: t.replies,
        impressions: t.impressions,
        viralScore: t.viralScore,
        hookType: t.hookType,
        format: t.format,
        emotionalTrigger: t.emotionalTrigger,
        whyItWorked: t.whyItWorked,
        lessonsLearned: t.lessonsLearned,
        publishedAt: t.publishedAt.toISOString(),
        isAnalyzed: t.isAnalyzed,
      })),
      allTweets: tracked.viralTweets.map((t) => ({
        id: t.id,
        tweetId: t.tweetId,
        text: t.text,
        authorUsername: t.authorUsername,
        authorDisplayName: t.authorDisplayName,
        likes: t.likes,
        retweets: t.retweets,
        replies: t.replies,
        impressions: t.impressions,
        viralScore: t.viralScore,
        hookType: t.hookType,
        format: t.format,
        emotionalTrigger: t.emotionalTrigger,
        mediaType: t.mediaType,
        publishedAt: t.publishedAt.toISOString(),
        isAnalyzed: t.isAnalyzed,
      })),
      pagination: {
        page,
        limit,
        total: totalTweetsCount,
        totalPages: Math.ceil(totalTweetsCount / limit),
      },
    });
  } catch (error) {
    console.error("[SnipRadar Account Details] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account details" },
      { status: 500 }
    );
  }
}
