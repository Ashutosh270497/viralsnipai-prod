export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { scheduleSocialPostSchema, serializeSocialPost } from "@/lib/repurpose/social-publishing";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const json = await request.json().catch(() => null);
  const parsed = scheduleSocialPostSchema.safeParse(json);
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid schedule request", {
      errors: parsed.error.flatten(),
    });
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (scheduledAt.getTime() <= Date.now() + 30_000) {
    return ApiResponseBuilder.badRequest("scheduledAt must be at least 30 seconds in the future");
  }

  const post = await (prisma as any).socialPost.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!post) return ApiResponseBuilder.notFound("Social post not found");
  if (post.status === "published") return ApiResponseBuilder.badRequest("Published posts cannot be scheduled");

  const updated = await (prisma as any).$transaction(async (tx: any) => {
    await tx.scheduledPublishJob.updateMany({
      where: { socialPostId: params.id, status: "scheduled" },
      data: { status: "cancelled", lastError: "Superseded by a newer schedule." },
    });
    const updatedPost = await tx.socialPost.update({
      where: { id: params.id },
      data: { status: "scheduled", scheduledAt, error: null },
    });
    const job = await tx.scheduledPublishJob.create({
      data: { socialPostId: params.id, scheduledAt, status: "scheduled" },
    });
    return { post: updatedPost, job };
  });

  return ApiResponseBuilder.success(
    { post: serializeSocialPost(updated.post), scheduleJob: updated.job },
    "Social post scheduled",
  );
}
