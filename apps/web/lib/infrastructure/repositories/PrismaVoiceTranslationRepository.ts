/**
 * Prisma Voice Translation Repository (Infrastructure Layer)
 *
 * Implements IVoiceTranslationRepository using Prisma ORM.
 * Handles data persistence for voice translations.
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles data persistence
 * - Liskov Substitution: Can be replaced with any IVoiceTranslationRepository implementation
 * - Dependency Inversion: Implements domain interface
 *
 * @module PrismaVoiceTranslationRepository
 */

import { injectable, inject } from 'inversify';
import { PrismaClient } from '@prisma/client';
import {
  IVoiceTranslationRepository,
  CreateVoiceTranslationData,
  UpdateVoiceTranslationData,
} from '@/lib/domain/repositories/IVoiceTranslationRepository';
import {
  VoiceTranslation,
  VoiceTranslationStatus,
} from '@/lib/domain/entities/VoiceTranslation';
import { TYPES } from '../di/types';

@injectable()
export class PrismaVoiceTranslationRepository implements IVoiceTranslationRepository {
  constructor(
    @inject(TYPES.PrismaClient) private prisma: PrismaClient
  ) {}

  async findByAssetAndLanguage(
    assetId: string,
    language: string
  ): Promise<VoiceTranslation | null> {
    const record = await this.prisma.voiceTranslation.findUnique({
      where: {
        assetId_language: { assetId, language },
      },
    });

    return record ? this.toDomain(record) : null;
  }

  async findByAssetId(assetId: string): Promise<VoiceTranslation[]> {
    const records = await this.prisma.voiceTranslation.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<VoiceTranslation | null> {
    const record = await this.prisma.voiceTranslation.findUnique({
      where: { id },
    });

    return record ? this.toDomain(record) : null;
  }

  async findByStatus(status: VoiceTranslationStatus): Promise<VoiceTranslation[]> {
    const records = await this.prisma.voiceTranslation.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async create(data: CreateVoiceTranslationData): Promise<VoiceTranslation> {
    const record = await this.prisma.voiceTranslation.create({
      data: {
        assetId: data.assetId,
        language: data.language,
        translatedFrom: data.translatedFrom,
        voiceId: data.voiceId,
        audioUrl: '', // Will be updated after processing
        status: 'queued',
      },
    });

    return this.toDomain(record);
  }

  async update(
    id: string,
    data: UpdateVoiceTranslationData
  ): Promise<VoiceTranslation> {
    const record = await this.prisma.voiceTranslation.update({
      where: { id },
      data,
    });

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.voiceTranslation.delete({
      where: { id },
    });
  }

  /**
   * Convert Prisma record to domain entity
   */
  private toDomain(record: any): VoiceTranslation {
    return new VoiceTranslation({
      id: record.id,
      assetId: record.assetId,
      language: record.language,
      audioUrl: record.audioUrl,
      voiceId: record.voiceId ?? undefined,
      status: record.status as VoiceTranslationStatus,
      translatedFrom: record.translatedFrom,
      processingTime: record.processingTime ?? undefined,
      error: record.error ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
