export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { prisma } from "@/lib/prisma";
import {
  authenticateSnipRadarApiRequest,
  buildSnipRadarPlatformHeaders,
  serializePublicDraft,
} from "@/lib/snipradar/public-api";

const updateDraftSchema = z.object({
  text: z.string().min(1).max(280).optional(),
  status: z.enum(["draft", "scheduled", "rejected"]).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateSnipRadarApiRequest(request, ["drafts:read"]);
  if (!auth.ok) return auth.response;

  try {
    const draft = await prisma.tweetDraft.findFirst({
      where: {
        id: params.id,
        userId: auth.context.userId,
      },
    });

    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    return NextResponse.json(
      { draft: serializePublicDraft(draft) },
      { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] GET draft error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch draft" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateSnipRadarApiRequest(request, ["drafts:write"]);
  if (!auth.ok) return auth.response;

  try {
    const parsed = updateDraftSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid draft payload" },
        { status: 400, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    const draft = await prisma.tweetDraft.findFirst({
      where: { id: params.id, userId: auth.context.userId },
      select: {
        id: true,
        status: true,
        xAccountId: true,
      },
    });

    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    if (draft.status === "posted") {
      return NextResponse.json(
        { success: false, error: "Cannot edit a posted draft." },
        { status: 400, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.text !== undefined) {
      updateData.text = parsed.data.text.trim();
    }

    if (parsed.data.status === "scheduled") {
      if (!parsed.data.scheduledFor) {
        return NextResponse.json(
          { success: false, error: "scheduledFor is required when scheduling a draft." },
          { status: 400, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
        );
      }

      const xAccount = await prisma.xAccount.findUnique({
        where: { id: draft.xAccountId },
        select: { accessToken: true, isActive: true },
      });

      if (!xAccount?.isActive || !xAccount.accessToken || xAccount.accessToken === "bearer-only") {
        return NextResponse.json(
          { success: false, error: "Scheduling requires an OAuth-connected X account." },
          { status: 403, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
        );
      }

      const scheduledFor = new Date(parsed.data.scheduledFor);
      if (scheduledFor.getTime() <= Date.now()) {
        return NextResponse.json(
          { success: false, error: "Scheduled time must be in the future." },
          { status: 400, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
        );
      }

      updateData.status = "scheduled";
      updateData.scheduledFor = scheduledFor;
    } else if (parsed.data.status === "draft") {
      updateData.status = "draft";
      updateData.scheduledFor = null;
    } else if (parsed.data.status === "rejected") {
      updateData.status = "rejected";
    }

    if (parsed.data.scheduledFor === null && parsed.data.status === undefined) {
      updateData.status = "draft";
      updateData.scheduledFor = null;
    }

    const updated = await prisma.tweetDraft.update({
      where: { id: draft.id },
      data: updateData,
    });

    if (updated.status === "scheduled" && draft.status !== "scheduled") {
      await recordActivationCheckpointSafe({
        userId: auth.context.userId,
        checkpoint: "snipradar_first_scheduled_post",
        metadata: {
          source: "public_api_update_draft",
          draftId: updated.id,
        },
      });
    }

    return NextResponse.json(
      { draft: serializePublicDraft(updated) },
      { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] PATCH draft error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update draft" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateSnipRadarApiRequest(request, ["drafts:write"]);
  if (!auth.ok) return auth.response;

  try {
    const draft = await prisma.tweetDraft.findFirst({
      where: { id: params.id, userId: auth.context.userId },
      select: { id: true },
    });

    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    await prisma.tweetDraft.delete({ where: { id: draft.id } });

    return NextResponse.json(
      { success: true },
      { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] DELETE draft error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete draft" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}
