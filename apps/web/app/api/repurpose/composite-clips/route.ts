/**
 * Composite Clips API Route
 *
 * POST /api/repurpose/composite-clips
 * Creates a composite clip by stitching multiple video segments together.
 *
 * Request body:
 * - projectId: string - Project ID
 * - title: string - Composite clip title
 * - description?: string - Optional description
 * - segments: Array of ClipSegment - Video segments to stitch
 * - outputFormat?: 'mp4' | 'mov' | 'webm' - Output format
 * - outputQuality?: 'low' | 'medium' | 'high' | 'max' - Output quality
 *
 * Response:
 * - clip: Clip - Created composite clip
 * - durationMs: number - Total duration in milliseconds
 * - fileSizeBytes: number - File size in bytes
 * - segmentCount: number - Number of segments
 * - warnings: string[] - Any warnings generated during processing
 *
 * @module Composite Clips API
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { CreateCompositeClipUseCase } from '@/lib/application/use-cases/CreateCompositeClipUseCase';
import { ApiResponseBuilder } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Clip segment schema
 */
const clipSegmentSchema = z.object({
  clipId: z.string().min(1, 'Clip ID is required'),
  startMs: z.number().min(0, 'Start time must be non-negative'),
  endMs: z.number().positive('End time must be positive'),
  order: z.number().int().min(0, 'Order must be non-negative'),
  title: z.string().optional(),
  transitionType: z.enum(['cut', 'fade', 'crossfade']).optional(),
});

/**
 * Request body validation schema
 */
const schema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  segments: z.array(clipSegmentSchema).min(1, 'At least one segment required').max(50, 'Maximum 50 segments allowed'),
  outputFormat: z.enum(['mp4', 'mov', 'webm']).optional(),
  outputQuality: z.enum(['low', 'medium', 'high', 'max']).optional(),
});

type RequestBody = z.infer<typeof schema>;

/**
 * POST /api/repurpose/composite-clips
 * Create a composite clip
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Step 1: Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    logger.warn('Unauthorized composite clip creation attempt');
    return ApiResponseBuilder.unauthorized('Authentication required');
  }

  // Step 2: Parse and validate request body
  const body = await request.json();
  const result = schema.safeParse(body);

  if (!result.success) {
    logger.warn('Invalid composite clip request', {
      errors: result.error.errors,
    });
    return ApiResponseBuilder.badRequest(
      'Invalid request data',
      result.error.errors
    );
  }

  const { projectId, title, description, segments, outputFormat, outputQuality } = result.data;

  logger.info('Composite clip creation requested', {
    userId: user.id,
    projectId,
    title,
    segmentCount: segments.length,
  });

  // Step 3: Calculate total duration
  const totalDurationMs = segments.reduce(
    (sum, segment) => sum + (segment.endMs - segment.startMs),
    0
  );

  // Step 4: Execute use case
  const useCase = container.get<CreateCompositeClipUseCase>(TYPES.CreateCompositeClipUseCase);

  const output = await useCase.execute({
    projectId,
    userId: user.id,
    definition: {
      title,
      description,
      segments,
      totalDurationMs,
      outputFormat: outputFormat || 'mp4',
      outputQuality: outputQuality || 'medium',
    },
  });

  logger.info('Composite clip created successfully', {
    userId: user.id,
    projectId,
    clipId: output.clip.id,
    durationMs: output.durationMs,
    segmentCount: output.segmentCount,
    fileSizeBytes: output.fileSizeBytes,
    warningsCount: output.warnings.length,
  });

  // Step 5: Return response
  return ApiResponseBuilder.success({
    clip: output.clip,
    durationMs: output.durationMs,
    fileSizeBytes: output.fileSizeBytes,
    fileSizeMB: Math.round(output.fileSizeBytes / (1024 * 1024) * 100) / 100,
    segmentCount: output.segmentCount,
    warnings: output.warnings,
  });
});
