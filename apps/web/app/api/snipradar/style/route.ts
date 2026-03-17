export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trainStyle } from "@/lib/ai/style-trainer";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

/**
 * GET /api/snipradar/style
 * Fetch the user's style profile
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.xStyleProfile.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[SnipRadar Style] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch style profile" }, { status: 500 });
  }
}

/**
 * POST /api/snipradar/style
 * Train a style profile from provided posts
 * Body: { posts: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:style:train", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: Math.max(2, Math.floor(SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS / 2)),
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before retraining your style profile." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const body = await req.json();
    const posts: string[] = body.posts;

    if (!Array.isArray(posts) || posts.length < 10) {
      return NextResponse.json(
        { error: "At least 10 posts are required to train a style profile." },
        { status: 400 }
      );
    }

    // Limit to 50 posts max
    const trimmedPosts = posts.slice(0, 50).map((p) => p.slice(0, 500));

    const style = await trainStyle(trimmedPosts);
    if (!style) {
      return NextResponse.json(
        { error: "Failed to analyze style. Please try again." },
        { status: 500 }
      );
    }

    const profile = await prisma.xStyleProfile.upsert({
      where: { userId: user.id },
      update: {
        tone: style.tone,
        vocabulary: style.vocabulary,
        avgLength: style.avgLength,
        emojiUsage: style.emojiUsage,
        hashtagStyle: style.hashtagStyle,
        sentencePattern: style.sentencePattern,
        trainingPosts: trimmedPosts,
        trainedAt: new Date(),
      },
      create: {
        userId: user.id,
        tone: style.tone,
        vocabulary: style.vocabulary,
        avgLength: style.avgLength,
        emojiUsage: style.emojiUsage,
        hashtagStyle: style.hashtagStyle,
        sentencePattern: style.sentencePattern,
        trainingPosts: trimmedPosts,
        trainedAt: new Date(),
      },
    });

    return NextResponse.json({ profile });
  } catch (error: any) {
    if (error?.message?.startsWith("RATE_LIMIT:")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Try again in a few minutes." },
        { status: 429 }
      );
    }
    console.error("[SnipRadar Style] POST error:", error);
    return NextResponse.json({ error: "Failed to train style profile" }, { status: 500 });
  }
}
