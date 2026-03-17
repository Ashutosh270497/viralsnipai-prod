export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueCompetitorSync } from "@/lib/competitors/sync-queue";

const syncRequestSchema = z.object({
  refreshVideos: z.boolean().optional(),
  force: z.boolean().optional(),
});

/**
 * POST /api/competitors/[id]/sync
 * Queue a competitor sync job.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const existing = await prisma.competitor.findFirst({
      where: { id: params.id, userId: user.id, isActive: true },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = syncRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const refreshVideos = parsed.data.refreshVideos ?? true;
    const force = parsed.data.force ?? false;

    const enqueued = await enqueueCompetitorSync(
      existing.id,
      "manual_force",
      refreshVideos,
      { bypassDedup: force }
    );

    return NextResponse.json(
      { enqueued },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Competitors API] Sync enqueue error:", error);
    return NextResponse.json(
      { error: "Failed to queue sync" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
