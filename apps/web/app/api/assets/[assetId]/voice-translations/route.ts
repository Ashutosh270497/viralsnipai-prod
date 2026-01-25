/**
 * Get Asset Voice Translations API Route
 *
 * GET /api/assets/[assetId]/voice-translations
 * Retrieves all voice translations for a specific asset.
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles HTTP request/response for fetching
 * - Dependency Inversion: Uses repository abstraction
 *
 * @module api/assets/[assetId]/voice-translations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IVoiceTranslationRepository } from '@/lib/domain/repositories/IVoiceTranslationRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  try {
    // Step 1: Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const assetId = params.assetId;

    logger.info('Fetching voice translations', {
      userId: user.id,
      assetId,
    });

    // Step 2: Verify asset exists and user has access
    const assetRepo = container.get<IAssetRepository>(TYPES.IAssetRepository);
    const asset = await assetRepo.findById(assetId);

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Step 3: Verify user owns the project
    const projectRepo = container.get<IProjectRepository>(
      TYPES.IProjectRepository
    );
    const project = await projectRepo.findById(asset.projectId);

    if (!project || project.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this asset' },
        { status: 403 }
      );
    }

    // Step 4: Get voice translations
    const voiceTranslationRepo = container.get<IVoiceTranslationRepository>(
      TYPES.IVoiceTranslationRepository
    );
    const translations = await voiceTranslationRepo.findByAssetId(assetId);

    logger.info('Voice translations fetched', {
      assetId,
      count: translations.length,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        assetId,
        sourceLanguage: asset.sourceLanguage || 'en',
        translations: translations.map((t) => ({
          id: t.id,
          language: t.language,
          audioUrl: t.audioUrl,
          status: t.status,
          voiceId: t.voiceId,
          translatedFrom: t.translatedFrom,
          processingTime: t.processingTime,
          error: t.error,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        count: translations.length,
      },
    });
  } catch (error) {
    logger.error('Get voice translations error', { error });

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch voice translations',
        details: message,
      },
      { status: 500 }
    );
  }
}
