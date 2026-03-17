/**
 * Update Clip Use Case
 *
 * Orchestrates the clip update workflow:
 * 1. Validate clip and user permissions
 * 2. Update clip properties (title, summary, etc.)
 * 3. Update project timestamp
 *
 * @module UpdateClipUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';
import {
  normalizeTranscriptEditRanges,
  type TranscriptEditRange,
} from '@/lib/repurpose/transcript-sync';

export interface UpdateClipInput {
  clipId: string;
  userId: string;
  updates: {
    order?: number;
    title?: string;
    summary?: string;
    callToAction?: string;
    captionSrt?: string;
    captionStyle?: Clip['captionStyle'];
    thumbnail?: string | null;
    previewPath?: string | null;
    startMs?: number;
    endMs?: number;
    transcriptEditRangesMs?: TranscriptEditRange[] | null;
  };
}

export interface UpdateClipOutput {
  clip: Clip;
  fieldsUpdated: string[];
  normalizedTranscriptEditRangesMs?: TranscriptEditRange[] | null;
}

@injectable()
export class UpdateClipUseCase {
  constructor(
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository
  ) {}

  async execute(input: UpdateClipInput): Promise<UpdateClipOutput> {
    const { clipId, userId, updates } = input;

    logger.info('Starting clip update', { clipId, userId, updates });

    // Step 1: Validate clip and user permissions
    const clip = await this.clipRepo.findById(clipId);
    if (!clip) {
      throw AppError.notFound('Clip not found');
    }

    const project = await this.projectRepo.findById(clip.projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this clip');
    }

    // Step 2: Validate at least one field to update
    const fieldsUpdated = Object.keys(updates).filter(
      (key) => updates[key as keyof typeof updates] !== undefined
    );

    if (fieldsUpdated.length === 0) {
      throw AppError.badRequest('No fields to update');
    }

    logger.info('Fields to update', { fieldsUpdated });

    const clipDurationMs = Math.max(1, clip.endMs - clip.startMs);
    const updatesForPersistence = { ...updates } as UpdateClipInput['updates'] & {
      viralityFactors?: Clip['viralityFactors'];
    };

    let normalizedTranscriptEditRangesMs: TranscriptEditRange[] | null | undefined = undefined;

    if (updates.transcriptEditRangesMs !== undefined) {
      const normalizedRanges = normalizeTranscriptEditRanges(
        updates.transcriptEditRangesMs,
        clip.startMs,
        clip.endMs
      );
      normalizedTranscriptEditRangesMs = normalizedRanges.length > 1 ? normalizedRanges : null;
      const currentViralityFactors = (clip.viralityFactors ?? {}) as Record<string, unknown>;
      const existingMetadata =
        currentViralityFactors.metadata && typeof currentViralityFactors.metadata === 'object'
          ? ({ ...(currentViralityFactors.metadata as Record<string, unknown>) } as Record<string, unknown>)
          : {};

      if (normalizedRanges.length > 1) {
        existingMetadata.transcriptEditRangesMs = normalizedRanges;
        existingMetadata.transcriptEditVersion = 'v1';
        existingMetadata.transcriptEditedAt = new Date().toISOString();
      } else {
        delete existingMetadata.transcriptEditRangesMs;
        delete existingMetadata.transcriptEditVersion;
        existingMetadata.transcriptEditedAt = new Date().toISOString();
      }

      updatesForPersistence.viralityFactors = {
        hookStrength: toNumber(currentViralityFactors.hookStrength),
        emotionalPeak: toNumber(currentViralityFactors.emotionalPeak),
        storyArc: toNumber(currentViralityFactors.storyArc),
        pacing: toNumber(currentViralityFactors.pacing),
        transcriptQuality: toNumber(currentViralityFactors.transcriptQuality),
        reasoning:
          typeof currentViralityFactors.reasoning === 'string'
            ? currentViralityFactors.reasoning
            : undefined,
        improvements: Array.isArray(currentViralityFactors.improvements)
          ? (currentViralityFactors.improvements.filter((item) => typeof item === 'string') as string[])
          : undefined,
        enhancement:
          currentViralityFactors.enhancement && typeof currentViralityFactors.enhancement === 'object'
            ? (currentViralityFactors.enhancement as Record<string, unknown>)
            : undefined,
        metadata: existingMetadata,
      } as Clip['viralityFactors'];

      // Drop transport-only field before repository update.
      delete updatesForPersistence.transcriptEditRangesMs;

      logger.info('Applied transcript edit ranges to clip metadata', {
        clipId,
        rangeCount: normalizedRanges.length,
        clipDurationMs,
      });
    }

    // Step 3: Update clip properties
    const updatedClip = await this.clipRepo.update(clipId, updatesForPersistence);

    logger.info('Clip updated', { clipId, fieldsUpdated });

    // Step 4: Update project timestamp
    await this.projectRepo.update(clip.projectId, {
      updatedAt: new Date(),
    });

    logger.info('Clip update completed', { clipId });

    return {
      clip: updatedClip,
      fieldsUpdated,
      normalizedTranscriptEditRangesMs,
    };
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}
