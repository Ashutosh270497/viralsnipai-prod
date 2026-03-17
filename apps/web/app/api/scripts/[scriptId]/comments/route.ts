export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const createCommentSchema = z.object({
  section: z.enum(["hook", "intro", "main", "conclusion", "cta", "general"]).optional(),
  content: z.string().min(1),
});

/**
 * GET /api/scripts/[scriptId]/comments
 * Fetch all comments for a script
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

    // Verify access to script
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

    // Fetch all comments
    const comments = await prisma.scriptComment.findMany({
      where: {
        scriptId: params.scriptId,
      },
      orderBy: {
        createdAt: "desc",
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

    return NextResponse.json(
      { comments },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Comments API] Failed to fetch comments", { error });
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * POST /api/scripts/[scriptId]/comments
 * Create a new comment on a script
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
    const result = createCommentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify access to script
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

    const { section, content } = result.data;

    // Create comment
    const comment = await prisma.scriptComment.create({
      data: {
        scriptId: params.scriptId,
        userId: user.id,
        section,
        content,
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

    logger.info("[Script Comments API] Comment created", {
      scriptId: params.scriptId,
      commentId: comment.id,
    });

    return NextResponse.json(
      { comment },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Comments API] Failed to create comment", { error });
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
