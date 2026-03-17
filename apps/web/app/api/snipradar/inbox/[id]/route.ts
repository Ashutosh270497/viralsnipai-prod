export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  mapResearchInboxItem,
  normalizeResearchInboxLabels,
  RESEARCH_INBOX_STATUSES,
} from "@/lib/snipradar/inbox";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.xResearchInboxItem.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
    }

    await prisma.xResearchInboxItem.delete({ where: { id: existing.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[SnipRadar Inbox] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete inbox item" }, { status: 500 });
  }
}

const updateInboxSchema = z.object({
  status: z.enum(RESEARCH_INBOX_STATUSES).optional(),
  note: z.string().max(2_000).nullable().optional(),
  labels: z.array(z.string().min(1).max(40)).max(8).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = updateInboxSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid inbox update payload" },
        { status: 400 }
      );
    }

    const existing = await prisma.xResearchInboxItem.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
    }

    const item = await prisma.xResearchInboxItem.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
        ...(parsed.data.labels ? { labels: normalizeResearchInboxLabels(parsed.data.labels) } : {}),
        lastActionAt: parsed.data.status ? new Date() : existing.lastActionAt,
      },
    });

    return NextResponse.json({ item: mapResearchInboxItem(item) });
  } catch (error) {
    console.error("[SnipRadar Inbox] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update inbox item" }, { status: 500 });
  }
}
