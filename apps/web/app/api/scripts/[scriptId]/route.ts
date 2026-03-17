export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/scripts/[scriptId]
 * Fetch a specific script
 */
export async function GET(
  request: Request,
  { params }: { params: { scriptId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const script = await prisma.generatedScript.findFirst({
      where: {
        id: params.scriptId,
        userId: user.id,
      },
    });

    if (!script) {
      return NextResponse.json(
        { error: "Script not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { script },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Script API] Failed to fetch script', { error });
    return NextResponse.json(
      { error: "Failed to fetch script" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * PATCH /api/scripts/[scriptId]
 * Update a script
 */
export async function PATCH(
  request: Request,
  { params }: { params: { scriptId: string } }
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

    // Verify ownership
    const script = await prisma.generatedScript.findFirst({
      where: {
        id: params.scriptId,
        userId: user.id,
      },
    });

    if (!script) {
      return NextResponse.json(
        { error: "Script not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Update script
    const updatedScript = await prisma.generatedScript.update({
      where: {
        id: params.scriptId,
      },
      data: {
        ...(body.hook !== undefined && { hook: body.hook }),
        ...(body.intro !== undefined && { intro: body.intro }),
        ...(body.mainContent !== undefined && { mainContent: body.mainContent }),
        ...(body.conclusion !== undefined && { conclusion: body.conclusion }),
        ...(body.cta !== undefined && { cta: body.cta }),
        ...(body.fullScript !== undefined && { fullScript: body.fullScript }),
        ...(body.durationEstimate !== undefined && { durationEstimate: body.durationEstimate }),
      },
    });

    logger.info('[Script API] Script updated', {
      scriptId: params.scriptId,
      userId: user.id,
    });

    return NextResponse.json(
      { script: updatedScript },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Script API] Failed to update script', { error });
    return NextResponse.json(
      { error: "Failed to update script" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * DELETE /api/scripts/[scriptId]
 * Delete a script and all associated data (cascade)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { scriptId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      logger.warn('[Script API] Unauthorized delete attempt');
      return NextResponse.json(
        { error: "Unauthorized - Please sign in to delete scripts" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const scriptId = params.scriptId;
    if (!scriptId || scriptId === "undefined" || scriptId === "null") {
      logger.error('[Script API] Invalid script ID', { scriptId });
      return NextResponse.json(
        { error: "Invalid script ID" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership and check if script exists
    const script = await prisma.generatedScript.findFirst({
      where: {
        id: scriptId,
        userId: user.id,
      },
    });

    if (!script) {
      logger.warn('[Script API] Script not found or unauthorized', {
        scriptId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Script not found or you don't have permission to delete it" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Delete script (Prisma cascade will delete related data like audio files, versions, etc.)
    await prisma.generatedScript.delete({
      where: {
        id: scriptId,
      },
    });

    logger.info('[Script API] Script deleted successfully', {
      scriptId,
      userId: user.id,
      scriptTitle: script.title,
    });

    return NextResponse.json(
      { success: true, message: "Script deleted successfully" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    logger.error('[Script API] Failed to delete script', {
      error: error.message,
      stack: error.stack,
      scriptId: params.scriptId,
    });

    // Check if it's a Prisma error
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: "Script not found or already deleted" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete script. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
