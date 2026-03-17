export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const updateTitleSchema = z.object({
  isFavorite: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
});

/**
 * PATCH /api/titles/[titleId]
 * Update title (favorite, primary selection)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { titleId: string } }
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
    const result = updateTitleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership
    const title = await prisma.generatedTitle.findFirst({
      where: {
        id: params.titleId,
        userId: user.id,
      },
    });

    if (!title) {
      return NextResponse.json(
        { error: "Title not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // If setting as primary, unset other primaries in the same batch
    if (result.data.isPrimary === true) {
      await prisma.generatedTitle.updateMany({
        where: {
          generationBatchId: title.generationBatchId,
          userId: user.id,
          id: { not: params.titleId },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Update title
    const updatedTitle = await prisma.generatedTitle.update({
      where: { id: params.titleId },
      data: result.data,
    });

    logger.info('[Title API] Title updated', { titleId: params.titleId });

    return NextResponse.json(
      { title: updatedTitle },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Title API] Failed to update title', { error });
    return NextResponse.json(
      { error: "Failed to update title" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/titles/[titleId]
 * Delete a title
 */
export async function DELETE(
  request: Request,
  { params }: { params: { titleId: string } }
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
    const title = await prisma.generatedTitle.findFirst({
      where: {
        id: params.titleId,
        userId: user.id,
      },
    });

    if (!title) {
      return NextResponse.json(
        { error: "Title not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    await prisma.generatedTitle.delete({
      where: { id: params.titleId },
    });

    logger.info('[Title API] Title deleted', { titleId: params.titleId });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Title API] Failed to delete title', { error });
    return NextResponse.json(
      { error: "Failed to delete title" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
