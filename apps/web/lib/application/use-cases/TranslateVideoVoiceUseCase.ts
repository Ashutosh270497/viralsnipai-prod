/**
 * Translate Video Voice Use Case (Application Layer)
 *
 * Orchestrates the video voice translation workflow:
 * 1. Validate asset and user permissions
 * 2. Check for existing voice translations (avoid duplicates)
 * 3. Verify text translation exists (required for TTS)
 * 4. Create voice translation records (queued state)
 * 5. Jobs are processed separately by background queue
 *
 * SOLID Principles:
 * - Single Responsibility: Orchestrates voice translation workflow
 * - Dependency Inversion: Depends on repository interfaces
 * - Open/Closed: Can be extended without modification
 *
 * @module TranslateVideoVoiceUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { ITranscriptTranslationRepository } from '@/lib/domain/repositories/ITranscriptTranslationRepository';
import type { IVoiceTranslationRepository } from '@/lib/domain/repositories/IVoiceTranslationRepository';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface TranslateVideoVoiceInput {
  assetId: string;
  targetLanguages: string[];
  userId: string;
  voiceId?: string;
}

export interface TranslateVideoVoiceOutput {
  assetId: string;
  translations: Array<{
    language: string;
    translationId: string;
    status: 'created' | 'existing' | 'queued';
  }>;
  summary: {
    requested: number;
    created: number;
    existing: number;
    queued: number;
  };
}

@injectable()
export class TranslateVideoVoiceUseCase {
  constructor(
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.ITranscriptTranslationRepository)
    private transcriptTranslationRepo: ITranscriptTranslationRepository,
    @inject(TYPES.IVoiceTranslationRepository)
    private voiceTranslationRepo: IVoiceTranslationRepository
  ) {}

  async execute(input: TranslateVideoVoiceInput): Promise<TranslateVideoVoiceOutput> {
    const { assetId, targetLanguages, userId, voiceId } = input;

    logger.info('Starting video voice translation', {
      assetId,
      targetLanguages,
      userId,
    });

    // Step 1: Validate asset ownership
    const asset = await this.assetRepo.findById(assetId);
    if (!asset) {
      throw AppError.notFound('Asset not found');
    }

    const project = await this.projectRepo.findById(asset.projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this asset');
    }

    // Step 2: Validate asset has transcript
    if (!asset.transcript) {
      throw AppError.badRequest('Asset must be transcribed first');
    }

    // Step 3: Validate asset type is video
    if (asset.type !== 'video') {
      throw AppError.badRequest('Voice translation only supports video assets');
    }

    // Step 4: Process each target language
    const translations = [];
    let createdCount = 0;
    let existingCount = 0;
    let queuedCount = 0;

    const sourceLanguage = asset.sourceLanguage || 'en';

    for (const targetLang of targetLanguages) {
      logger.info('Processing voice translation for language', {
        targetLang,
        assetId,
      });

      // Skip source language
      if (targetLang === sourceLanguage) {
        logger.info('Skipping source language', { targetLang });
        continue;
      }

      // Check if voice translation already exists
      const existingVoiceTranslation =
        await this.voiceTranslationRepo.findByAssetAndLanguage(
          assetId,
          targetLang
        );

      if (existingVoiceTranslation) {
        translations.push({
          language: targetLang,
          translationId: existingVoiceTranslation.id,
          status: 'existing' as const,
        });
        existingCount++;
        continue;
      }

      // Verify text translation exists (required for TTS)
      const textTranslation =
        await this.transcriptTranslationRepo.findByAssetAndLanguage(
          assetId,
          targetLang
        );

      if (!textTranslation) {
        logger.warn('Text translation not found for language', {
          targetLang,
          assetId,
        });
        throw AppError.badRequest(
          `No text translation found for language: ${targetLang}. Please translate transcript first.`
        );
      }

      // Create voice translation record (queued state)
      const voiceTranslation = await this.voiceTranslationRepo.create({
        assetId,
        language: targetLang,
        translatedFrom: sourceLanguage,
        voiceId,
      });

      translations.push({
        language: targetLang,
        translationId: voiceTranslation.id,
        status: 'queued' as const,
      });

      createdCount++;
      queuedCount++;

      logger.info('Voice translation record created', {
        translationId: voiceTranslation.id,
        language: targetLang,
        assetId,
      });
    }

    logger.info('Video voice translation use case completed', {
      assetId,
      createdCount,
      existingCount,
      queuedCount,
    });

    return {
      assetId,
      translations,
      summary: {
        requested: targetLanguages.length,
        created: createdCount,
        existing: existingCount,
        queued: queuedCount,
      },
    };
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: TranslateVideoVoiceInput): void {
    if (!input.assetId) {
      throw AppError.badRequest('Asset ID is required');
    }
    if (!input.userId) {
      throw AppError.badRequest('User ID is required');
    }
    if (!input.targetLanguages || input.targetLanguages.length === 0) {
      throw AppError.badRequest('At least one target language is required');
    }
    if (input.targetLanguages.length > 3) {
      throw AppError.badRequest('Maximum 3 languages per request');
    }

    // Validate language codes format (2-letter ISO 639-1)
    const validLanguageCodePattern = /^[a-z]{2}$/;
    for (const lang of input.targetLanguages) {
      if (!validLanguageCodePattern.test(lang)) {
        throw AppError.badRequest(
          `Invalid language code: ${lang}. Must be 2-letter ISO 639-1 code.`
        );
      }
    }
  }
}
