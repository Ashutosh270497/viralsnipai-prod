export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { UpdateProjectClipOrderUseCase } from '@/lib/application/use-cases/UpdateProjectClipOrderUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const schema = z.object({
  clipIds: z.array(z.string().min(1)),
});

/**
 * PATCH /api/projects/[id]/clip-order
 *
 * Update the display order of clips within a project.
 * Clips will be ordered based on their position in the array.
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Use Case orchestrates business logic
 * - Repositories handle data persistence
 */
export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: { id: string } }) => {
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

    const { clipIds } = result.data;
    const { id: projectId } = params;

    logger.info('Clip order update API called', {
      projectId,
      clipCount: clipIds.length,
      userId: user.id,
    });

    // Step 3: Execute use case via DI container
    const useCase = container.get<UpdateProjectClipOrderUseCase>(
      TYPES.UpdateProjectClipOrderUseCase
    );

    const output = await useCase.execute({
      projectId,
      clipIds,
      userId: user.id,
    });

    // Step 4: Return success response
    return ApiResponseBuilder.success(
      {
        success: output.success,
        clipsReordered: output.clipsReordered,
      },
      'Clip order updated successfully'
    );
  }
);
