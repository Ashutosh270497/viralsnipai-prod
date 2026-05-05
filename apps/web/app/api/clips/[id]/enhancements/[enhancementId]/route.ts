export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/utils/error-handler";
import {
  clampEnhancementToClip,
  clipEnhancementPatchSchema,
  normalizeEnhancementPayload,
  serializeEnhancement,
} from "@/lib/repurpose/creative-enhancements";

async function getAuthorizedEnhancement(clipId: string, enhancementId: string, userId: string) {
  const enhancement = await (prisma as any).clipEnhancement.findFirst({
    where: { id: enhancementId, clipId },
    include: {
      clip: {
        select: {
          id: true,
          startMs: true,
          endMs: true,
          project: { select: { userId: true } },
        },
      },
    },
  });

  if (!enhancement) return { error: ApiResponseBuilder.notFound("Enhancement not found") };
  if (enhancement.clip.project.userId !== userId) {
    return { error: ApiResponseBuilder.forbidden("Access denied") };
  }
  return { enhancement };
}

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: { id: string; enhancementId: string } }) => {
    const user = await getCurrentUser();
    if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

    const json = await request.json();
    const parsed = clipEnhancementPatchSchema.safeParse(json);
    if (!parsed.success) {
      return ApiResponseBuilder.badRequest("Invalid request body", {
        errors: parsed.error.flatten(),
      });
    }

    const authorization = await getAuthorizedEnhancement(params.id, params.enhancementId, user.id);
    if (authorization.error) return authorization.error;
    const existing = authorization.enhancement!;
    const nextType = parsed.data.type ?? existing.type;
    const nextTiming = clampEnhancementToClip(
      {
        startMs: parsed.data.startMs ?? existing.startMs,
        endMs: parsed.data.endMs ?? existing.endMs,
      },
      existing.clip.endMs - existing.clip.startMs,
    );
    if (!nextTiming) {
      return ApiResponseBuilder.badRequest("Enhancement timing is outside the clip duration");
    }

    const row = await (prisma as any).clipEnhancement.update({
      where: { id: params.enhancementId },
      data: {
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.startMs !== undefined || parsed.data.endMs !== undefined
          ? { startMs: nextTiming.startMs, endMs: nextTiming.endMs }
          : {}),
        ...(parsed.data.payload !== undefined
          ? { payload: normalizeEnhancementPayload(nextType, parsed.data.payload) }
          : {}),
        ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      },
    });

    return ApiResponseBuilder.success(
      { enhancement: serializeEnhancement(row) },
      "Enhancement updated",
    );
  },
);

export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string; enhancementId: string } }) => {
    const user = await getCurrentUser();
    if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

    const authorization = await getAuthorizedEnhancement(params.id, params.enhancementId, user.id);
    if (authorization.error) return authorization.error;

    await (prisma as any).clipEnhancement.delete({
      where: { id: params.enhancementId },
    });

    return ApiResponseBuilder.success({ deleted: true }, "Enhancement deleted");
  },
);
