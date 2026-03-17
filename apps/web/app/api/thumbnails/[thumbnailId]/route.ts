export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const updateThumbnailSchema = z.object({
  isFavorite: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
});

/**
 * PATCH /api/thumbnails/[thumbnailId]
 * Update thumbnail (favorite, primary selection)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { thumbnailId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await request.json();
    const result = updateThumbnailSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership
    const thumbnail = await prisma.thumbnail.findFirst({
      where: {
        id: params.thumbnailId,
        userId: user.id,
      },
    });

    if (!thumbnail) {
      return NextResponse.json(
        { error: "Thumbnail not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // If setting as primary, unset other primaries in the same batch
    if (result.data.isPrimary === true) {
      await prisma.thumbnail.updateMany({
        where: {
          generationBatchId: thumbnail.generationBatchId,
          userId: user.id,
          id: { not: params.thumbnailId },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Update thumbnail
    const updatedThumbnail = await prisma.thumbnail.update({
      where: { id: params.thumbnailId },
      data: result.data,
    });

    logger.info('[Thumbnail API] Thumbnail updated', { thumbnailId: params.thumbnailId });

    return NextResponse.json(
      { thumbnail: updatedThumbnail },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Thumbnail API] Failed to update thumbnail', { error });
    return NextResponse.json(
      { error: "Failed to update thumbnail" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/thumbnails/[thumbnailId]
 * Delete a thumbnail
 */
export async function DELETE(
  request: Request,
  { params }: { params: { thumbnailId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership
    const thumbnail = await prisma.thumbnail.findFirst({
      where: {
        id: params.thumbnailId,
        userId: user.id,
      },
    });

    if (!thumbnail) {
      return NextResponse.json(
        { error: "Thumbnail not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    await prisma.thumbnail.delete({
      where: { id: params.thumbnailId },
    });

    logger.info('[Thumbnail API] Thumbnail deleted', { thumbnailId: params.thumbnailId });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Thumbnail API] Failed to delete thumbnail', { error });
    return NextResponse.json(
      { error: "Failed to delete thumbnail" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
