export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { TranslateTranscriptUseCase } from '@/lib/application/use-cases/TranslateTranscriptUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

/**
 * Request validation schema
 */
const schema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  targetLanguages: z
    .array(z.string().length(2, 'Language codes must be ISO 639-1 format'))
    .min(1, 'At least one target language is required')
    .max(6, 'Maximum 6 languages allowed'),
});

/**
 * POST /api/translations/transcript
 *
 * Translate video transcript to one or more target languages.
 * Supports segment-level translation with preserved timing.
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Use Case orchestrates translation workflow
 * - TranslationService handles AI-powered translation
 * - Repositories handle data persistence
 *
 * @body {string} assetId - The asset ID to translate
 * @body {string[]} targetLanguages - Array of ISO 639-1 language codes (e.g., ['hi', 'ta'])
 *
 * @returns {object} Translation results with status for each language
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

  const { assetId, targetLanguages } = result.data;

  logger.info('Transcript translation API called', {
    assetId,
    targetLanguages,
    userId: user.id,
  });

  // Step 3: Execute use case via DI container
  const useCase = container.get<TranslateTranscriptUseCase>(
    TYPES.TranslateTranscriptUseCase
  );

  const output = await useCase.execute({
    assetId,
    targetLanguages,
    userId: user.id,
  });

  // Step 4: Return success response
  return ApiResponseBuilder.success(
    {
      assetId: output.assetId,
      translations: output.translations,
      summary: {
        requested: targetLanguages.length,
        created: output.translations.filter((t) => t.status === 'created').length,
        existing: output.translations.filter((t) => t.status === 'existing').length,
      },
    },
    'Transcript translation completed'
  );
});
