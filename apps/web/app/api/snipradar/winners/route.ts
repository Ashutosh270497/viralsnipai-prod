export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectWinnerPosts } from "@/lib/snipradar/winner-loop";
import { emitSnipRadarWebhookEvent } from "@/lib/snipradar/webhooks";

function parsePeriodDays(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(7, Math.min(60, Math.round(parsed)));
}

/**
 * GET /api/snipradar/winners
 * Detect winner posts from posted draft metrics
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const periodDays = parsePeriodDays(req.nextUrl.searchParams.get("periodDays"));
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });

    if (!xAccount) {
      return NextResponse.json({
        summary: "Connect your X account to detect winners.",
        baseline: { avgImpressions: 0, avgEngagementRate: 0 },
        winners: [],
      });
    }

    const postedDrafts = await prisma.tweetDraft.findMany({
      where: {
        userId: user.id,
        xAccountId: xAccount.id,
        status: "posted",
        postedAt: { gte: periodStart },
      },
      orderBy: { postedAt: "desc" },
      take: 60,
    });

    const rows = postedDrafts.map((draft) => ({
      id: draft.id,
      tweetId: draft.postedTweetId ?? null,
      tweetUrl: draft.postedTweetId ? `https://x.com/i/web/status/${draft.postedTweetId}` : null,
      text: draft.text,
      hookType: draft.hookType,
      format: draft.format,
      emotionalTrigger: draft.emotionalTrigger,
      viralPrediction: draft.viralPrediction,
      postType: "post" as const,
      postedAt: draft.postedAt?.toISOString() ?? null,
      actualLikes: draft.actualLikes,
      actualRetweets: draft.actualRetweets,
      actualReplies: draft.actualReplies,
      actualImpressions: draft.actualImpressions,
    }));

    const result = detectWinnerPosts(rows);

    if (result.winners.length > 0) {
      await Promise.allSettled(
        result.winners.map((winner) =>
          emitSnipRadarWebhookEvent({
            userId: user.id,
            eventType: "winner.detected",
            resourceType: "tweet_draft",
            resourceId: winner.id,
            dedupeWindowMs: 7 * 24 * 60 * 60 * 1000,
            payload: {
              draftId: winner.id,
              tweetId: winner.tweetId,
              tweetUrl: winner.tweetUrl,
              text: winner.text,
              winnerScore: winner.winnerScore,
              whyWon: winner.whyWon,
              actualImpressions: winner.actualImpressions,
              actualReplies: winner.actualReplies,
              actualRetweets: winner.actualRetweets,
              engagementRate: winner.engagementRate,
              origin: "winners_page",
            },
          })
        )
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[SnipRadar Winners] GET error:", error);
    return NextResponse.json({ error: "Failed to detect winners" }, { status: 500 });
  }
}
