export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/utils/error-handler";
import {
  buildEnhancementRenderPlan,
  clampEnhancementToClip,
  clipEnhancementSchema,
  normalizeEnhancementPayload,
  serializeEnhancement,
} from "@/lib/repurpose/creative-enhancements";

async function getAuthorizedClip(clipId: string, userId: string) {
  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
    select: {
      id: true,
      startMs: true,
      endMs: true,
      project: { select: { userId: true } },
    },
  });

  if (!clip) return { error: ApiResponseBuilder.notFound("Clip not found") };
  if (clip.project.userId !== userId) {
    return { error: ApiResponseBuilder.forbidden("Access denied") };
  }
  return { clip };
}

export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

    const authorization = await getAuthorizedClip(params.id, user.id);
    if (authorization.error) return authorization.error;

    const rows = await (prisma as any).clipEnhancement.findMany({
      where: { clipId: params.id },
      orderBy: [{ startMs: "asc" }, { createdAt: "asc" }],
    });
    const enhancements = rows.map(serializeEnhancement);

    return ApiResponseBuilder.success({
      enhancements,
      renderPlan: buildEnhancementRenderPlan(enhancements),
    });
  },
);

export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

    const json = await request.json();
    const parsed = clipEnhancementSchema.safeParse(json);
    if (!parsed.success) {
      return ApiResponseBuilder.badRequest("Invalid request body", {
        errors: parsed.error.flatten(),
      });
    }

    const authorization = await getAuthorizedClip(params.id, user.id);
    if (authorization.error) return authorization.error;
    const clip = authorization.clip!;
    const clipDurationMs = clip.endMs - clip.startMs;
    const clamped = clampEnhancementToClip(parsed.data, clipDurationMs);
    if (!clamped) {
      return ApiResponseBuilder.badRequest("Enhancement timing is outside the clip duration");
    }

    const row = await (prisma as any).clipEnhancement.create({
      data: {
        clipId: params.id,
        type: parsed.data.type,
        startMs: clamped.startMs,
        endMs: clamped.endMs,
        payload: normalizeEnhancementPayload(parsed.data.type, parsed.data.payload),
        enabled: parsed.data.enabled,
      },
    });

    return ApiResponseBuilder.success(
      { enhancement: serializeEnhancement(row) },
      "Enhancement saved",
    );
  },
);
