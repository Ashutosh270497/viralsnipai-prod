export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { QueueExportUseCase } from '@/lib/application/use-cases/QueueExportUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder, ErrorCodes } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import {
  assertMediaUsageAllowed,
  recordMediaUsage,
  resolveUserPlanForMedia,
} from '@/lib/media/v1-media-policy';

const schema = z.object({
  projectId: z.string(),
  clipIds: z.array(z.string()).min(1),
  preset: z.enum(['shorts_9x16_1080', 'square_1x1_1080', 'portrait_4x5_1080', 'landscape_16x9_1080']),
  includeCaptions: z.boolean().optional().default(false),
});

/**
 * POST /api/exports
 *
 * Queue an export job for selected clips.
 * Creates export record and queues background processing.
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Use Case orchestrates business logic
 * - Domain services handle export queuing
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

  const { projectId, clipIds, preset, includeCaptions } = result.data;

  logger.info('Export started', {
    projectId,
    clipIds,
    preset,
    includeCaptions,
    userId: user.id,
  });

  const billingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, subscriptionTier: true },
  });
  const plan = resolveUserPlanForMedia(billingUser ?? {});
  const usageGate = await assertMediaUsageAllowed({
    userId: user.id,
    plan,
    feature: 'video_export',
  });
  if (!usageGate.allowed) {
    logger.warn('Export blocked by usage limit', {
      userId: user.id,
      projectId,
      plan,
      used: usageGate.used,
      limit: usageGate.limit,
    });
    return ApiResponseBuilder.errorResponse(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      `Monthly export limit reached for your ${plan} plan.`,
      429,
      { limit: usageGate.limit, used: usageGate.used }
    );
  }

  // Step 3: Execute use case via DI container
  const useCase = container.get<QueueExportUseCase>(TYPES.QueueExportUseCase);

  try {
    const output = await useCase.execute({
      projectId,
      clipIds,
      preset,
      includeCaptions,
      userId: user.id,
    });

    await recordMediaUsage({
      userId: user.id,
      feature: 'video_export',
      metadata: {
        projectId,
        exportId: output.export.id,
        clipCount: clipIds.length,
        preset,
        includeCaptions,
      },
    });

    logger.info('Export queued successfully', {
      userId: user.id,
      projectId,
      exportId: output.export.id,
    });

    // Step 4: Return success response
    return ApiResponseBuilder.success(
      {
        export: output.export,
        queued: output.queued,
      },
      'Export queued successfully'
    );
  } catch (error) {
    logger.error('Export failed to queue', {
      userId: user.id,
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});
