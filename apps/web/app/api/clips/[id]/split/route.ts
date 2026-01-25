export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { SplitClipUseCase } from '@/lib/application/use-cases/SplitClipUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const schema = z.object({
  splitAtMs: z.number().int().positive(),
});

/**
 * POST /api/clips/[id]/split
 *
 * Split a clip into two clips at the specified timestamp.
 * Creates two new clips and deletes the original.
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Use Case orchestrates business logic
 * - Domain service validates split point
 * - Repositories handle data persistence
 */
export const POST = withErrorHandling(
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

    const { splitAtMs } = result.data;
    const { id } = params;

    logger.info('Clip split API called', {
      clipId: id,
      splitAtMs,
      userId: user.id,
    });

    // Step 3: Execute use case via DI container
    const useCase = container.get<SplitClipUseCase>(TYPES.SplitClipUseCase);

    const output = await useCase.execute({
      clipId: id,
      splitAtMs,
      userId: user.id,
    });

    // Step 4: Return success response
    return ApiResponseBuilder.success(
      {
        firstClip: output.firstClip,
        secondClip: output.secondClip,
        originalClipDeleted: output.originalClipDeleted,
      },
      'Clip split successfully'
    );
  }
);
