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

const createDraftSchema = z.object({
  text: z.string().min(1).max(280),
  hookType: z.string().max(60).optional().nullable(),
  format: z.string().max(60).optional().nullable(),
  emotionalTrigger: z.string().max(60).optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const auth = await authenticateSnipRadarApiRequest(request, ["drafts:read"]);
  if (!auth.ok) return auth.response;

  try {
    const status = request.nextUrl.searchParams.get("status");
    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 25), 1),
      100
    );

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: auth.context.userId, isActive: true },
      select: { id: true },
    });

    if (!xAccount) {
      return NextResponse.json(
        { drafts: [], count: 0 },
        { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    const drafts = await prisma.tweetDraft.findMany({
      where: {
        userId: auth.context.userId,
        xAccountId: xAccount.id,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(
      {
        drafts: drafts.map(serializePublicDraft),
        count: drafts.length,
      },
      { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] GET drafts error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch drafts" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateSnipRadarApiRequest(request, ["drafts:write"]);
  if (!auth.ok) return auth.response;

  try {
    const parsed = createDraftSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid draft payload" },
        { status: 400, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: auth.context.userId, isActive: true },
      select: { id: true, accessToken: true },
    });

    if (!xAccount) {
      return NextResponse.json(
        { success: false, error: "Connect your X account first." },
        { status: 400, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    let scheduledFor: Date | null = null;
    let status = "draft";
    if (parsed.data.scheduledFor) {
      scheduledFor = new Date(parsed.data.scheduledFor);
      if (scheduledFor.getTime() <= Date.now()) {
        return NextResponse.json(
          { success: false, error: "Scheduled time must be in the future." },
          { status: 400, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
        );
      }
      if (!xAccount.accessToken || xAccount.accessToken === "bearer-only") {
        return NextResponse.json(
          { success: false, error: "Scheduling requires an OAuth-connected X account." },
          { status: 403, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
        );
      }
      status = "scheduled";
    }

    const draft = await prisma.tweetDraft.create({
      data: {
        userId: auth.context.userId,
        xAccountId: xAccount.id,
        text: parsed.data.text.trim(),
        hookType: parsed.data.hookType ?? null,
        format: parsed.data.format ?? null,
        emotionalTrigger: parsed.data.emotionalTrigger ?? null,
        status,
        scheduledFor,
      },
    });

    if (draft.status === "scheduled") {
      await recordActivationCheckpointSafe({
        userId: auth.context.userId,
        checkpoint: "snipradar_first_scheduled_post",
        metadata: {
          source: "public_api_create_draft",
          draftId: draft.id,
        },
      });
    }

    return NextResponse.json(
      {
        draft: serializePublicDraft(draft),
      },
      { status: 201, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] POST drafts error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create draft" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}
