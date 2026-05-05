export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(["accepted", "rejected", "edited", "exported", "published"]),
  reason: z.string().trim().max(500).nullable().optional(),
  manualTrimDeltaMs: z.number().int().nullable().optional(),
  captionEditsCount: z.number().int().min(0).nullable().optional(),
  previewPlays: z.number().int().min(0).optional().default(0),
  exportedAt: z.string().datetime().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const clip = await (prisma as any).clip.findFirst({
    where: { id: params.id, project: { userId: user.id } },
    include: { project: { select: { workspaceId: true } } },
  });
  if (!clip) return ApiResponseBuilder.notFound("Clip not found");

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid feedback payload", { errors: parsed.error.flatten() });
  }

  const feedback = await (prisma as any).clipFeedback.create({
    data: {
      clipId: params.id,
      userId: user.id,
      workspaceId: clip.project.workspaceId ?? null,
      rating: parsed.data.rating ?? null,
      status: parsed.data.status,
      reason: parsed.data.reason ?? null,
      manualTrimDeltaMs: parsed.data.manualTrimDeltaMs ?? null,
      captionEditsCount: parsed.data.captionEditsCount ?? null,
      previewPlays: parsed.data.previewPlays,
      exportedAt: parsed.data.exportedAt ? new Date(parsed.data.exportedAt) : null,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      metadata: parsed.data.metadata ?? {},
    },
  });

  return ApiResponseBuilder.success({ feedback }, "Clip feedback recorded");
}
