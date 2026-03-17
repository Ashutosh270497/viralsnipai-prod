/**
 * Split Clip Use Case
 *
 * Orchestrates the clip splitting workflow:
 * 1. Validate clip and user permissions
 * 2. Validate split point
 * 3. Calculate boundaries for two new clips
 * 4. Create two new clips in database
 * 5. Delete original clip
 * 6. Update project timestamp
 *
 * @module SplitClipUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import { ClipManipulationService } from '@/lib/domain/services/ClipManipulationService';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';

export interface SplitClipInput {
  clipId: string;
  splitAtMs: number;
  userId: string;
}

export interface SplitClipOutput {
  firstClip: Clip;
  secondClip: Clip;
  originalClipDeleted: boolean;
}

@injectable()
export class SplitClipUseCase {
  constructor(
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.ClipManipulationService)
    private clipManipulation: ClipManipulationService
  ) {}

  async execute(input: SplitClipInput): Promise<SplitClipOutput> {
    const { clipId, splitAtMs, userId } = input;

    logger.info('Starting clip split', { clipId, splitAtMs, userId });

    // Step 1: Validate clip and user permissions
    const clip = await this.clipRepo.findById(clipId);
    if (!clip) {
      throw AppError.notFound('Clip not found');
    }

    const project = await this.projectRepo.findById(clip.projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this clip');
    }

    // Step 2: Validate split point
    this.clipManipulation.validateSplitPoint(clip.startMs, clip.endMs, splitAtMs);

    // Step 3: Calculate boundaries for two new clips
    const { firstClip, secondClip } = this.clipManipulation.calculateSplitBoundaries(
      clip.startMs,
      clip.endMs,
      splitAtMs
    );

    logger.info('Split boundaries calculated', {
      firstClip,
      secondClip,
    });

    // Step 4: Create two new clips
    const firstClipData = {
      projectId: clip.projectId,
      assetId: clip.assetId,
      startMs: firstClip.startMs,
      endMs: firstClip.endMs,
      title: clip.title ? `${clip.title} (Part 1)` : `Clip (Part 1)`,
      summary: clip.summary,
      callToAction: clip.callToAction,
      viralityScore: clip.viralityScore,
      viralityFactors: clip.viralityFactors,
    };

    const secondClipData = {
      projectId: clip.projectId,
      assetId: clip.assetId,
      startMs: secondClip.startMs,
      endMs: secondClip.endMs,
      title: clip.title ? `${clip.title} (Part 2)` : `Clip (Part 2)`,
      summary: clip.summary,
      callToAction: clip.callToAction,
      viralityScore: clip.viralityScore,
      viralityFactors: clip.viralityFactors,
    };

    const createdFirstClip = await this.clipRepo.create(firstClipData);
    const createdSecondClip = await this.clipRepo.create(secondClipData);

    logger.info('Two new clips created', {
      firstClipId: createdFirstClip.id,
      secondClipId: createdSecondClip.id,
    });

    // Step 5: Delete original clip
    await this.clipRepo.delete(clipId);

    logger.info('Original clip deleted', { clipId });

    // Step 6: Update project timestamp
    await this.projectRepo.update(clip.projectId, {
      updatedAt: new Date(),
    });

    logger.info('Clip split completed', {
      originalClipId: clipId,
      firstClipId: createdFirstClip.id,
      secondClipId: createdSecondClip.id,
    });

    return {
      firstClip: createdFirstClip,
      secondClip: createdSecondClip,
      originalClipDeleted: true,
    };
  }
}
