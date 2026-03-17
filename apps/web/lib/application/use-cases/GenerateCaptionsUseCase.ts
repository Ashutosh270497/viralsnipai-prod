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
import { TranscriptionService } from '@/lib/domain/services/TranscriptionService';
import { ThumbnailGenerationService } from '@/lib/domain/services/ThumbnailGenerationService';
import { concatClipsPassthrough, PRESETS } from '@/lib/ffmpeg';
import { getLocalUploadDir } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';
import { resolveTranscriptEditRanges } from '@/lib/repurpose/transcript-edit-ranges';
import { selectBestReframePlan } from '@/lib/repurpose/clip-optimization';

const PREVIEW_PRESET = 'shorts_9x16_1080' as const;
const PREVIEW_TARGET_RATIO = PRESETS[PREVIEW_PRESET].width / PRESETS[PREVIEW_PRESET].height;

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
    @inject(TYPES.VideoExtractionService) private videoExtractor: VideoExtractionService,
    @inject(TYPES.TranscriptionService) private transcriptionService: TranscriptionService,
    @inject(TYPES.ThumbnailGenerationService) private thumbnailService: ThumbnailGenerationService
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
      let transcriptPayload = asset.transcript;
      const parsedTranscript = this.transcriptionService.parseTranscript(asset.transcript);

      if (!this.transcriptionService.hasTimedSegments(parsedTranscript)) {
        logger.warn('Stored transcript has no timing data. Re-transcribing for accurate clip captions.', {
          clipId,
          assetId: asset.id,
        });

        try {
          const retranscribed = await this.transcriptionService.transcribe(asset.storagePath);
          transcriptPayload = this.transcriptionService.serializeTranscription(retranscribed);

          await this.assetRepo.update(asset.id, {
            transcript: transcriptPayload,
          });
        } catch (error) {
          logger.warn('Re-transcription failed, using existing transcript fallback', {
            clipId,
            assetId: asset.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('Generating captions from transcript', { clipId });

      srtContent = await this.captionService.generateSRT(
        clip.startMs,
        clip.endMs,
        transcriptPayload,
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
      const midpoint = Math.min(59, Math.floor(durationSeconds / 2))
        .toString()
        .padStart(2, '0');
      const end = Math.min(59, Math.floor(durationSeconds))
        .toString()
        .padStart(2, '0');

      srtContent = `1\n00:00:00,000 --> 00:00:${midpoint},000\n[Transcript unavailable]\n\n2\n00:00:${midpoint},000 --> 00:00:${end},000\n[Regenerate captions for editable transcript]`;
    }

    // Step 5: Save SRT file
    await fs.writeFile(srtPath, srtContent, 'utf-8');

    // Step 6: Extract/compose video preview clip (without burned captions)
    const transcriptEditRanges = resolveTranscriptEditRanges(
      clip.viralityFactors,
      clip.startMs,
      clip.endMs
    );
    const previewReframePlan = selectBestReframePlan(
      clip.viralityFactors?.reframePlans,
      PREVIEW_TARGET_RATIO
    );

    logger.info('Generating video preview clip', {
      clipId,
      hasTranscriptCuts: transcriptEditRanges.length > 1,
      rangeCount: transcriptEditRanges.length,
    });

    if (transcriptEditRanges.length > 1) {
      const tempDir = path.join(previewsDir, `${clip.id}-segments`);
      await fs.mkdir(tempDir, { recursive: true });
      const segmentPaths: string[] = [];

      try {
        for (let index = 0; index < transcriptEditRanges.length; index += 1) {
          const range = transcriptEditRanges[index];
          const segmentPath = path.join(tempDir, `${clip.id}-${index + 1}.mp4`);
          await this.videoExtractor.extractClip({
            inputPath: asset.storagePath,
            startMs: range.startMs,
            endMs: range.endMs,
            outputPath: segmentPath,
            preset: PREVIEW_PRESET,
            reframePlan: previewReframePlan,
          });
          segmentPaths.push(segmentPath);
        }

        await concatClipsPassthrough({
          clipPaths: segmentPaths,
          outputPath: previewPath,
        });
      } catch (error) {
        logger.warn('Internal-cut preview stitch failed, falling back to single-range preview', {
          clipId,
          error: error instanceof Error ? error.message : String(error),
        });

        await this.videoExtractor.extractClip({
          inputPath: asset.storagePath,
          startMs: clip.startMs,
          endMs: clip.endMs,
          outputPath: previewPath,
          preset: PREVIEW_PRESET,
          reframePlan: previewReframePlan,
        });
      } finally {
        await Promise.all(
          segmentPaths.map(async (segmentPath) => {
            await fs.unlink(segmentPath).catch(() => null);
          })
        );
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
      }
    } else {
      await this.videoExtractor.extractClip({
        inputPath: asset.storagePath,
        startMs: clip.startMs,
        endMs: clip.endMs,
        outputPath: previewPath,
        preset: PREVIEW_PRESET,
        reframePlan: previewReframePlan,
      });
    }

    const previewGenerated = true;
    logger.info('Video preview extracted successfully', { clipId });

    let thumbnailUrl: string | undefined;
    try {
      const thumbnailResult = await this.thumbnailService.generateClipThumbnail(
        asset.storagePath,
        clip.startMs,
        clip.endMs,
        clip.projectId,
        clip.id
      );
      thumbnailUrl = thumbnailResult?.publicUrl;
    } catch (error) {
      logger.warn('Preview thumbnail regeneration failed', {
        clipId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Step 7: Update clip with caption, preview path, and thumbnail
    const updatedClip = await this.clipRepo.update(clipId, {
      captionSrt: srtContent,
      previewPath: `/api/uploads/previews/${clip.id}.mp4`,
      ...(thumbnailUrl ? { thumbnail: thumbnailUrl } : {}),
    });

    // Step 8: Update project timestamp
    await this.projectRepo.update(clip.projectId, {
      updatedAt: new Date(),
    });

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
