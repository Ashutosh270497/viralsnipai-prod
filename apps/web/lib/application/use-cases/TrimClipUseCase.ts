/**
 * Trim Clip Use Case
 *
 * Orchestrates the clip trimming workflow:
 * 1. Validate clip and user permissions
 * 2. Validate new trim boundaries
 * 3. Update clip boundaries in database
 * 4. Invalidate existing captions and preview
 * 5. Update project timestamp
 *
 * @module TrimClipUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import { ClipManipulationService } from '@/lib/domain/services/ClipManipulationService';
import { TranscriptionService } from '@/lib/domain/services/TranscriptionService';
import { materializeMediaLocally } from '@/lib/media/media-path-resolver';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';

export interface TrimClipInput {
  clipId: string;
  startMs: number;
  endMs: number;
  userId: string;
}

export interface TrimClipOutput {
  clip: Clip;
  captionsInvalidated: boolean;
}

@injectable()
export class TrimClipUseCase {
  constructor(
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.TranscriptionService) private transcriptionService: TranscriptionService,
    @inject(TYPES.ClipManipulationService)
    private clipManipulation: ClipManipulationService
  ) {}

  async execute(input: TrimClipInput): Promise<TrimClipOutput> {
    const { clipId, startMs, endMs, userId } = input;

    logger.info('Starting clip trim', { clipId, startMs, endMs, userId });

    // Step 1: Validate clip and user permissions
    const clip = await this.clipRepo.findById(clipId);
    if (!clip) {
      throw AppError.notFound('Clip not found');
    }

    const project = await this.projectRepo.findById(clip.projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this clip');
    }

    // Step 2: Get asset duration to validate boundaries
    if (!clip.assetId) {
      throw AppError.badRequest('Clip has no source asset for trim validation');
    }

    const asset = await this.assetRepo.findById(clip.assetId);
    if (!asset) {
      throw AppError.notFound('Asset not found for clip');
    }

    let assetDurationSec = asset.durationSec;
    if (!assetDurationSec || assetDurationSec <= 0) {
      // Try local first, then materialize from S3/HTTPS if needed. Always
      // clean up downloaded tempfiles even on probe failure.
      const materialized = await materializeMediaLocally([asset.storagePath, asset.path]);
      if (!materialized) {
        throw AppError.badRequest(
          'Unable to validate trim boundaries because the source asset file is not available on local storage or remote storage.'
        );
      }

      try {
        assetDurationSec = await this.transcriptionService.probeDuration(materialized.localPath);
        if (!assetDurationSec || assetDurationSec <= 0) {
          throw AppError.badRequest(
            'Unable to validate trim boundaries because the source video duration could not be determined.'
          );
        }
        await this.assetRepo.update(asset.id, { durationSec: assetDurationSec });
      } finally {
        await materialized.cleanup();
      }
    }

    // Step 3: Validate new trim boundaries
    this.clipManipulation.validateTrimBoundaries(startMs, endMs, assetDurationSec);

    logger.info('Trim boundaries validated', { startMs, endMs, assetDurationSec });

    // Step 4: Update clip boundaries and invalidate captions/preview
    // Since clip boundaries changed, captions and preview are no longer accurate
    const updatedClip = await this.clipRepo.update(clipId, {
      startMs,
      endMs,
      captionSrt: null, // Invalidate captions - user must regenerate
      previewPath: null, // Invalidate preview - user must regenerate
    });

    const captionsInvalidated = clip.captionSrt !== null || clip.previewPath !== null;

    logger.info('Clip trimmed', {
      clipId,
      newDuration: endMs - startMs,
      captionsInvalidated,
    });

    // Step 5: Update project timestamp
    await this.projectRepo.update(clip.projectId, {
      updatedAt: new Date(),
    });

    logger.info('Clip trim completed', { clipId });

    return {
      clip: updatedClip,
      captionsInvalidated,
    };
  }
}
