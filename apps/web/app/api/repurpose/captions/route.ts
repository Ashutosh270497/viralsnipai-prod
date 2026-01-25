export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { GenerateCaptionsUseCase } from '@/lib/application/use-cases/GenerateCaptionsUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const schema = z.object({
  clipId: z.string(),
});

/**
 * POST /api/repurpose/captions
 *
 * Generate captions for a clip from its transcript.
 * Creates SRT file and extracts video preview.
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Use Case orchestrates business logic
 * - Domain services handle caption generation and video extraction
 * - Repositories handle data persistence
 */
export const POST = withErrorHandling(async (request: Request) => {
  // Step 1: Validate authentication
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized('Authentication required');
  }

  // Step 2: Validate request body
  const json = await request.json();
  const result = schema.safeParse(json);

  if (!result.success) {
    return ApiResponseBuilder.badRequest('Invalid request body', {
      errors: result.error.flatten(),
    });
  }

  const { clipId } = result.data;

  logger.info('Caption generation API called', {
    clipId,
    userId: user.id,
  });

  // Step 3: Execute use case via DI container
  const useCase = container.get<GenerateCaptionsUseCase>(TYPES.GenerateCaptionsUseCase);

  const output = await useCase.execute({
    clipId,
    userId: user.id,
    options: {
      maxWordsPerCaption: 4,
      maxDurationMs: 2000,
    },
  });

  // Step 4: Return success response
  return ApiResponseBuilder.success(
    {
      clip: output.clip,
      analytics: {
        captionGenerated: output.captionGenerated,
        previewGenerated: output.previewGenerated,
      },
    },
    'Captions generated successfully'
  );
});
