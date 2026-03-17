export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { container } from "@/lib/infrastructure/di/container";
import { TYPES } from "@/lib/infrastructure/di/types";
import { GenerateAutoHighlightsUseCase } from "@/lib/application/use-cases/GenerateAutoHighlightsUseCase";
import { ApiResponseBuilder, ErrorCodes } from "@/lib/api/response";
import { AppError, withErrorHandling } from "@/lib/utils/error-handler";
import { logger } from "@/lib/logger";
import { HIGHLIGHT_MODEL_VALUES } from "@/lib/constants/repurpose";

const HIGHLIGHT_MODELS = HIGHLIGHT_MODEL_VALUES;

const schema = z.object({
  assetId: z.string(),
  strategy: z.string().optional(),
  target: z.number().min(1).max(12).optional(),
  model: z.string().optional().transform((val) => {
    if (!val || val.trim().length === 0) return undefined;
    const trimmed = val.trim();
    return HIGHLIGHT_MODELS.includes(trimmed as any) ? trimmed : undefined;
  }),
  brief: z.string().optional().transform((val) => {
    if (!val || val.trim().length === 0) return undefined;
    return val.trim().slice(0, 600);
  }),
  audience: z.string().optional().transform((val) => {
    if (!val || val.trim().length === 0) return undefined;
    return val.trim().slice(0, 160);
  }),
  tone: z.string().optional().transform((val) => {
    if (!val || val.trim().length === 0) return undefined;
    return val.trim().slice(0, 160);
  }),
  callToAction: z.string().optional().transform((val) => {
    if (!val || val.trim().length === 0) return undefined;
    return val.trim().slice(0, 200);
  })
});

export const POST = withErrorHandling(async (request: Request) => {
  // Step 1: Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    logger.warn('Auto-highlights request without authentication');
    return ApiResponseBuilder.errorResponse(
      ErrorCodes.UNAUTHORIZED,
      'Authentication required',
      401
    );
  }

  // Step 2: Parse and validate request body
  let parsedData;
  try {
    const body = await request.json();
    parsedData = schema.parse(body);
  } catch (error) {
    logger.error('Auto-highlights validation failed', { error });
    throw AppError.validation(
      'Invalid request data',
      error instanceof Error ? error.message : undefined
    );
  }

  logger.info('Auto-highlights request received', {
    userId: user.id,
    assetId: parsedData.assetId,
    model: parsedData.model,
    targetClips: parsedData.target,
    hasCustomization: !!(parsedData.brief || parsedData.audience || parsedData.tone),
  });

  // Step 3: Get use case from DI container
  const useCase = container.get<GenerateAutoHighlightsUseCase>(
    TYPES.GenerateAutoHighlightsUseCase
  );

  // Step 4: Execute use case
  const result = await useCase.execute({
    assetId: parsedData.assetId,
    userId: user.id,
    options: {
      targetClipCount: parsedData.target,
      model: parsedData.model,
      audience: parsedData.audience,
      tone: parsedData.tone,
      brief: parsedData.brief,
      callToAction: parsedData.callToAction,
    },
  });

  logger.info('Auto-highlights generation completed', {
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
