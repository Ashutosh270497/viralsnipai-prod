/**
 * Voice Translation Entity (Domain Layer)
 *
 * Represents a voice translation of an asset's audio.
 * Immutable value object following domain-driven design.
 *
 * SOLID Principles:
 * - Single Responsibility: Only represents voice translation data
 * - Open/Closed: Extensible for future voice processing features
 *
 * @module VoiceTranslation
 */

export class VoiceTranslation {
  readonly id: string;
  readonly assetId: string;
  readonly language: string;
  readonly audioUrl: string;
  readonly voiceId?: string;
  readonly status: VoiceTranslationStatus;
  readonly translatedFrom: string;
  readonly processingTime?: number;
  readonly error?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: VoiceTranslationProps) {
    this.id = props.id;
    this.assetId = props.assetId;
    this.language = props.language;
    this.audioUrl = props.audioUrl;
    this.voiceId = props.voiceId;
    this.status = props.status;
    this.translatedFrom = props.translatedFrom;
    this.processingTime = props.processingTime;
    this.error = props.error;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Check if translation is completed
   */
  isCompleted(): boolean {
    return this.status === 'completed';
  }

  /**
   * Check if translation failed
   */
  isFailed(): boolean {
    return this.status === 'failed';
  }

  /**
   * Check if translation is still processing
   */
  isProcessing(): boolean {
    return this.status === 'processing' || this.status === 'queued';
  }

  /**
   * Check if translation can be retried
   */
  canRetry(): boolean {
    return this.status === 'failed';
  }

  /**
   * Get display-friendly status text
   */
  getStatusText(): string {
    const statusMap: Record<VoiceTranslationStatus, string> = {
      queued: 'Queued',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
    };
    return statusMap[this.status];
  }
}

export type VoiceTranslationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface VoiceTranslationProps {
  id: string;
  assetId: string;
  language: string;
  audioUrl: string;
  voiceId?: string;
  status: VoiceTranslationStatus;
  translatedFrom: string;
  processingTime?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
