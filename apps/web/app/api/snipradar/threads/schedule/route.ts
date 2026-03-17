export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { snipradarErrorResponse } from "@/lib/snipradar/api-errors";

const bodySchema = z.object({
  threadGroupId: z.string().min(3),
  scheduledFor: z.string().datetime({ message: "scheduledFor must be a valid ISO datetime" }),
});

/**
 * POST /api/snipradar/threads/schedule
 *
 * Schedules every draft in a thread group for the same datetime.
 * This is the only correct way to schedule a thread — individual
 * PATCH /drafts/[id] calls would schedule each tweet independently
 * and the scheduler would post them without the reply chain.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const payload = bodySchema.safeParse(await request.json());
    if (!payload.success) {
      return snipradarErrorResponse(
        payload.error.errors[0]?.message ?? "Invalid input",
        400
      );
    }

    const { threadGroupId, scheduledFor } = payload.data;
    const scheduledAt = new Date(scheduledFor);

    if (scheduledAt <= new Date()) {
      return snipradarErrorResponse("scheduledFor must be a future datetime", 400);
    }

    // Verify the thread exists and has at least 2 unposted drafts for this user
    const drafts = await prisma.tweetDraft.findMany({
      where: {
        threadGroupId,
        userId: user.id,
        status: { in: ["draft", "scheduled"] },
      },
      select: { id: true },
    });

    if (drafts.length < 2) {
      return snipradarErrorResponse(
        "Thread needs at least 2 drafts to schedule",
        400
      );
    }

    // Bulk-update every draft in this thread to scheduled with the same time.
    // The scheduler will then post them as a reply chain via threadGroupId + threadOrder.
    await prisma.tweetDraft.updateMany({
      where: {
        threadGroupId,
        userId: user.id,
        status: { in: ["draft", "scheduled"] },
      },
      data: {
        status: "scheduled",
        scheduledFor: scheduledAt,
      },
    });

    return NextResponse.json({
      success: true,
      scheduled: drafts.length,
      scheduledFor: scheduledAt.toISOString(),
    });
  } catch (error) {
    console.error("[SnipRadar] Thread schedule error:", error);
    return snipradarErrorResponse("Failed to schedule thread", 500);
  }
}

/**
 * DELETE /api/snipradar/threads/schedule
 *
 * Unschedules (reverts to draft) every tweet in a thread group.
 */
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const threadGroupId = searchParams.get("threadGroupId");
    if (!threadGroupId) {
      return snipradarErrorResponse("threadGroupId query param required", 400);
    }

    await prisma.tweetDraft.updateMany({
      where: {
        threadGroupId,
        userId: user.id,
        status: "scheduled",
      },
      data: {
        status: "draft",
        scheduledFor: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SnipRadar] Thread unschedule error:", error);
    return snipradarErrorResponse("Failed to unschedule thread", 500);
  }
}
