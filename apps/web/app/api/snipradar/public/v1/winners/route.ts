export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  authenticateSnipRadarApiRequest,
  buildSnipRadarPlatformHeaders,
} from "@/lib/snipradar/public-api";
import { detectWinnerPosts } from "@/lib/snipradar/winner-loop";
import { emitSnipRadarWebhookEvent } from "@/lib/snipradar/webhooks";

function parsePeriodDays(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(7, Math.min(60, Math.round(parsed)));
}

export async function GET(request: NextRequest) {
  const auth = await authenticateSnipRadarApiRequest(request, ["winners:read"]);
  if (!auth.ok) return auth.response;

  try {
    const periodDays = parsePeriodDays(request.nextUrl.searchParams.get("periodDays"));
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const postedDrafts = await prisma.tweetDraft.findMany({
      where: {
        userId: auth.context.userId,
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
            userId: auth.context.userId,
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
              origin: "public_api",
              apiKeyId: auth.context.apiKeyId,
              apiKeyName: auth.context.apiKeyName,
            },
          })
        )
      );
    }

    return NextResponse.json(result, {
      headers: buildSnipRadarPlatformHeaders(auth.context.headers),
    });
  } catch (error) {
    console.error("[SnipRadar Public API] Winners error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to detect winners" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}
