/**
 * Voice Translation API Route
 *
 * POST /api/voice-translations/translate
 * Translates a video's audio to multiple languages using AI-powered voice synthesis.
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles HTTP request/response
 * - Dependency Inversion: Uses use case abstraction
 *
 * @module api/voice-translations/translate
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { TranslateVideoVoiceUseCase } from '@/lib/application/use-cases/TranslateVideoVoiceUseCase';
import { queueVoiceTranslationJob } from '@/lib/voice-translation-queue';
import { logger } from '@/lib/logger';

const translateVoiceSchema = z.object({
  assetId: z.string().cuid('Invalid asset ID'),
  targetLanguages: z
    .array(z.string().length(2, 'Language code must be 2 letters'))
    .min(1, 'At least one language required')
    .max(3, 'Maximum 3 languages per request'),
  voiceId: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val ||
        ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(val),
      'Invalid voice ID'
    ),
});

export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Step 2: Parse and validate request body
    const body = await request.json();
    const validation = translateVoiceSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid voice translation request', {
        errors: validation.error.errors,
        userId: user.id,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { assetId, targetLanguages, voiceId } = validation.data;

    logger.info('Voice translation API request', {
      userId: user.id,
      assetId,
      targetLanguages,
      voiceId,
    });

    // Step 3: Execute use case
    const useCase = container.get<TranslateVideoVoiceUseCase>(
      TYPES.TranslateVideoVoiceUseCase
    );

    const result = await useCase.execute({
      userId: user.id,
      assetId,
      targetLanguages,
      voiceId,
    });

    // Step 4: Queue background jobs for newly created translations
    for (const translation of result.translations) {
      if (translation.status === 'queued') {
        queueVoiceTranslationJob({
          voiceTranslationId: translation.translationId,
          assetId,
          language: translation.language,
          voiceId,
        });
      }
    }

    logger.info('Voice translation API completed', {
      userId: user.id,
      assetId,
      summary: result.summary,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Voice translation API error', { error });

    const message = error instanceof Error ? error.message : 'Unknown error';

    // Handle different error types
    if (message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }

    if (message.includes('Access denied') || message.includes('forbidden')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 403 }
      );
    }

    if (
      message.includes('required') ||
      message.includes('Invalid') ||
      message.includes('must be')
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Voice translation failed',
        details: message,
      },
      { status: 500 }
    );
  }
}
