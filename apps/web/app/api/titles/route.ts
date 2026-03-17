export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/titles
 * Fetch user's generated titles (with optional filters)
 * Query params:
 * - batchId: Filter by generation batch
 * - contentIdeaId: Filter by content idea
 * - limit: Number of results (default 50)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    const contentIdeaId = searchParams.get("contentIdeaId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const titles = await prisma.generatedTitle.findMany({
      where: {
        userId: user.id,
        ...(batchId && { generationBatchId: batchId }),
        ...(contentIdeaId && { contentIdeaId }),
      },
      orderBy: [
        { isPrimary: 'desc' },
        { isFavorite: 'desc' },
        { ctrScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json(
      { titles },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Title API] Failed to fetch titles', { error });
    return NextResponse.json(
      { error: "Failed to fetch titles" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
