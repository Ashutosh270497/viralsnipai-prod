export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { QueueExportUseCase } from '@/lib/application/use-cases/QueueExportUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

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

  logger.info('Export queue API called', {
    projectId,
    clipIds,
    preset,
    includeCaptions,
    userId: user.id,
  });

  // Step 3: Execute use case via DI container
  const useCase = container.get<QueueExportUseCase>(TYPES.QueueExportUseCase);

  const output = await useCase.execute({
    projectId,
    clipIds,
    preset,
    includeCaptions,
    userId: user.id,
  });

  // Step 4: Return success response
  return ApiResponseBuilder.success(
    {
      export: output.export,
      queued: output.queued,
    },
    'Export queued successfully'
  );
});
