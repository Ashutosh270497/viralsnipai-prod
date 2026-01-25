/**
 * Prisma CaptionTranslation Repository Implementation
 *
 * Implements ICaptionTranslationRepository using Prisma ORM.
 * Part of Infrastructure Layer - concrete implementation.
 *
 * SOLID Principle: Dependency Inversion Principle
 * This concrete implementation is injected via DI container.
 *
 * @module PrismaCaptionTranslationRepository
 */

import { injectable } from 'inversify';
import { prisma } from '@/lib/prisma';
import type { CaptionTranslation } from '@prisma/client';
import type {
  ICaptionTranslationRepository,
  CreateCaptionTranslationData,
} from '@/lib/domain/repositories/ICaptionTranslationRepository';

@injectable()
export class PrismaCaptionTranslationRepository
  implements ICaptionTranslationRepository
{
  /**
   * Find caption by clip ID and language code
   */
  async findByClipAndLanguage(
    clipId: string,
    language: string
  ): Promise<CaptionTranslation | null> {
    return await prisma.captionTranslation.findUnique({
      where: {
        clipId_language: {
          clipId,
          language,
        },
      },
    });
  }

  /**
   * Find all captions for a clip
   */
  async findByClipId(clipId: string): Promise<CaptionTranslation[]> {
    return await prisma.captionTranslation.findMany({
      where: { clipId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create or update caption (upsert)
   */
  async upsert(
    data: CreateCaptionTranslationData
  ): Promise<CaptionTranslation> {
    return await prisma.captionTranslation.upsert({
      where: {
        clipId_language: {
          clipId: data.clipId,
          language: data.language,
        },
      },
      create: {
        clipId: data.clipId,
        language: data.language,
        captionSrt: data.captionSrt,
      },
      update: {
        captionSrt: data.captionSrt,
      },
    });
  }

  /**
   * Delete caption
   */
  async delete(id: string): Promise<void> {
    await prisma.captionTranslation.delete({
      where: { id },
    });
  }
}
