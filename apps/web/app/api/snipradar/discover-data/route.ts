export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withSnipRadarErrorContract } from "@/lib/snipradar/api-errors";
import { isDbPoolSaturationError, withDbPoolRetry } from "@/lib/snipradar/db-resilience";

const DISCOVER_CACHE_TTL_MS = 8_000;
const discoverCache = new Map<string, { data: unknown; expiresAt: number }>();

export async function GET() {
  const requestStartedAt = Date.now();
  let cacheKey: string | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        withSnipRadarErrorContract({ error: "Unauthorized" }, 401),
        { status: 401 }
      );
    }
    cacheKey = user.id;
    const cached = discoverCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      const response = NextResponse.json(cached.data);
      response.headers.set("Server-Timing", `snipradar_discover_data;dur=${Date.now() - requestStartedAt}`);
      response.headers.set("X-SnipRadar-Cache", "hit");
      return response;
    }

    const xAccount = await withDbPoolRetry("discover-data.find-active-account", () =>
      prisma.xAccount.findFirst({
        where: { userId: user.id, isActive: true },
      })
    );

    if (!xAccount) {
      const payload = { trackedAccounts: [], viralTweets: [] };
      discoverCache.set(cacheKey, { data: payload, expiresAt: Date.now() + DISCOVER_CACHE_TTL_MS });
      const response = NextResponse.json(payload);
      response.headers.set("Server-Timing", `snipradar_discover_data;dur=${Date.now() - requestStartedAt}`);
      response.headers.set("X-SnipRadar-Cache", "miss");
      return response;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [trackedAccounts, viralTweets] = await withDbPoolRetry(
      "discover-data.fetch-tracked-and-viral",
      () =>
        Promise.all([
          prisma.xTrackedAccount.findMany({
            where: { userId: user.id, xAccountId: xAccount.id, isActive: true },
            include: { _count: { select: { viralTweets: true } } },
            orderBy: { createdAt: "desc" },
          }),
          prisma.viralTweet.findMany({
            where: {
              trackedAccount: {
                userId: user.id,
                xAccountId: xAccount.id,
              },
              publishedAt: { gte: sevenDaysAgo },
            },
            orderBy: [{ viralScore: "desc" }, { likes: "desc" }],
            take: 50,
          }),
        ])
    );

    const payload = {
      trackedAccounts: trackedAccounts.map((ta) => ({
        id: ta.id,
        trackedUsername: ta.trackedUsername,
        trackedDisplayName: ta.trackedDisplayName,
        profileImageUrl: ta.profileImageUrl,
        followerCount: ta.followerCount,
        niche: ta.niche,
        viralTweetCount: ta._count.viralTweets,
      })),
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
    discoverCache.set(cacheKey, { data: payload, expiresAt: Date.now() + DISCOVER_CACHE_TTL_MS });
    const response = NextResponse.json(payload);
    response.headers.set("Server-Timing", `snipradar_discover_data;dur=${Date.now() - requestStartedAt}`);
    response.headers.set("X-SnipRadar-Cache", "miss");
    return response;
  } catch (error) {
    console.error("[SnipRadar Discover Data] GET error:", error);
    if (cacheKey && isDbPoolSaturationError(error)) {
      const stale = discoverCache.get(cacheKey);
      if (stale?.data) {
        const response = NextResponse.json(stale.data);
        response.headers.set("Server-Timing", `snipradar_discover_data;dur=${Date.now() - requestStartedAt}`);
        response.headers.set("X-SnipRadar-Cache", "stale-fallback");
        return response;
      }
      const response = NextResponse.json({
        trackedAccounts: [],
        viralTweets: [],
        degraded: true,
      });
      response.headers.set("Server-Timing", `snipradar_discover_data;dur=${Date.now() - requestStartedAt}`);
      response.headers.set("X-SnipRadar-Cache", "degraded-fallback");
      return response;
    }
    return NextResponse.json(
      withSnipRadarErrorContract(
        { error: "Failed to fetch discover data" },
        500
      ),
      { status: 500 }
    );
  }
}
