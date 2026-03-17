export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { incrementUsage } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import {
  requireSnipRadarFeature,
  requireSnipRadarUsage,
} from "@/lib/snipradar/billing-gates-server";

const updateDraftSchema = z.object({
  text: z.string().min(1).max(280).optional(),
  status: z.enum(["draft", "scheduled", "rejected"]).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});

/**
 * PATCH /api/snipradar/drafts/[id]
 * Edit a draft
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const draft = await prisma.tweetDraft.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (draft.status === "posted") {
      return NextResponse.json(
        { error: "Cannot edit a posted tweet" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.text !== undefined) {
      updateData.text = parsed.data.text;
    }

    // Handle scheduling
    if (parsed.data.status === "scheduled") {
      const schedulingFeatureGate = await requireSnipRadarFeature(
        user.id,
        "scheduling",
        "Scheduling is available on Plus and Pro plans."
      );
      if (!schedulingFeatureGate.ok) {
        return schedulingFeatureGate.response;
      }

      if (!parsed.data.scheduledFor) {
        return NextResponse.json(
          { error: "scheduledFor is required when scheduling a draft" },
          { status: 400 }
        );
      }

      const scheduledDate = new Date(parsed.data.scheduledFor);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: "Scheduled time must be in the future" },
          { status: 400 }
        );
      }

      // Verify the X account has OAuth tokens (bearer-only can't post)
      const xAccount = await prisma.xAccount.findUnique({
        where: { id: draft.xAccountId },
        select: { accessToken: true, isActive: true },
      });

      if (!xAccount?.isActive || !xAccount.accessToken || xAccount.accessToken === "bearer-only") {
        return NextResponse.json(
          { error: "Scheduling requires OAuth authorization. Please reconnect your X account.", code: "OAUTH_REQUIRED" },
          { status: 403 }
        );
      }

      if (draft.status !== "scheduled") {
        const schedulingUsageGate = await requireSnipRadarUsage(user.id, "scheduled_post", {
          feature: "scheduling",
          message: "You have reached the scheduled post limit for your current plan this month.",
        });
        if (!schedulingUsageGate.ok) {
          return schedulingUsageGate.response;
        }
      }

      updateData.status = "scheduled";
      updateData.scheduledFor = scheduledDate;
    } else if (parsed.data.status === "draft" && draft.status === "scheduled") {
      // Unschedule — revert back to draft
      updateData.status = "draft";
      updateData.scheduledFor = null;
    } else if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
    }

    // Handle explicit unschedule via scheduledFor: null
    if (parsed.data.scheduledFor === null && parsed.data.status === undefined) {
      updateData.status = "draft";
      updateData.scheduledFor = null;
    }

    const updated = await prisma.tweetDraft.update({
      where: { id: params.id },
      data: updateData,
    });

    if (updated.status === "scheduled" && draft.status !== "scheduled") {
      await incrementUsage(user.id, "scheduled_post", 1);
      await recordActivationCheckpointSafe({
        userId: user.id,
        checkpoint: "snipradar_first_scheduled_post",
        metadata: {
          source: "draft_update",
          draftId: updated.id,
        },
      });
    }

    return NextResponse.json({
      draft: {
        id: updated.id,
        text: updated.text,
        hookType: updated.hookType,
        format: updated.format,
        emotionalTrigger: updated.emotionalTrigger,
        aiReasoning: updated.aiReasoning,
        viralPrediction: updated.viralPrediction,
        threadGroupId: updated.threadGroupId ?? null,
        threadOrder: updated.threadOrder ?? null,
        status: updated.status,
        scheduledFor: updated.scheduledFor?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[SnipRadar Drafts] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update draft" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/snipradar/drafts/[id]
 * Delete a draft
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const draft = await prisma.tweetDraft.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    await prisma.tweetDraft.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SnipRadar Drafts] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete draft" },
      { status: 500 }
    );
  }
}
