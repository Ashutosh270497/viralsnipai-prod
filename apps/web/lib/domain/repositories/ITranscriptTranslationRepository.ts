/**
 * Repository interface for TranscriptTranslation entity
 * Part of Domain Layer - defines contract, no implementation details
 *
 * SOLID Principle: Dependency Inversion Principle
 * Use cases depend on this interface, not concrete implementations
 */

import type { TranscriptTranslation } from '@prisma/client';

export interface CreateTranscriptTranslationData {
  assetId: string;
  language: string;
  transcript: string;
  segments?: any[];
  translatedFrom: string;
}

export interface ITranscriptTranslationRepository {
  /**
   * Find translation by asset ID and language code
   */
  findByAssetAndLanguage(
    assetId: string,
    language: string
  ): Promise<TranscriptTranslation | null>;

  /**
   * Find all translations for an asset
   */
  findByAssetId(assetId: string): Promise<TranscriptTranslation[]>;

  /**
   * Create new translation
   */
  create(data: CreateTranscriptTranslationData): Promise<TranscriptTranslation>;

  /**
   * Update existing translation
   */
  update(
    id: string,
    data: Partial<CreateTranscriptTranslationData>
  ): Promise<TranscriptTranslation>;

  /**
   * Delete translation
   */
  delete(id: string): Promise<void>;
}
