export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/scripts/[scriptId]/versions
 * Fetch all versions of a script
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

    // Fetch all versions
    const versions = await prisma.scriptVersion.findMany({
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
          },
        },
      },
    });

    return NextResponse.json(
      { versions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Versions API] Failed to fetch versions", { error });
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * POST /api/scripts/[scriptId]/versions
 * Create a new version (snapshot) of the script
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
    const { changeDescription } = body;

    // Verify ownership and fetch script
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

    // Get current version count
    const versionCount = await prisma.scriptVersion.count({
      where: {
        scriptId: params.scriptId,
      },
    });

    // Create new version
    const version = await prisma.scriptVersion.create({
      data: {
        scriptId: params.scriptId,
        userId: user.id,
        versionNumber: versionCount + 1,
        title: script.title,
        hook: script.hook,
        intro: script.intro,
        mainContent: script.mainContent,
        conclusion: script.conclusion,
        cta: script.cta,
        fullScript: script.fullScript,
        durationEstimate: script.durationEstimate,
        changeDescription,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info("[Script Versions API] Version created", {
      scriptId: params.scriptId,
      versionNumber: version.versionNumber,
    });

    return NextResponse.json(
      { version },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Versions API] Failed to create version", { error });
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
