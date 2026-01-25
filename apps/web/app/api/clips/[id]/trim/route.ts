export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { TrimClipUseCase } from '@/lib/application/use-cases/TrimClipUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const schema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().positive(),
});

/**
 * PATCH /api/clips/[id]/trim
 *
 * Trim a clip by adjusting its start and end boundaries.
 * Invalidates existing captions and preview.
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Use Case orchestrates business logic
 * - Domain service validates trim boundaries
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

    const { startMs, endMs } = result.data;
    const { id } = params;

    logger.info('Clip trim API called', {
      clipId: id,
      startMs,
      endMs,
      userId: user.id,
    });

    // Step 3: Execute use case via DI container
    const useCase = container.get<TrimClipUseCase>(TYPES.TrimClipUseCase);

    const output = await useCase.execute({
      clipId: id,
      startMs,
      endMs,
      userId: user.id,
    });

    // Step 4: Return success response
    return ApiResponseBuilder.success(
      {
        clip: output.clip,
        captionsInvalidated: output.captionsInvalidated,
        message: output.captionsInvalidated
          ? 'Clip trimmed. Captions and preview invalidated - please regenerate.'
          : 'Clip trimmed successfully',
      },
      'Clip trimmed successfully'
    );
  }
);
