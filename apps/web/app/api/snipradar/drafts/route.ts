export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDrafts } from "@/lib/ai/snipradar-analyzer";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

/**
 * GET /api/snipradar/drafts
 * List user's tweet drafts
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status"); // 'draft' | 'posted' | 'rejected' | null (all)
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!xAccount) {
      return NextResponse.json({ drafts: [] });
    }

    const where: any = {
      userId: user.id,
      xAccountId: xAccount.id,
    };

    if (status) where.status = status;

    const drafts = await prisma.tweetDraft.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      drafts: drafts.map((d) => ({
        id: d.id,
        text: d.text,
        hookType: d.hookType,
        format: d.format,
        emotionalTrigger: d.emotionalTrigger,
        aiReasoning: d.aiReasoning,
        viralPrediction: d.viralPrediction,
        threadGroupId: d.threadGroupId ?? null,
        threadOrder: d.threadOrder ?? null,
        status: d.status,
        scheduledFor: d.scheduledFor?.toISOString() ?? null,
        postedAt: d.postedAt?.toISOString() ?? null,
        postedTweetId: d.postedTweetId,
        actualLikes: d.actualLikes,
        actualRetweets: d.actualRetweets,
        actualReplies: d.actualReplies,
        actualImpressions: d.actualImpressions,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[SnipRadar Drafts] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/snipradar/drafts
 * Generate new AI tweet drafts
 */
export async function POST() {
  try {
    const requestStartedAt = Date.now();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:drafts:generate", user.id, [
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
        { error: `Please wait ${rateLimit.retryAfterSec}s before generating again.` },
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

    // Get user's niche
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { selectedNiche: true },
    });

    const niche = dbUser?.selectedNiche ?? "general";

    // Get recent analyzed viral patterns
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const viralPatterns = await prisma.viralTweet.findMany({
      where: {
        isAnalyzed: true,
        trackedAccount: {
          userId: user.id,
          xAccountId: xAccount.id,
        },
        publishedAt: { gte: sevenDaysAgo },
      },
      orderBy: { viralScore: "desc" },
      take: 10,
    });

    // Map patterns for AI
    const mappedPatterns = viralPatterns.map((p) => ({
      text: p.text,
      hookType: p.hookType ?? "unknown",
      format: p.format ?? "unknown",
      emotionalTrigger: p.emotionalTrigger ?? "unknown",
      likes: p.likes,
      whyItWorked: p.whyItWorked ?? "",
      lessonsLearned: p.lessonsLearned ?? [],
    }));

    // Generate drafts using AI with detailed viral patterns
    const generatedTweets = await generateDrafts({
      niche,
      followerCount: xAccount.followerCount,
      viralPatterns: mappedPatterns,
    });

    if (generatedTweets.length === 0) {
      if (viralPatterns.length === 0) {
        return NextResponse.json(
          {
            error:
              "No analyzed viral tweets found. Please fetch and analyze viral tweets first.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error:
            "AI failed to generate drafts. This might be a temporary issue. Please try again.",
        },
        { status: 500 }
      );
    }

    // Replace old non-posted drafts with the newly generated set.
    // Keep posted tweets for history/metrics.
    const { savedDrafts, deletedCount } = await prisma.$transaction(async (tx) => {
      const deleteResult = await tx.tweetDraft.deleteMany({
        where: {
          userId: user.id,
          xAccountId: xAccount.id,
          status: {
            in: ["draft", "scheduled", "rejected"],
          },
        },
      });

      const created = [];
      for (const tweet of generatedTweets) {
        const draft = await tx.tweetDraft.create({
          data: {
            userId: user.id,
            xAccountId: xAccount.id,
            text: tweet.text,
            hookType: tweet.hookType,
            format: tweet.format,
            emotionalTrigger: tweet.emotionalTrigger,
            aiReasoning: tweet.reasoning,
            viralPrediction: tweet.viralPrediction,
          },
        });
        created.push(draft);
      }

      return {
        savedDrafts: created,
        deletedCount: deleteResult.count,
      };
    });

    // Keep viral feed persistent after draft generation.

    const response = NextResponse.json({
      deletedCount,
      drafts: savedDrafts.map((d) => ({
        id: d.id,
        text: d.text,
        hookType: d.hookType,
        format: d.format,
        emotionalTrigger: d.emotionalTrigger,
        aiReasoning: d.aiReasoning,
        viralPrediction: d.viralPrediction,
        threadGroupId: d.threadGroupId ?? null,
        threadOrder: d.threadOrder ?? null,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      })),
    }, { status: 201 });
    response.headers.set("Server-Timing", `snipradar_drafts_generate;dur=${Date.now() - requestStartedAt}`);
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
    console.error("[SnipRadar Drafts] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate drafts" },
      { status: 500 }
    );
  }
}
