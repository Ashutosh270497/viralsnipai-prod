export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/scripts/[scriptId]/versions/[versionId]/restore
 * Restore a specific version of the script
 */
export async function POST(
  request: Request,
  { params }: { params: { scriptId: string; versionId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership of script
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

    // Fetch the version to restore
    const version = await prisma.scriptVersion.findUnique({
      where: {
        id: params.versionId,
      },
    });

    if (!version || version.scriptId !== params.scriptId) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Create a backup of current state before restoring
    await prisma.scriptVersion.create({
      data: {
        scriptId: params.scriptId,
        userId: user.id,
        versionNumber: await getNextVersionNumber(params.scriptId),
        title: script.title,
        hook: script.hook,
        intro: script.intro,
        mainContent: script.mainContent,
        conclusion: script.conclusion,
        cta: script.cta,
        fullScript: script.fullScript,
        durationEstimate: script.durationEstimate,
        changeDescription: `Backup before restoring version ${version.versionNumber}`,
      },
    });

    // Restore the version
    const updatedScript = await prisma.generatedScript.update({
      where: {
        id: params.scriptId,
      },
      data: {
        title: version.title,
        hook: version.hook,
        intro: version.intro,
        mainContent: version.mainContent,
        conclusion: version.conclusion,
        cta: version.cta,
        fullScript: version.fullScript,
        durationEstimate: version.durationEstimate,
      },
    });

    logger.info("[Script Versions API] Version restored", {
      scriptId: params.scriptId,
      versionId: params.versionId,
      versionNumber: version.versionNumber,
    });

    return NextResponse.json(
      { script: updatedScript, restoredVersion: version },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Script Versions API] Failed to restore version", { error });
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function getNextVersionNumber(scriptId: string): Promise<number> {
  const count = await prisma.scriptVersion.count({
    where: { scriptId },
  });
  return count + 1;
}
