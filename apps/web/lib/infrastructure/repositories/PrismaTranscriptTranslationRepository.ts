/**
 * Prisma TranscriptTranslation Repository Implementation
 *
 * Implements ITranscriptTranslationRepository using Prisma ORM.
 * Part of Infrastructure Layer - concrete implementation.
 *
 * SOLID Principle: Dependency Inversion Principle
 * This concrete implementation is injected via DI container.
 *
 * @module PrismaTranscriptTranslationRepository
 */

import { injectable } from 'inversify';
import { prisma } from '@/lib/prisma';
import type { TranscriptTranslation } from '@prisma/client';
import type {
  ITranscriptTranslationRepository,
  CreateTranscriptTranslationData,
} from '@/lib/domain/repositories/ITranscriptTranslationRepository';

@injectable()
export class PrismaTranscriptTranslationRepository
  implements ITranscriptTranslationRepository
{
  /**
   * Find translation by asset ID and language code
   */
  async findByAssetAndLanguage(
    assetId: string,
    language: string
  ): Promise<TranscriptTranslation | null> {
    return await prisma.transcriptTranslation.findUnique({
      where: {
        assetId_language: {
          assetId,
          language,
        },
      },
    });
  }

  /**
   * Find all translations for an asset
   */
  async findByAssetId(assetId: string): Promise<TranscriptTranslation[]> {
    return await prisma.transcriptTranslation.findMany({
      where: { assetId },
      orderBy: { translatedAt: 'desc' },
    });
  }

  /**
   * Create new translation
   */
  async create(
    data: CreateTranscriptTranslationData
  ): Promise<TranscriptTranslation> {
    return await prisma.transcriptTranslation.create({
      data: {
        assetId: data.assetId,
        language: data.language,
        transcript: data.transcript,
        segments: data.segments,
        translatedFrom: data.translatedFrom,
      },
    });
  }

  /**
   * Update existing translation
   */
  async update(
    id: string,
    data: Partial<CreateTranscriptTranslationData>
  ): Promise<TranscriptTranslation> {
    return await prisma.transcriptTranslation.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete translation
   */
  async delete(id: string): Promise<void> {
    await prisma.transcriptTranslation.delete({
      where: { id },
    });
  }
}
