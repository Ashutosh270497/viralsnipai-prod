export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { UpdateClipUseCase } from '@/lib/application/use-cases/UpdateClipUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const schema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  callToAction: z.string().optional(),
});

/**
 * PATCH /api/clips/[id]
 *
 * Update clip properties (title, summary, callToAction).
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

    const { id } = params;

    logger.info('Clip update API called', {
      clipId: id,
      updates: result.data,
      userId: user.id,
    });

    // Step 3: Execute use case via DI container
    const useCase = container.get<UpdateClipUseCase>(TYPES.UpdateClipUseCase);

    const output = await useCase.execute({
      clipId: id,
      userId: user.id,
      updates: result.data,
    });

    // Step 4: Return success response
    return ApiResponseBuilder.success(
      {
        clip: output.clip,
        fieldsUpdated: output.fieldsUpdated,
      },
      'Clip updated successfully'
    );
  }
);
