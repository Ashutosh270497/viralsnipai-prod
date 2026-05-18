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
import { sanitizeForLog } from '@/lib/logger/redact';
import {
  normalizeTranscriptEditRanges,
  type TranscriptEditRange,
} from '@/lib/repurpose/transcript-sync';
import { parseSRT } from '@/lib/srt-utils';
import { normalizeClipLayoutConfig, type ClipLayoutConfig } from '@/lib/repurpose/layout-config';

export interface ClipExportSettings {
  reframeMode?: string;
  trackingSmoothness?: 'low' | 'medium' | 'high';
  exportQuality?: 'balanced' | 'high' | 'standard';
  captionsEnabled?: boolean;
  captionSafeZoneEnabled?: boolean;
  layoutPreset?: ClipLayoutConfig['preset'];
  layoutConfig?: unknown;
  aspectRatio?: ClipLayoutConfig['aspectRatio'];
}

export interface UpdateClipInput {
  clipId: string;
  userId: string;
  expectedVersion: number;
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
    exportSettings?: ClipExportSettings;
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
    const { clipId, userId, expectedVersion, updates } = input;

    logger.info('Starting clip update', {
      clipId,
      userId,
      expectedVersion,
      updateKeys: Object.keys(updates),
      updateSummary: sanitizeForLog(updates),
    });

    // Step 1: Validate clip and user permissions
    const clip = await this.clipRepo.findById(clipId);
    if (!clip) {
      throw AppError.notFound('Clip not found');
    }

    const project = await this.projectRepo.findById(clip.projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this clip');
    }

    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw AppError.badRequest('expectedVersion is required for clip updates');
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

    // Build a working copy of viralityFactors.metadata that downstream blocks
    // (transcript edits, export settings) can each contribute to. This avoids
    // one block clobbering another's metadata patch.
    const currentViralityFactors = (clip.viralityFactors ?? {}) as Record<string, unknown>;
    let workingMetadata: Record<string, unknown> | null = null;
    let viralityFactorsTouched = false;
    const ensureWorkingMetadata = (): Record<string, unknown> => {
      if (!workingMetadata) {
        workingMetadata =
          currentViralityFactors.metadata && typeof currentViralityFactors.metadata === 'object'
            ? ({ ...(currentViralityFactors.metadata as Record<string, unknown>) } as Record<string, unknown>)
            : {};
      }
      return workingMetadata;
    };
    const buildViralityFactorsWithMetadata = (
      metadata: Record<string, unknown>
    ): Clip['viralityFactors'] =>
      ({
        hookStrength: toNumber(currentViralityFactors.hookStrength),
        emotionalPeak: toNumber(currentViralityFactors.emotionalPeak),
        storyArc: toNumber(currentViralityFactors.storyArc),
        pacing: toNumber(currentViralityFactors.pacing),
        transcriptQuality: toNumber(currentViralityFactors.transcriptQuality),
        shareability:
          typeof currentViralityFactors.shareability === 'number'
            ? currentViralityFactors.shareability
            : undefined,
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
        qualitySignals:
          currentViralityFactors.qualitySignals && typeof currentViralityFactors.qualitySignals === 'object'
            ? (currentViralityFactors.qualitySignals as Record<string, unknown>)
            : undefined,
        reframePlans: Array.isArray(currentViralityFactors.reframePlans)
          ? currentViralityFactors.reframePlans
          : undefined,
        metadata,
      }) as Clip['viralityFactors'];

    if (updates.transcriptEditRangesMs !== undefined) {
      let normalizedRanges = normalizeTranscriptEditRanges(
        updates.transcriptEditRangesMs,
        clip.startMs,
        clip.endMs
      );
      if (normalizedRanges.length > 0) {
        normalizedRanges = this.filterTranscriptRangesWithCaptionContent(
          normalizedRanges,
          updates.captionSrt ?? clip.captionSrt ?? null,
          clip.startMs,
          clip.endMs
        );
        if (normalizedRanges.length === 0) {
          throw AppError.badRequest('Transcript edit ranges must overlap existing caption text');
        }
      }
      normalizedTranscriptEditRangesMs = normalizedRanges.length > 1 ? normalizedRanges : null;
      const metadata = ensureWorkingMetadata();

      if (normalizedRanges.length > 1) {
        metadata.transcriptEditRangesMs = normalizedRanges;
        metadata.transcriptEditVersion = 'v1';
        metadata.transcriptEditedAt = new Date().toISOString();
      } else {
        delete metadata.transcriptEditRangesMs;
        delete metadata.transcriptEditVersion;
        metadata.transcriptEditedAt = new Date().toISOString();
      }

      viralityFactorsTouched = true;

      // Drop transport-only field before repository update.
      delete updatesForPersistence.transcriptEditRangesMs;

      logger.info('Applied transcript edit ranges to clip metadata', {
        clipId,
        rangeCount: normalizedRanges.length,
        clipDurationMs,
      });
    }

