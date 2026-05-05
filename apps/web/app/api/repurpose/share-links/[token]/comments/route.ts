export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(3000),
  timestampMs: z.number().int().min(0).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const link = await (prisma as any).shareLink.findUnique({
    where: { token: params.token },
    select: { id: true, clipId: true, permission: true, expiresAt: true },
  });
  if (!link) return ApiResponseBuilder.notFound("Share link not found");
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return ApiResponseBuilder.forbidden("Share link has expired");
  if (!link.clipId) return ApiResponseBuilder.badRequest("Project-level comments are not supported yet");
  if (link.permission !== "review" && link.permission !== "approve") {
    return ApiResponseBuilder.forbidden("This share link does not allow comments");
  }

  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid comment payload", { errors: parsed.error.flatten() });
  }

  const comment = await (prisma as any).clipComment.create({
    data: {
      clipId: link.clipId,
      shareLinkId: link.id,
      body: parsed.data.body,
      timestampMs: parsed.data.timestampMs ?? null,
    },
  });

  return ApiResponseBuilder.success({ comment }, "Review comment added");
}
