export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeTweetBatch } from "@/lib/ai/snipradar-analyzer";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

/**
 * POST /api/snipradar/viral/analyze
 * Trigger AI analysis for unanalyzed viral tweets
 */
export async function POST(request: Request) {
  try {
    const requestStartedAt = Date.now();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:viral:analyze", user.id, [
      {
        name: "cooldown",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_COOLDOWN_MS,
        maxHits: 1,
      },
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Please wait ${rateLimit.retryAfterSec}s before analyzing again.` },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!xAccount) {
      return NextResponse.json(
        { error: "Please connect your X account first." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const trackedAccountIds =
      Array.isArray(body?.trackedAccountIds) && body.trackedAccountIds.length > 0
        ? (body.trackedAccountIds as string[])
        : null;

    // Get unanalyzed tweets (max 20 at a time)
    const unanalyzed = await prisma.viralTweet.findMany({
      where: {
        isAnalyzed: false,
        trackedAccount: {
          userId: user.id,
          xAccountId: xAccount.id,
          isActive: true,
          ...(trackedAccountIds ? { id: { in: trackedAccountIds } } : {}),
        },
      },
      orderBy: { likes: "desc" },
      take: 20,
    });

    if (unanalyzed.length === 0) {
      return NextResponse.json({
        success: true,
        analyzed: 0,
        message: "No unanalyzed tweets found.",
      });
    }

    // Run batch analysis
    const results = await analyzeTweetBatch(
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

    // Update tweets with analysis
    let analyzedCount = 0;
    for (const [tweetId, analysis] of results) {
      await prisma.viralTweet.update({
        where: { id: tweetId },
        data: {
          isAnalyzed: true,
          hookType: analysis.hookType,
          format: analysis.format,
          emotionalTrigger: analysis.emotionalTrigger,
          viralScore: analysis.viralScore,
          whyItWorked: analysis.whyItWorked,
          lessonsLearned: analysis.lessonsLearned,
          analyzedAt: new Date(),
        },
      });
      analyzedCount++;
    }

    const response = NextResponse.json({
      success: true,
      analyzed: analyzedCount,
      total: unanalyzed.length,
    });
    response.headers.set("Server-Timing", `snipradar_viral_analyze;dur=${Date.now() - requestStartedAt}`);
    return response;
  } catch (error: any) {
    const message = error?.message ?? "";
    if (message.startsWith("RATE_LIMIT:")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Please try again in a few minutes." },
        { status: 429 }
      );
    }
    if (message.startsWith("AUTH_ERROR:")) {
      return NextResponse.json(
        { error: "AI service authentication failed. Please contact support." },
        { status: 503 }
      );
    }
    console.error("[SnipRadar Analyze] POST error:", error);
    return NextResponse.json(
      { error: "Failed to analyze tweets" },
      { status: 500 }
    );
  }
}
