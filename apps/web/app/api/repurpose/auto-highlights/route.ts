export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { container } from "@/lib/infrastructure/di/container";
import { TYPES } from "@/lib/infrastructure/di/types";
import { GenerateAutoHighlightsUseCase } from "@/lib/application/use-cases/GenerateAutoHighlightsUseCase";
import { ApiResponseBuilder, ErrorCodes } from "@/lib/api/response";
import { AppError, withErrorHandling } from "@/lib/utils/error-handler";
import { logger } from "@/lib/logger";
import { autoHighlightsRequestSchema } from "@/app/api/repurpose/auto-highlights/schema";

export const POST = withErrorHandling(async (request: Request) => {
  // Step 1: Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    logger.warn("Auto-highlights request without authentication");
    return ApiResponseBuilder.errorResponse(
      ErrorCodes.UNAUTHORIZED,
      "Authentication required",
      401,
    );
  }

  // Step 2: Parse and validate request body
  let parsedData;
  try {
    const body = await request.json();
    parsedData = autoHighlightsRequestSchema.parse(body);
  } catch (error) {
    logger.error("Auto-highlights validation failed", { error });
    throw AppError.validation(
      "Invalid request data",
      error instanceof Error ? error.message : undefined,
    );
  }

  logger.info("Auto-highlights request received", {
    userId: user.id,
    assetId: parsedData.assetId,
    model: parsedData.model,
    targetClips: parsedData.target,
    clipLengthPreset: parsedData.clipLengthPreset,
    mode: parsedData.mode,
    hasCustomization: !!(parsedData.brief || parsedData.audience || parsedData.tone),
  });

  // Step 3: Get use case from DI container
  const useCase = container.get<GenerateAutoHighlightsUseCase>(TYPES.GenerateAutoHighlightsUseCase);

  let result;
  try {
    // Step 4: Execute use case
    result = await useCase.execute({
      assetId: parsedData.assetId,
      userId: user.id,
      options: {
        targetClipCount: parsedData.target,
        model: parsedData.model,
        audience: parsedData.audience,
        tone: parsedData.tone,
        brief: parsedData.brief,
        callToAction: parsedData.callToAction,
        mode: parsedData.mode,
        clipLengthPreset: parsedData.clipLengthPreset,
      },
    });
  } catch (error) {
    logger.error("Clip generation failed", {
      userId: user.id,
      assetId: parsedData.assetId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  logger.info("Auto-highlights generation completed", {
    userId: user.id,
    assetId: result.assetId,
    clipsCreated: result.clips.length,
    averageViralityScore: result.analytics.averageViralityScore,
    transcriptionGenerated: result.analytics.transcriptionGenerated,
  });

  // Step 5: Return standardized response
  return ApiResponseBuilder.successResponse({
    clips: result.clips,
    analytics: result.analytics,
  });
});
