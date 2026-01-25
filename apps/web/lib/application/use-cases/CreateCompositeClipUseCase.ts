/**
 * Create Composite Clip Use Case
 *
 * Orchestrates the creation of composite clips by stitching multiple segments:
 * 1. Validate project and user permissions
 * 2. Fetch clips and validate composite definition
 * 3. Get asset source paths
 * 4. Stitch video segments using VideoStitchingService
 * 5. Create new clip record in database
 *
 * @module CreateCompositeClipUseCase
 */

import { injectable, inject } from 'inversify';
import path from 'path';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import { CompositeClipService, type CompositeClipDefinition } from '@/lib/domain/services/CompositeClipService';
import { VideoStitchingService } from '@/lib/infrastructure/services/VideoStitchingService';
import { VideoStorageService } from '@/lib/infrastructure/services/VideoStorageService';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';

export interface CreateCompositeClipInput {
  projectId: string;
  userId: string;
  definition: CompositeClipDefinition;
}

export interface CreateCompositeClipOutput {
  clip: Clip;
  durationMs: number;
  fileSizeBytes: number;
  segmentCount: number;
  warnings: string[];
}

@injectable()
export class CreateCompositeClipUseCase {
  constructor(
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.CompositeClipService) private compositeService: CompositeClipService,
    @inject(TYPES.VideoStitchingService) private stitchingService: VideoStitchingService,
    @inject(TYPES.VideoStorageService) private storageService: VideoStorageService
  ) {}

  async execute(input: CreateCompositeClipInput): Promise<CreateCompositeClipOutput> {
    const { projectId, userId, definition } = input;

    logger.info('Creating composite clip', {
      projectId,
      userId,
      title: definition.title,
      segmentCount: definition.segments.length,
    });

    // Step 1: Validate project and user permissions
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    if (project.userId !== userId) {
      throw AppError.forbidden('Access denied to this project');
    }

    // Step 2: Get all clips referenced in the definition
    const clipIds = [...new Set(definition.segments.map((s) => s.clipId))];
    const clips = await Promise.all(
      clipIds.map((id) => this.clipRepo.findById(id))
    );

    // Validate all clips exist and belong to the project
    const validClips: Clip[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (!clip) {
        throw AppError.notFound(`Clip ${clipIds[i]} not found`);
      }
      if (clip.projectId !== projectId) {
        throw AppError.forbidden(`Clip ${clipIds[i]} does not belong to this project`);
      }
      validClips.push(clip);
    }

    // Step 3: Validate composite clip definition
    const validation = this.compositeService.validateCompositeClip(
      definition,
      validClips
    );

    logger.info('Composite clip validated', {
      segmentCount: validation.segmentCount,
      totalDurationSec: validation.totalDurationSec,
      estimatedFileSizeMB: validation.estimatedFileSizeMB,
      warningsCount: validation.warnings.length,
    });

    // Step 4: Get asset source paths for each clip
    const clipMap = new Map(validClips.map((c) => [c.id, c]));
    const assetIds = [...new Set(validClips.map((c) => c.assetId))];
    const assets = await Promise.all(
      assetIds.map((id) => this.assetRepo.findById(id))
    );

    const assetMap = new Map(
      assets
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .map((a) => [a.id, a])
    );

    // Prepare segments with source paths
    const segmentsWithPaths = definition.segments
      .sort((a, b) => a.order - b.order)
      .map((segment) => {
        const clip = clipMap.get(segment.clipId);
        if (!clip) {
          throw AppError.notFound(`Clip ${segment.clipId} not found`);
        }

        const asset = assetMap.get(clip.assetId);
        if (!asset || !asset.filePath) {
          throw AppError.notFound(`Asset for clip ${segment.clipId} not found or has no file`);
        }

        // Calculate absolute timestamps from clip's position in original video
        const absoluteStartMs = clip.startMs + segment.startMs;
        const absoluteEndMs = clip.startMs + segment.endMs;

        return {
          sourcePath: asset.filePath,
          startMs: absoluteStartMs,
          endMs: absoluteEndMs,
          clipId: segment.clipId,
        };
      });

    // Step 5: Generate output path
    const outputFileName = `composite-${Date.now()}-${projectId}.mp4`;
    const outputPath = this.storageService.getClipPath(projectId, outputFileName);

    // Step 6: Stitch the video segments
    logger.info('Starting video stitching', {
      segmentCount: segmentsWithPaths.length,
      outputPath,
    });

    const stitchingResult = await this.stitchingService.stitchSegments(
      segmentsWithPaths,
      outputPath,
      {
        preset: this.mapOutputFormatToPreset(definition.outputFormat),
        quality: definition.outputQuality,
      }
    );

    logger.info('Video stitching complete', {
      outputPath: stitchingResult.outputPath,
      durationMs: stitchingResult.durationMs,
      fileSizeBytes: stitchingResult.fileSizeBytes,
    });

    // Step 7: Create clip record in database
    // Get the first clip's asset for the composite clip
    const firstClip = validClips[0];
    const compositeClip = await this.clipRepo.create({
      assetId: firstClip.assetId,
      projectId,
      startMs: 0, // Composite clip starts at 0
      endMs: stitchingResult.durationMs,
      title: definition.title,
      summary: definition.description || `Composite clip with ${validation.segmentCount} segments`,
      order: await this.getNextClipOrder(projectId),
      filePath: stitchingResult.outputPath,
      // Mark as composite for future reference
      metadata: {
        isComposite: true,
        segmentCount: validation.segmentCount,
        sourceClipIds: clipIds,
      },
    });

    logger.info('Composite clip created', {
      clipId: compositeClip.id,
      projectId,
      durationMs: stitchingResult.durationMs,
    });

    return {
      clip: compositeClip,
      durationMs: stitchingResult.durationMs,
      fileSizeBytes: stitchingResult.fileSizeBytes,
      segmentCount: validation.segmentCount,
      warnings: validation.warnings,
    };
  }

  /**
   * Get the next clip order for the project
   */
  private async getNextClipOrder(projectId: string): Promise<number> {
    const clips = await this.clipRepo.findByProjectId(projectId);
    if (clips.length === 0) {
      return 0;
    }
    const maxOrder = Math.max(...clips.map((c) => c.order || 0));
    return maxOrder + 1;
  }

  /**
   * Map output format to preset
   */
  private mapOutputFormatToPreset(
    format?: 'mp4' | 'mov' | 'webm'
  ): 'shorts_9x16_1080' | 'square_1x1_1080' | 'landscape_16x9_1080' {
    // For now, default to landscape. In future, could infer from source clips
    return 'landscape_16x9_1080';
  }
}
