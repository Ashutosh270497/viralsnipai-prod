export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { container } from "@/lib/infrastructure/di/container";
import { TYPES } from "@/lib/infrastructure/di/types";
import type { IClipRepository } from "@/lib/domain/repositories/IClipRepository";
import type { IProjectRepository } from "@/lib/domain/repositories/IProjectRepository";
import { withErrorHandling } from "@/lib/utils/error-handler";
import { logger } from "@/lib/logger";
import { clipReviewStatusRequestSchema } from "@/app/api/clips/[id]/review-status/schema";
import { assertSameOriginRequest } from "@/lib/security/origin";

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: { id: string } }) => {
    const originError = assertSameOriginRequest(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized("Authentication required");
    }

    const parsed = clipReviewStatusRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return ApiResponseBuilder.badRequest("Invalid review status", {
        errors: parsed.error.flatten(),
      });
    }

    const clipRepo = container.get<IClipRepository>(TYPES.IClipRepository);
    const projectRepo = container.get<IProjectRepository>(TYPES.IProjectRepository);

    const clip = await clipRepo.findById(params.id);
    if (!clip) {
      return ApiResponseBuilder.notFound("Clip not found");
    }

    const project = await projectRepo.findById(clip.projectId);
    if (!project || project.userId !== user.id) {
      return ApiResponseBuilder.forbidden("Access denied");
    }

    const updated = await clipRepo.updateReviewStatus(params.id, parsed.data.reviewStatus);
    logger.info("Clip review status updated", {
      clipId: params.id,
      projectId: clip.projectId,
      reviewStatus: parsed.data.reviewStatus,
      userId: user.id,
    });

    return ApiResponseBuilder.success(
      {
        clip: updated,
      },
      "Clip review status updated",
    );
  },
);
