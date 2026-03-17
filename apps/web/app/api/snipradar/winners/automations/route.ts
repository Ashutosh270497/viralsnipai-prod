export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { generateWinnerAutomationDrafts, buildThreadGroupId } from "@/lib/ai/winner-loop";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRepostScheduleDate, type WinnerAutomationAction } from "@/lib/snipradar/winner-loop";

const requestSchema = z.object({
  winnerDraftId: z.string().min(1),
  action: z.enum(["expand_thread", "repost_variant", "spin_off_post"]),
});

/**
 * POST /api/snipradar/winners/automations
 * Turn a winner into derivative drafts and scheduled reposts
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid automation payload" },
        { status: 400 }
      );
    }

    const action = parsed.data.action as WinnerAutomationAction;
    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });
    if (!xAccount) {
      return NextResponse.json({ error: "Connect your X account first" }, { status: 400 });
    }

    const winnerDraft = await prisma.tweetDraft.findFirst({
      where: {
        id: parsed.data.winnerDraftId,
        userId: user.id,
        xAccountId: xAccount.id,
        status: "posted",
      },
    });

    if (!winnerDraft) {
      return NextResponse.json({ error: "Winner draft not found" }, { status: 404 });
    }

    const winner = {
      id: winnerDraft.id,
      tweetId: winnerDraft.postedTweetId ?? null,
      tweetUrl: winnerDraft.postedTweetId ? `https://x.com/i/web/status/${winnerDraft.postedTweetId}` : null,
      text: winnerDraft.text,
      hookType: winnerDraft.hookType,
      format: winnerDraft.format,
      emotionalTrigger: winnerDraft.emotionalTrigger,
      postedAt: winnerDraft.postedAt?.toISOString() ?? null,
      actualLikes: winnerDraft.actualLikes ?? 0,
      actualRetweets: winnerDraft.actualRetweets ?? 0,
      actualReplies: winnerDraft.actualReplies ?? 0,
      actualImpressions: winnerDraft.actualImpressions ?? 0,
      engagementRate:
        winnerDraft.actualImpressions && winnerDraft.actualImpressions > 0
          ? Number(
              (((winnerDraft.actualLikes ?? 0) + (winnerDraft.actualRetweets ?? 0) + (winnerDraft.actualReplies ?? 0)) /
                winnerDraft.actualImpressions *
                100).toFixed(2)
            )
          : 0,
      winnerScore: 0,
      whyWon: [],
      recommendedActions: [],
    };

    const generatedDrafts = await generateWinnerAutomationDrafts({ action, winner });
    if (generatedDrafts.length === 0) {
      return NextResponse.json({ error: "Could not generate automation drafts" }, { status: 500 });
    }

    const threadGroupId = action === "expand_thread" ? buildThreadGroupId() : null;
    const scheduledFor = action === "repost_variant" ? buildRepostScheduleDate(winnerDraft.postedAt ?? null) : null;

    const created = await prisma.$transaction(
      generatedDrafts.map((draft, index) =>
        prisma.tweetDraft.create({
          data: {
            userId: user.id,
            xAccountId: xAccount.id,
            text: draft.text,
            inspiredByTweetId: winnerDraft.postedTweetId ?? winnerDraft.id,
            hookType: winnerDraft.hookType,
            format: action === "expand_thread" ? "thread" : winnerDraft.format,
            emotionalTrigger: winnerDraft.emotionalTrigger,
            aiReasoning: draft.reasoning,
            status: action === "repost_variant" ? "scheduled" : "draft",
            scheduledFor,
            threadGroupId,
            threadOrder: threadGroupId ? index + 1 : null,
          },
        })
      )
    );

    if (created.some((draft) => draft.status === "scheduled")) {
      await recordActivationCheckpointSafe({
        userId: user.id,
        checkpoint: "snipradar_first_scheduled_post",
        metadata: {
          source: "winner_automation",
          winnerDraftId: winnerDraft.id,
          action,
        },
      });
    }

    return NextResponse.json({
      action,
      createdCount: created.length,
      drafts: created.map((draft) => ({
        id: draft.id,
        text: draft.text,
        status: draft.status,
        scheduledFor: draft.scheduledFor?.toISOString() ?? null,
        threadGroupId: draft.threadGroupId ?? null,
        threadOrder: draft.threadOrder ?? null,
      })),
    });
  } catch (error) {
    console.error("[SnipRadar Winners] Automation POST error:", error);
    return NextResponse.json({ error: "Failed to execute automation" }, { status: 500 });
  }
}
