/**
 * Voice Translation Repository Interface (Domain Layer)
 *
 * Defines the contract for voice translation data persistence.
 * Implementation is in the infrastructure layer.
 *
 * SOLID Principles:
 * - Dependency Inversion: High-level modules depend on this abstraction
 * - Interface Segregation: Only necessary methods exposed
 *
 * @module IVoiceTranslationRepository
 */

import { VoiceTranslation, VoiceTranslationStatus } from '../entities/VoiceTranslation';

export interface CreateVoiceTranslationData {
  assetId: string;
  language: string;
  translatedFrom: string;
  voiceId?: string;
}

export interface UpdateVoiceTranslationData {
  audioUrl?: string;
  status?: VoiceTranslationStatus;
  processingTime?: number;
  error?: string;
}

export interface IVoiceTranslationRepository {
  /**
   * Find voice translation by asset and language
   */
  findByAssetAndLanguage(
    assetId: string,
    language: string
  ): Promise<VoiceTranslation | null>;

  /**
   * Find all voice translations for an asset
   */
  findByAssetId(assetId: string): Promise<VoiceTranslation[]>;

  /**
   * Find voice translation by ID
   */
  findById(id: string): Promise<VoiceTranslation | null>;

  /**
   * Create new voice translation
   */
  create(data: CreateVoiceTranslationData): Promise<VoiceTranslation>;

  /**
   * Update voice translation
   */
  update(id: string, data: UpdateVoiceTranslationData): Promise<VoiceTranslation>;

  /**
   * Delete voice translation
   */
  delete(id: string): Promise<void>;

  /**
   * Find voice translations by status (for job processing)
   */
  findByStatus(status: VoiceTranslationStatus): Promise<VoiceTranslation[]>;
}