    if (updates.exportSettings !== undefined) {
      const metadata = ensureWorkingMetadata();
      const existingExportSettings =
        metadata.exportSettings && typeof metadata.exportSettings === 'object'
          ? { ...(metadata.exportSettings as Record<string, unknown>) }
          : {};
      const incoming = updates.exportSettings;
      // Only spread defined keys so callers can patch one field at a time.
      const merged: Record<string, unknown> = { ...existingExportSettings };
      if (incoming.reframeMode !== undefined) merged.reframeMode = incoming.reframeMode;
      if (incoming.trackingSmoothness !== undefined) merged.trackingSmoothness = incoming.trackingSmoothness;
      if (incoming.exportQuality !== undefined) merged.exportQuality = incoming.exportQuality;
      if (incoming.captionsEnabled !== undefined) merged.captionsEnabled = incoming.captionsEnabled;
      if (incoming.captionSafeZoneEnabled !== undefined) merged.captionSafeZoneEnabled = incoming.captionSafeZoneEnabled;
      if (incoming.layoutPreset !== undefined) merged.layoutPreset = incoming.layoutPreset;
      if (incoming.aspectRatio !== undefined) merged.aspectRatio = incoming.aspectRatio;
      if (incoming.layoutConfig !== undefined) {
        const normalizedLayout = normalizeClipLayoutConfig({
          ...incoming.layoutConfig,
          ...(incoming.layoutPreset !== undefined ? { preset: incoming.layoutPreset } : {}),
          ...(incoming.aspectRatio !== undefined ? { aspectRatio: incoming.aspectRatio } : {}),
          updatedAt: new Date().toISOString(),
        });
        merged.layoutPreset = normalizedLayout.preset;
        merged.aspectRatio = normalizedLayout.aspectRatio;
        metadata.layoutConfig = normalizedLayout;
        metadata.layoutPreset = normalizedLayout.preset;
        metadata.layoutUpdatedAt = normalizedLayout.updatedAt;
      }

      metadata.exportSettings = merged;
      metadata.exportSettingsUpdatedAt = new Date().toISOString();

      viralityFactorsTouched = true;

      // Drop transport-only field before repository update.
      delete updatesForPersistence.exportSettings;

      logger.info('Applied export settings to clip metadata', {
        clipId,
        appliedFields: Object.keys(incoming).filter(
          (k) => incoming[k as keyof ClipExportSettings] !== undefined
        ),
      });
    }

    if (viralityFactorsTouched && workingMetadata) {
      updatesForPersistence.viralityFactors = buildViralityFactorsWithMetadata(workingMetadata);
    }

    // Step 3: Update clip properties
    const updatedClip = await this.clipRepo.updateWithVersion(
      clipId,
      expectedVersion,
      updatesForPersistence
    );
    if (!updatedClip) {
      throw AppError.conflict('Clip was updated elsewhere. Refresh and try again.', {
        expectedVersion,
        currentVersion: clip.version,
      });
    }

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

  private filterTranscriptRangesWithCaptionContent(
    ranges: TranscriptEditRange[],
    captionSrt: string | null,
    clipStartMs: number,
    clipEndMs: number
  ): TranscriptEditRange[] {
    if (!captionSrt?.trim()) {
      return ranges;
    }

    const entries = parseSRT(captionSrt)
      .filter((entry) => entry.text.replace(/\s+/g, ' ').trim().length > 0)
      .map((entry) => {
        const appearsRelative = entry.endMs <= clipEndMs - clipStartMs + 1_000;
        return {
          startMs: appearsRelative ? clipStartMs + entry.startMs : entry.startMs,
          endMs: appearsRelative ? clipStartMs + entry.endMs : entry.endMs,
        };
      })
      .filter((entry) => entry.endMs > entry.startMs);

    if (entries.length === 0) {
      return [];
    }

    return ranges.filter((range) =>
      entries.some((entry) => entry.endMs > range.startMs && entry.startMs < range.endMs)
    );
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}
