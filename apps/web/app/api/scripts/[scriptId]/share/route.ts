export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import crypto from "crypto";

const shareScriptSchema = z.object({
  sharedWith: z.string().email().optional(),
  accessLevel: z.enum(["view", "edit"]).default("view"),
  expiresIn: z.number().optional(), // days
});

/**
 * POST /api/scripts/[scriptId]/share
 * Create a share link for a script
 */
export async function POST(
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
    const result = shareScriptSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

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

    const { sharedWith, accessLevel, expiresIn } = result.data;

    // Generate unique share token
    const shareToken = crypto.randomBytes(32).toString("hex");

    // Calculate expiration date
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null;

    // Create share record
    const share = await prisma.scriptShare.create({
      data: {
        scriptId: params.scriptId,
        sharedBy: user.id,
        sharedWith,
        shareToken,
        accessLevel,
        expiresAt,
      },
    });

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shared/script/${shareToken}`;

    logger.info("[Script Share API] Script shared", {
      scriptId: params.scriptId,
      shareToken,
      accessLevel,
    });

    return NextResponse.json(
      { share, shareUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Share API] Failed to create share", { error });
    return NextResponse.json(
      { error: "Failed to create share" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * GET /api/scripts/[scriptId]/share
 * Get all shares for a script
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

    // Fetch all shares
    const shares = await prisma.scriptShare.findMany({
      where: {
        scriptId: params.scriptId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      { shares },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Share API] Failed to fetch shares", { error });
    return NextResponse.json(
      { error: "Failed to fetch shares" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
