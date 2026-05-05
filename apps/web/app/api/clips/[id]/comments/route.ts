export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(3000),
  timestampMs: z.number().int().min(0).nullable().optional(),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const clip = await prisma.clip.findFirst({
    where: { id: params.id, project: { userId: user.id } },
    select: { id: true },
  });
  if (!clip) return ApiResponseBuilder.notFound("Clip not found");

  const comments = await (prisma as any).clipComment.findMany({
    where: { clipId: params.id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return ApiResponseBuilder.success({ comments });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const clip = await prisma.clip.findFirst({
    where: { id: params.id, project: { userId: user.id } },
    select: { id: true },
  });
  if (!clip) return ApiResponseBuilder.notFound("Clip not found");

  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid comment payload", { errors: parsed.error.flatten() });
  }

  const comment = await (prisma as any).clipComment.create({
    data: {
      clipId: params.id,
      userId: user.id,
      body: parsed.data.body,
      timestampMs: parsed.data.timestampMs ?? null,
    },
  });

  return ApiResponseBuilder.success({ comment }, "Comment added");
}
