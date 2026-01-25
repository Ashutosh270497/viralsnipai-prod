/**
 * Translate Transcript Use Case
 *
 * Orchestrates the transcript translation workflow:
 * 1. Validate asset and user permissions
 * 2. Check for existing translations (avoid duplicates)
 * 3. Parse transcript (handles JSON and plain text)
 * 4. Translate to target language(s) using TranslationService
 * 5. Store translations via repository
 *
 * SOLID Compliant: Depends on repository interfaces, not concrete implementations
 *
 * @module TranslateTranscriptUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { ITranscriptTranslationRepository } from '@/lib/domain/repositories/ITranscriptTranslationRepository';
import { TranslationService } from '@/lib/domain/services/TranslationService';
import type { TranscriptSegment } from '@/lib/domain/services/TranslationService';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface TranslateTranscriptInput {
  assetId: string;
  targetLanguages: string[];
  userId: string;
}

export interface TranslateTranscriptOutput {
  assetId: string;
  translations: Array<{
    language: string;
    translationId: string;
    status: 'created' | 'existing';
  }>;
}

@injectable()
export class TranslateTranscriptUseCase {
  constructor(
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.ITranscriptTranslationRepository)
    private translationRepo: ITranscriptTranslationRepository,
    @inject(TYPES.TranslationService) private translationService: TranslationService
  ) {}

  async execute(input: TranslateTranscriptInput): Promise<TranslateTranscriptOutput> {
    const { assetId, targetLanguages, userId } = input;

    logger.info('Starting transcript translation', {
      assetId,
      targetLanguages,
      userId,
    });

    // Step 1: Validate asset ownership
    const asset = await this.assetRepo.findById(assetId);
    if (!asset) {
      throw AppError.notFound('Asset not found');
    }

    // ✅ SOLID COMPLIANT: Use repository instead of direct Prisma
    const project = await this.projectRepo.findById(asset.projectId);

    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this asset');
    }

    // Step 2: Check if transcript exists
    if (!asset.transcript) {
      throw AppError.badRequest('Asset has no transcript to translate');
    }

    // Step 3: Parse transcript
    const transcriptData = this.parseTranscript(asset.transcript);

    // Step 4: Translate to each target language
    const translations = [];
    const sourceLanguage = asset.sourceLanguage || 'en';

    for (const targetLang of targetLanguages) {
      logger.info('Translating to language', { targetLang, assetId });

      // Skip source language
      if (targetLang === sourceLanguage) {
        logger.info('Skipping source language', { targetLang });
        continue;
      }

      // ✅ SOLID COMPLIANT: Use repository instead of direct Prisma
      const existing = await this.translationRepo.findByAssetAndLanguage(
        asset.id,
        targetLang
      );

      if (existing) {
        logger.info('Translation already exists, skipping', {
          targetLang,
          translationId: existing.id,
        });
        translations.push({
          language: targetLang,
          translationId: existing.id,
          status: 'existing' as const,
        });
        continue;
      }

      // Perform translation
      let translatedText: string;
      let translatedSegments: any[] | null = null;

      if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
        // Translate segments with preserved timing
        translatedSegments = await this.translationService.translateTranscriptSegments(
          transcriptData.segments,
          targetLang,
          sourceLanguage
        );
        translatedText = translatedSegments.map((s) => s.text).join(' ');
      } else {
        // Translate plain text
        translatedText = await this.translationService.translateText({
          text: transcriptData.text || asset.transcript,
          targetLanguage: targetLang,
          sourceLanguage: sourceLanguage,
          context: 'video transcript',
        });
      }

      // ✅ SOLID COMPLIANT: Use repository instead of direct Prisma
      const translation = await this.translationRepo.create({
        assetId: asset.id,
        language: targetLang,
        transcript: translatedText,
        segments: translatedSegments || undefined,
        translatedFrom: sourceLanguage,
      });

      logger.info('Translation created', {
        translationId: translation.id,
        language: targetLang,
        textLength: translatedText.length,
      });

      translations.push({
        language: targetLang,
        translationId: translation.id,
        status: 'created' as const,
      });
    }

    logger.info('Transcript translation completed', {
      assetId,
      translationCount: translations.length,
    });

    return {
      assetId: asset.id,
      translations,
    };
  }

  /**
   * Parse transcript (handles both JSON and plain text formats)
   */
  private parseTranscript(transcript: string): {
    text: string;
    segments?: TranscriptSegment[];
  } {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(transcript);

      // Handle array of segments
      if (Array.isArray(parsed)) {
        return {
          text: parsed.map((s: any) => s.text).join(' '),
          segments: parsed as TranscriptSegment[],
        };
      }

      // Handle object with segments property
      if (parsed.segments && Array.isArray(parsed.segments)) {
        return {
          text: parsed.segments.map((s: any) => s.text).join(' '),
          segments: parsed.segments as TranscriptSegment[],
        };
      }

      // Handle object with text property
      if (parsed.text) {
        return {
          text: parsed.text,
        };
      }

      // If JSON is invalid format, treat as plain text
      return {
        text: transcript,
      };
    } catch (error) {
      // If JSON parsing fails, treat as plain text
      logger.info('Transcript is plain text, not JSON');
      return {
        text: transcript,
      };
    }
  }
}
