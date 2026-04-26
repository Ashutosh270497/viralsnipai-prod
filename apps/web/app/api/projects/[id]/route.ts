export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      userId: user.id
    },
    include: {
      assets: {
        orderBy: { createdAt: "desc" }
      },
      clips: {
        orderBy: { createdAt: "desc" },
        include: {
          asset: true
        }
      },
      exports: {
        orderBy: { createdAt: "desc" }
      },
      script: true
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ project }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      userId: user.id
    },
    include: {
      assets: {
        select: { id: true }
      },
      clips: {
        select: { id: true }
      },
      script: {
        select: { id: true }
      }
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const assetIds = project.assets.map((asset) => asset.id);
  const clipIds = project.clips.map((clip) => clip.id);

  try {
    await prisma.$transaction(async (tx) => {
      if (clipIds.length > 0) {
        await tx.captionTranslation.deleteMany({
          where: {
            clipId: { in: clipIds }
          }
        });
      }

      if (assetIds.length > 0) {
        await tx.transcriptTranslation.deleteMany({
          where: {
            assetId: { in: assetIds }
          }
        });
        await tx.voiceTranslation.deleteMany({
          where: {
            assetId: { in: assetIds }
          }
        });
      }

      await tx.youTubeIngestJob.deleteMany({
        where: {
          projectId: project.id
        }
      });

      await tx.export.deleteMany({ where: { projectId: project.id } });
      await tx.clip.deleteMany({ where: { projectId: project.id } });
      await tx.asset.deleteMany({ where: { projectId: project.id } });

      if (project.script?.id) {
        await tx.script.delete({ where: { id: project.script.id } });
      }

      await tx.project.delete({ where: { id: project.id } });
    });
  } catch (error) {
    logger.error(
      "Project delete failed",
      {
        projectId: project.id,
        userId: user.id,
        assetCount: assetIds.length,
        clipCount: clipIds.length
      },
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      {
        error: "Project delete failed",
        message: "We could not delete this project and its related media. Please try again."
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
