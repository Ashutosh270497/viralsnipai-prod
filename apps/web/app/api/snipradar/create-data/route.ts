export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDbPoolSaturationError } from "@/lib/snipradar/db-resilience";

const CREATE_CACHE_TTL_MS = 8_000;
const createCache = new Map<string, { data: unknown; expiresAt: number }>();

function mapDraft(d: any) {
  return {
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
  };
}

export async function GET() {
  const requestStartedAt = Date.now();
  let cacheKey: string | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    cacheKey = user.id;
    const cached = createCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      const response = NextResponse.json(cached.data);
      response.headers.set("Server-Timing", `snipradar_create_data;dur=${Date.now() - requestStartedAt}`);
      response.headers.set("X-SnipRadar-Cache", "hit");
      return response;
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!xAccount) {
      const payload = {
        drafts: [],
        scheduledDrafts: [],
        postedDrafts: [],
        viralTweetCount: 0,
      };
      createCache.set(cacheKey, { data: payload, expiresAt: Date.now() + CREATE_CACHE_TTL_MS });
      const response = NextResponse.json(payload);
      response.headers.set("Server-Timing", `snipradar_create_data;dur=${Date.now() - requestStartedAt}`);
      response.headers.set("X-SnipRadar-Cache", "miss");
      return response;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [draftTweets, scheduledTweets, postedTweets, viralTweetCount] = await Promise.all([
      prisma.tweetDraft.findMany({
        where: {
          userId: user.id,
          xAccountId: xAccount.id,
          status: "draft",
          threadGroupId: null,
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.tweetDraft.findMany({
        where: {
          userId: user.id,
          xAccountId: xAccount.id,
          status: "scheduled",
          threadGroupId: null,
        },
        orderBy: { scheduledFor: "asc" },
        take: 40,
      }),
      prisma.tweetDraft.findMany({
        where: {
          userId: user.id,
          xAccountId: xAccount.id,
          status: "posted",
          threadGroupId: null,
        },
        orderBy: { postedAt: "desc" },
        take: 40,
      }),
      prisma.viralTweet.count({
        where: {
          trackedAccount: {
            userId: user.id,
            xAccountId: xAccount.id,
          },
          publishedAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const payload = {
      drafts: draftTweets.map(mapDraft),
      scheduledDrafts: scheduledTweets.map(mapDraft),
      postedDrafts: postedTweets.map(mapDraft),
      viralTweetCount,
    };
    createCache.set(cacheKey, { data: payload, expiresAt: Date.now() + CREATE_CACHE_TTL_MS });
    const response = NextResponse.json(payload);
    response.headers.set("Server-Timing", `snipradar_create_data;dur=${Date.now() - requestStartedAt}`);
    response.headers.set("X-SnipRadar-Cache", "miss");
    return response;
  } catch (error) {
    console.error("[SnipRadar Create Data] GET error:", error);
    if (cacheKey && isDbPoolSaturationError(error)) {
      const stale = createCache.get(cacheKey);
      if (stale?.data) {
        const response = NextResponse.json(stale.data);
        response.headers.set("Server-Timing", `snipradar_create_data;dur=${Date.now() - requestStartedAt}`);
        response.headers.set("X-SnipRadar-Cache", "stale-fallback");
        return response;
      }
      const response = NextResponse.json({
        drafts: [],
        scheduledDrafts: [],
        postedDrafts: [],
        viralTweetCount: 0,
        degraded: true,
      });
      response.headers.set("Server-Timing", `snipradar_create_data;dur=${Date.now() - requestStartedAt}`);
      response.headers.set("X-SnipRadar-Cache", "degraded-fallback");
      return response;
    }
    return NextResponse.json(
      { error: "Failed to fetch create data" },
      { status: 500 }
    );
  }
}
