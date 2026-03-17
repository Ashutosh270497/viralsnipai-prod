export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const updateIdeaSchema = z.object({
  status: z.enum(['idea', 'scripted', 'published']).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  scheduledDate: z.string().optional(),
});

/**
 * PATCH /api/content-calendar/ideas/[ideaId]
 * Update a content idea
 */
export async function PATCH(
  request: Request,
  { params }: { params: { ideaId: string } }
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
    const result = updateIdeaSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership
    const idea = await prisma.contentIdea.findFirst({
      where: {
        id: params.ideaId,
        userId: user.id,
      },
    });

    if (!idea) {
      return NextResponse.json(
        { error: "Idea not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Update idea
    const updatedIdea = await prisma.contentIdea.update({
      where: {
        id: params.ideaId,
      },
      data: {
        ...(result.data.status && { status: result.data.status }),
        ...(result.data.title && { title: result.data.title }),
        ...(result.data.description && { description: result.data.description }),
        ...(result.data.scheduledDate && { scheduledDate: new Date(result.data.scheduledDate) }),
      },
    });

    logger.info('[Content Calendar] Idea updated', {
      ideaId: params.ideaId,
      userId: user.id,
      updates: result.data,
    });

    return NextResponse.json(
      { idea: updatedIdea },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Content Calendar] Failed to update idea', { error: error instanceof Error ? error : { error } });
    return NextResponse.json(
      { error: "Failed to update content idea" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/content-calendar/ideas/[ideaId]
 * Delete a content idea
 */
export async function DELETE(
  request: Request,
  { params }: { params: { ideaId: string } }
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
    const idea = await prisma.contentIdea.findFirst({
      where: {
        id: params.ideaId,
        userId: user.id,
      },
    });

    if (!idea) {
      return NextResponse.json(
        { error: "Idea not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Delete idea
    await prisma.contentIdea.delete({
      where: {
        id: params.ideaId,
      },
    });

    logger.info('[Content Calendar] Idea deleted', {
      ideaId: params.ideaId,
      userId: user.id,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Content Calendar] Failed to delete idea', { error: error instanceof Error ? error : { error } });
    return NextResponse.json(
      { error: "Failed to delete content idea" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
