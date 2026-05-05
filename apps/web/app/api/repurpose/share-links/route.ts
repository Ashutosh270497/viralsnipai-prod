export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import {
  generateShareToken,
  serializeShareLink,
  shareLinkCreateSchema,
} from "@/lib/repurpose/social-publishing";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return ApiResponseBuilder.badRequest("projectId is required");

  const links = await (prisma as any).shareLink.findMany({
    where: { projectId, project: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ApiResponseBuilder.success({ links: links.map(serializeShareLink) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const json = await request.json().catch(() => null);
  const parsed = shareLinkCreateSchema.safeParse(json);
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid share link request", {
      errors: parsed.error.flatten(),
    });
  }

  const input = parsed.data;
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) return ApiResponseBuilder.notFound("Project not found");

  if (input.clipId) {
    const clip = await prisma.clip.findFirst({
      where: { id: input.clipId, projectId: input.projectId, project: { userId: user.id } },
      select: { id: true },
    });
    if (!clip) return ApiResponseBuilder.notFound("Clip not found");
  }

  const link = await (prisma as any).shareLink.create({
    data: {
      projectId: input.projectId,
      clipId: input.clipId ?? null,
      token: generateShareToken(),
      permission: input.permission,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });

  return ApiResponseBuilder.success({ link: serializeShareLink(link) }, "Share link created");
}
