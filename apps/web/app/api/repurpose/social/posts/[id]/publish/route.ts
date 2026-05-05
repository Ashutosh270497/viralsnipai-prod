export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import {
  getPublisherAdapter,
  serializeSocialPost,
  socialPlatformSchema,
  type SocialPlatform,
} from "@/lib/repurpose/social-publishing";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const post = await (prisma as any).socialPost.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!post) return ApiResponseBuilder.notFound("Social post not found");
  if (post.status === "published") return ApiResponseBuilder.badRequest("Post is already published");

  const platform = socialPlatformSchema.safeParse(post.platform);
  if (!platform.success) return ApiResponseBuilder.badRequest("Unsupported platform");

  // Real platform adapters are intentionally placeholders until OAuth credentials
  // and token encryption are configured for each platform. Mock is the only live
  // publisher in Phase 9.
  const adapterMode = process.env.SOCIAL_PUBLISHER_MODE === "real" ? "real" : "mock";
  const adapter = getPublisherAdapter(platform.data as SocialPlatform, adapterMode);
  const connection = await adapter.validateConnection(user.id, platform.data);
  if (!connection.ok) {
    const failed = await (prisma as any).socialPost.update({
      where: { id: post.id },
      data: { status: "failed", error: connection.reason ?? "Social account is not connected" },
    });
    return ApiResponseBuilder.badRequest(connection.reason ?? "Social account is not connected", {
      post: serializeSocialPost(failed),
    });
  }

  try {
    await (prisma as any).socialPost.update({
      where: { id: post.id },
      data: { status: "publishing", error: null },
    });
    const result = await adapter.publish({
      id: post.id,
      platform: platform.data,
      title: post.title,
      description: post.description,
      videoUrl: post.videoUrl,
      thumbnailUrl: post.thumbnailUrl,
      scheduledAt: post.scheduledAt,
    });
    const updated = await (prisma as any).socialPost.update({
      where: { id: post.id },
      data: {
        status: result.status,
        publishedAt: result.status === "published" ? new Date() : null,
        metadata: {
          ...(post.metadata ?? {}),
          publisher: adapterMode,
          externalId: result.externalId ?? null,
          publishedUrl: result.url ?? null,
        },
      },
    });
    return ApiResponseBuilder.success({ post: serializeSocialPost(updated), result }, "Publish handled");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    const failed = await (prisma as any).socialPost.update({
      where: { id: post.id },
      data: { status: "failed", error: message },
    });
    return ApiResponseBuilder.badRequest(message, { post: serializeSocialPost(failed) });
  }
}
