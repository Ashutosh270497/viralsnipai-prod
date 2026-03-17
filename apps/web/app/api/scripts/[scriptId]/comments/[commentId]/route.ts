export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const updateCommentSchema = z.object({
  resolved: z.boolean().optional(),
});

/**
 * PATCH /api/scripts/[scriptId]/comments/[commentId]
 * Update a comment (resolve/unresolve)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { scriptId: string; commentId: string } }
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
    const result = updateCommentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify comment exists and belongs to user's script
    const comment = await prisma.scriptComment.findUnique({
      where: {
        id: params.commentId,
      },
      include: {
        script: true,
      },
    });

    if (!comment || comment.scriptId !== params.scriptId) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (comment.script.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { resolved } = result.data;

    // Update comment
    const updatedComment = await prisma.scriptComment.update({
      where: {
        id: params.commentId,
      },
      data: {
        ...(resolved !== undefined && { resolved }),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    logger.info("[Script Comments API] Comment updated", {
      commentId: params.commentId,
    });

    return NextResponse.json(
      { comment: updatedComment },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Comments API] Failed to update comment", { error });
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/scripts/[scriptId]/comments/[commentId]
 * Delete a comment
 */
export async function DELETE(
  request: Request,
  { params }: { params: { scriptId: string; commentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify comment exists and user owns it or owns the script
    const comment = await prisma.scriptComment.findUnique({
      where: {
        id: params.commentId,
      },
      include: {
        script: true,
      },
    });

    if (!comment || comment.scriptId !== params.scriptId) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Allow deletion if user is comment author or script owner
    if (comment.userId !== user.id && comment.script.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Delete comment
    await prisma.scriptComment.delete({
      where: {
        id: params.commentId,
      },
    });

    logger.info("[Script Comments API] Comment deleted", {
      commentId: params.commentId,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Comments API] Failed to delete comment", { error });
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
