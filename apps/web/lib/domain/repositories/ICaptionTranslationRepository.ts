/**
 * Repository interface for CaptionTranslation entity
 * Part of Domain Layer - defines contract, no implementation details
 *
 * SOLID Principle: Dependency Inversion Principle
 * Use cases depend on this interface, not concrete implementations
 */

import type { CaptionTranslation } from '@prisma/client';

export interface CreateCaptionTranslationData {
  clipId: string;
  language: string;
  captionSrt: string;
}

export interface ICaptionTranslationRepository {
  /**
   * Find caption by clip ID and language code
   */
  findByClipAndLanguage(
    clipId: string,
    language: string
  ): Promise<CaptionTranslation | null>;

  /**
   * Find all captions for a clip
   */
  findByClipId(clipId: string): Promise<CaptionTranslation[]>;

  /**
   * Create or update caption (upsert)
   */
  upsert(data: CreateCaptionTranslationData): Promise<CaptionTranslation>;

  /**
   * Delete caption
   */
  delete(id: string): Promise<void>;
}
