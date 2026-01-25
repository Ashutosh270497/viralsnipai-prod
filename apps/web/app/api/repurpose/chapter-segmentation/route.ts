/**
 * Chapter Segmentation API Route
 *
 * POST /api/repurpose/chapter-segmentation
 * Segments a video into logical chapters using AI-powered topic detection.
 *
 * Request body:
 * - projectId: string - Project ID
 * - assetId: string - Asset ID to segment
 * - targetChapterCount?: number - Optional target chapter count
 *
 * Response:
 * - chapters: Chapter[] - Array of detected chapters
 * - totalChapters: number - Total number of chapters
 * - totalDurationSec: number - Total video duration in seconds
 * - analysisMethod: 'ai' | 'fallback' - Method used for segmentation
 *
 * @module Chapter Segmentation API
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { SegmentChaptersUseCase } from '@/lib/application/use-cases/SegmentChaptersUseCase';
import { ApiResponseBuilder } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Request body validation schema
 */
const schema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  assetId: z.string().min(1, 'Asset ID is required'),
  targetChapterCount: z.number().int().positive().optional(),
});

type RequestBody = z.infer<typeof schema>;

/**
 * POST /api/repurpose/chapter-segmentation
 * Segment video into chapters
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Step 1: Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    logger.warn('Unauthorized chapter segmentation attempt');
    return ApiResponseBuilder.unauthorized('Authentication required');
  }

  // Step 2: Parse and validate request body
  const body = await request.json();
  const result = schema.safeParse(body);

  if (!result.success) {
    logger.warn('Invalid chapter segmentation request', {
      errors: result.error.errors,
    });
    return ApiResponseBuilder.badRequest(
      'Invalid request data',
      result.error.errors
    );
  }

  const { projectId, assetId, targetChapterCount } = result.data;

  logger.info('Chapter segmentation requested', {
    userId: user.id,
    projectId,
    assetId,
    targetChapterCount,
  });

  // Step 3: Execute use case
  const useCase = container.get<SegmentChaptersUseCase>(TYPES.SegmentChaptersUseCase);

  const output = await useCase.execute({
    projectId,
    assetId,
    userId: user.id,
    targetChapterCount,
  });

  logger.info('Chapter segmentation successful', {
    userId: user.id,
    projectId,
    assetId,
    chaptersGenerated: output.totalChapters,
    method: output.analysisMethod,
  });

  // Step 4: Return response
  return ApiResponseBuilder.success({
    chapters: output.chapters,
    totalChapters: output.totalChapters,
    totalDurationSec: output.totalDurationSec,
    analysisMethod: output.analysisMethod,
    assetId: output.assetId,
    projectId: output.projectId,
  });
});
