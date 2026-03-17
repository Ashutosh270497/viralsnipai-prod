export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  mergeResearchInboxLabels,
  normalizeResearchInboxLabels,
  RESEARCH_INBOX_STATUSES,
} from "@/lib/snipradar/inbox";

const baseBulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

const bulkInboxSchema = z.discriminatedUnion("action", [
  baseBulkSchema.extend({
    action: z.literal("delete"),
  }),
  baseBulkSchema.extend({
    action: z.literal("status"),
    status: z.enum(RESEARCH_INBOX_STATUSES),
  }),
  baseBulkSchema.extend({
    action: z.literal("labels"),
    mode: z.enum(["add", "replace"]).default("add"),
    labels: z.array(z.string().min(1).max(40)).min(1).max(8),
  }),
]);

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = bulkInboxSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid bulk payload" },
        { status: 400 }
      );
    }

    const items = await prisma.xResearchInboxItem.findMany({
      where: {
        userId: user.id,
        id: { in: parsed.data.ids },
      },
      select: {
        id: true,
        labels: true,
      },
    });

    if (items.length === 0) {
      return NextResponse.json({ error: "No inbox items found" }, { status: 404 });
    }

    if (parsed.data.action === "delete") {
      const result = await prisma.xResearchInboxItem.deleteMany({
        where: {
          userId: user.id,
          id: { in: items.map((item) => item.id) },
        },
      });

      return NextResponse.json({
        ok: true,
        action: "delete",
        deleted: result.count,
      });
    }

    if (parsed.data.action === "status") {
      const result = await prisma.xResearchInboxItem.updateMany({
        where: {
          userId: user.id,
          id: { in: items.map((item) => item.id) },
        },
        data: {
          status: parsed.data.status,
          lastActionAt: new Date(),
        },
      });

      return NextResponse.json({
        ok: true,
        action: "status",
        updated: result.count,
        status: parsed.data.status,
      });
    }

    const labelPayload = parsed.data;
    const nextLabels = normalizeResearchInboxLabels(labelPayload.labels);
    const updates = items.map((item) =>
      prisma.xResearchInboxItem.update({
        where: { id: item.id },
        data: {
          labels:
            labelPayload.mode === "replace"
              ? nextLabels
              : mergeResearchInboxLabels(item.labels, nextLabels),
          lastActionAt: new Date(),
        },
      })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({
      ok: true,
      action: "labels",
      updated: items.length,
      mode: labelPayload.mode,
      labels: nextLabels,
    });
  } catch (error) {
    console.error("[SnipRadar Inbox] BULK PATCH error:", error);
    return NextResponse.json({ error: "Failed to update inbox items" }, { status: 500 });
  }
}
