export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyBrandTemplateSchema,
  buildClipUpdateFromBrandTemplate,
  serializeBrandTemplate,
} from "@/lib/repurpose/brand-templates";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templateRow = await (prisma as any).brandTemplate.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!templateRow) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  const template = serializeBrandTemplate(templateRow);

  const json = await request.json();
  const parsed = applyBrandTemplateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const where = buildClipWhere(parsed.data, user.id);
  const clips = await prisma.clip.findMany({
    where,
    include: {
      project: { select: { userId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const authorizedClips = clips.filter((clip) => clip.project.userId === user.id);
  if (authorizedClips.length === 0) {
    return NextResponse.json({ error: "No matching clips found" }, { status: 404 });
  }

  const appliedAt = new Date().toISOString();
  await prisma.$transaction(
    authorizedClips.map((clip) => {
      const update = buildClipUpdateFromBrandTemplate(clip as any, template, {
        overwrite: parsed.data.overwrite,
        appliedAt,
      });
      return prisma.clip.update({
        where: { id: clip.id },
        data: {
          ...(update.captionStyle !== undefined ? { captionStyle: update.captionStyle as any } : {}),
          callToAction: update.callToAction,
          viralityFactors: update.viralityFactors as any,
          version: { increment: 1 },
        },
      });
    }),
  );

  return NextResponse.json({
    applied: authorizedClips.length,
    templateId: template.id,
    templateName: template.name,
  });
}

function buildClipWhere(
  input: ReturnType<typeof applyBrandTemplateSchema.parse>,
  userId: string,
) {
  if (input.scope === "current_clip") {
    return {
      id: input.clipId ?? "",
      project: { userId },
    };
  }

  if (input.scope === "selected_clips") {
    return {
      id: { in: input.clipIds ?? [] },
      project: { userId },
    };
  }

  return {
    projectId: input.projectId ?? "",
    project: { userId },
  };
}
