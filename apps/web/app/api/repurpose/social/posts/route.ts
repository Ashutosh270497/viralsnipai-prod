export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import {
  normalizeHashtags,
  serializeSocialPost,
  socialPostDraftSchema,
} from "@/lib/repurpose/social-publishing";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const clipId = url.searchParams.get("clipId");

  const posts = await (prisma as any).socialPost.findMany({
    where: {
      userId: user.id,
      ...(projectId ? { projectId } : {}),
      ...(clipId ? { clipId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return ApiResponseBuilder.success({ posts: posts.map(serializeSocialPost) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const json = await request.json().catch(() => null);
  const parsed = socialPostDraftSchema.safeParse(json);
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid social post draft", {
      errors: parsed.error.flatten(),
    });
  }

  const input = parsed.data;
  const clip = await prisma.clip.findFirst({
    where: {
      id: input.clipId,
      projectId: input.projectId,
      project: { userId: user.id },
    },
    include: { project: true },
  });

  if (!clip) return ApiResponseBuilder.notFound("Clip not found");

  if (input.exportJobId) {
    const exportJob = await prisma.export.findFirst({
      where: { id: input.exportJobId, projectId: input.projectId, project: { userId: user.id } },
      select: { id: true },
    });
    if (!exportJob) return ApiResponseBuilder.badRequest("Export job does not belong to this project");
  }

  const post = await (prisma as any).socialPost.create({
    data: {
      userId: user.id,
      projectId: input.projectId,
      clipId: input.clipId,
      exportJobId: input.exportJobId ?? null,
      platform: input.platform,
      status: input.scheduledAt ? "scheduled" : "draft",
      title: input.title ?? clip.title ?? null,
      description: input.description ?? clip.summary ?? null,
      hashtags: normalizeHashtags(input.hashtags),
      cta: input.cta ?? clip.callToAction ?? null,
      thumbnailUrl: input.thumbnailUrl ?? clip.thumbnail ?? null,
      videoUrl: input.videoUrl ?? clip.previewPath ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      metadata: input.metadata ?? {},
    },
  });

  let scheduleJob = null;
  if (input.scheduledAt) {
    scheduleJob = await (prisma as any).scheduledPublishJob.create({
      data: {
        socialPostId: post.id,
        scheduledAt: new Date(input.scheduledAt),
        status: "scheduled",
      },
    });
  }

  return ApiResponseBuilder.success(
    { post: serializeSocialPost(post), scheduleJob },
    input.scheduledAt ? "Social post scheduled" : "Social post draft saved",
  );
}
