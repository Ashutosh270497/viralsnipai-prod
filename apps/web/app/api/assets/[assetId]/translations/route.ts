export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { ITranscriptTranslationRepository } from '@/lib/domain/repositories/ITranscriptTranslationRepository';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { AppError } from '@/lib/utils/error-handler';
import { logger } from '@/lib/logger';

/**
 * GET /api/assets/[assetId]/translations
 *
 * Retrieve all transcript translations for a specific asset.
 * Requires asset ownership verification.
 *
 * Clean Architecture:
 * - Route validates auth and ownership
 * - Repositories handle data access
 * - Returns formatted translation list
 *
 * @param {string} assetId - The asset ID (from URL)
 *
 * @returns {array} List of translations with language, transcript, and metadata
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: { params: { assetId: string } }) => {
    // Step 1: Validate authentication
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    const { assetId } = params;

    logger.info('Asset translations retrieval API called', {
      assetId,
      userId: user.id,
    });

    // Step 2: Get repositories from DI container
    const assetRepo = container.get<IAssetRepository>(TYPES.IAssetRepository);
    const projectRepo = container.get<IProjectRepository>(TYPES.IProjectRepository);
    const translationRepo = container.get<ITranscriptTranslationRepository>(
      TYPES.ITranscriptTranslationRepository
    );

    // Step 3: Validate asset exists and user has access
    const asset = await assetRepo.findById(assetId);
    if (!asset) {
      return ApiResponseBuilder.notFound('Asset not found');
    }

    const project = await projectRepo.findById(asset.projectId);
    if (!project || project.userId !== user.id) {
      return ApiResponseBuilder.forbidden('Access denied to this asset');
    }

    // Step 4: Retrieve translations
    const translations = await translationRepo.findByAssetId(assetId);

    logger.info('Asset translations retrieved', {
      assetId,
      translationCount: translations.length,
    });

    // Step 5: Return formatted response
    return ApiResponseBuilder.success(
      {
        assetId,
        sourceLanguage: asset.sourceLanguage || 'en',
        translations: translations.map((t) => ({
          id: t.id,
          language: t.language,
          transcript: t.transcript,
          segments: t.segments,
          translatedFrom: t.translatedFrom,
          translatedAt: t.translatedAt,
        })),
        count: translations.length,
      },
      'Translations retrieved successfully'
    );
  }
);
