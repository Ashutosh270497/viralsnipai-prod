export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import {
  normalizeHashtags,
  serializeSocialPost,
  socialPostPatchSchema,
} from "@/lib/repurpose/social-publishing";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const post = await (prisma as any).socialPost.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!post) return ApiResponseBuilder.notFound("Social post not found");

  return ApiResponseBuilder.success({ post: serializeSocialPost(post) });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const existing = await (prisma as any).socialPost.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) return ApiResponseBuilder.notFound("Social post not found");
  if (existing.status === "published") {
    return ApiResponseBuilder.badRequest("Published posts cannot be edited");
  }

  const json = await request.json().catch(() => null);
  const parsed = socialPostPatchSchema.safeParse(json);
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid social post update", {
      errors: parsed.error.flatten(),
    });
  }

  const input = parsed.data;
  const updated = await (prisma as any).socialPost.update({
    where: { id: params.id },
    data: {
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.hashtags !== undefined ? { hashtags: normalizeHashtags(input.hashtags) } : {}),
      ...(input.cta !== undefined ? { cta: input.cta } : {}),
      ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
      ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl } : {}),
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
        : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata ?? {} } : {}),
    },
  });

  return ApiResponseBuilder.success({ post: serializeSocialPost(updated) }, "Social post updated");
}
