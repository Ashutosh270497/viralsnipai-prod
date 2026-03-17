export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/thumbnails
 * Fetch user's generated thumbnails
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

    const thumbnails = await prisma.thumbnail.findMany({
      where: {
        userId: user.id,
        ...(batchId && { generationBatchId: batchId }),
        ...(contentIdeaId && { contentIdeaId }),
      },
      orderBy: [
        { isPrimary: 'desc' },
        { ctrScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json(
      { thumbnails },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Thumbnail API] Failed to fetch thumbnails', { error });
    return NextResponse.json(
      { error: "Failed to fetch thumbnails" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
