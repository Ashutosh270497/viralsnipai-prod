/**
 * Generate Captions Use Case
 *
 * Orchestrates the caption generation workflow:
 * 1. Validate clip and user permissions
 * 2. Generate SRT captions from transcript
 * 3. Extract video preview clip
 * 4. Save caption and preview path to database
 *
 * @module GenerateCaptionsUseCase
 */

import { injectable, inject } from 'inversify';
import { promises as fs } from 'fs';
import path from 'path';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import { CaptionGenerationService } from '@/lib/domain/services/CaptionGenerationService';
import { VideoExtractionService } from '@/lib/domain/services/VideoExtractionService';
import { getLocalUploadDir } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';

export interface GenerateCaptionsInput {
  clipId: string;
  userId: string;
  options?: {
    maxWordsPerCaption?: number;
    maxDurationMs?: number;
  };
}

export interface GenerateCaptionsOutput {
  clip: Clip;
  captionGenerated: boolean;
  previewGenerated: boolean;
}

@injectable()
export class GenerateCaptionsUseCase {
  constructor(
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.CaptionGenerationService) private captionService: CaptionGenerationService,
    @inject(TYPES.VideoExtractionService) private videoExtractor: VideoExtractionService
  ) {}

  async execute(input: GenerateCaptionsInput): Promise<GenerateCaptionsOutput> {
    const { clipId, userId, options = {} } = input;

    logger.info('Starting caption generation', { clipId, userId, options });

    // Step 1: Validate clip and user permissions
    const clip = await this.clipRepo.findById(clipId);
    if (!clip) {
      throw AppError.notFound('Clip not found');
    }

    const project = await this.projectRepo.findById(clip.projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this clip');
    }

    // Step 2: Get asset with transcript
    const asset = clip.assetId ? await this.assetRepo.findById(clip.assetId) : null;
    if (!asset) {
      throw AppError.notFound('Asset not found for clip');
    }

    if (!asset.storagePath) {
      throw AppError.badRequest('Asset storage path unavailable');
    }

    // Step 3: Ensure directories exist
    const uploadDir = getLocalUploadDir();
    const captionsDir = path.join(uploadDir, 'captions');
    const previewsDir = path.join(uploadDir, 'previews');
    await fs.mkdir(captionsDir, { recursive: true });
    await fs.mkdir(previewsDir, { recursive: true });

    const srtPath = path.join(captionsDir, `${clip.id}.srt`);
    const previewPath = path.join(previewsDir, `${clip.id}.mp4`);

    // Step 4: Generate SRT captions from transcript
    let srtContent: string;
    let captionGenerated = false;

    if (asset.transcript) {
      logger.info('Generating captions from transcript', { clipId });

      srtContent = await this.captionService.generateSRT(
        clip.startMs,
        clip.endMs,
        asset.transcript,
        {
          maxWordsPerCaption: options.maxWordsPerCaption || 4,
          maxDurationMs: options.maxDurationMs || 2000,
        }
      );

      captionGenerated = true;
      logger.info('Captions generated successfully', { clipId, length: srtContent.length });
    } else {
      logger.warn('No transcript available, using fallback captions', { clipId });

      // Fallback if no transcript
      const durationMs = clip.endMs - clip.startMs;
      const durationSeconds = Math.max(durationMs / 1000, 1);

      srtContent = `1\n00:00:00,000 --> 00:00:${Math.min(59, Math.floor(durationSeconds / 2))
        .toString()
        .padStart(2, '0')},000\n${clip.title ?? 'Clip highlight'}\n\n2\n00:00:${Math.min(
        59,
        Math.floor(durationSeconds / 2)
      )
        .toString()
        .padStart(
          2,
          '0'
        )},000 --> 00:00:${Math.min(59, Math.floor(durationSeconds)).toString().padStart(2, '0')},000\n[Transcript not available]`;
    }

    // Step 5: Save SRT file
    await fs.writeFile(srtPath, srtContent, 'utf-8');

    // Step 6: Extract video preview clip (without burned captions)
    logger.info('Extracting video preview clip', { clipId });

    await this.videoExtractor.extractClip({
      inputPath: asset.storagePath,
      startMs: clip.startMs,
      endMs: clip.endMs,
      outputPath: previewPath,
    });

    const previewGenerated = true;
    logger.info('Video preview extracted successfully', { clipId });

    // Step 7: Update clip with caption and preview path
    const updatedClip = await this.clipRepo.update(clipId, {
      captionSrt: srtContent,
      previewPath: `/api/uploads/previews/${clip.id}.mp4`,
    } as any);

    // Step 8: Update project timestamp
    await this.projectRepo.update(clip.projectId, {
      updatedAt: new Date(),
    } as any);

    logger.info('Caption generation completed', {
      clipId,
      captionGenerated,
      previewGenerated,
    });

    return {
      clip: updatedClip,
      captionGenerated,
      previewGenerated,
    };
  }
}
