/**
 * Ingest YouTube Video Use Case
 *
 * Orchestrates the YouTube video ingestion workflow:
 * 1. Validate project and user permissions
 * 2. Download YouTube video
 * 3. Transcribe video with word-level timestamps
 * 4. Create asset with transcript in database
 * 5. Update project metadata
 *
 * @module IngestYouTubeVideoUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import { YouTubeDownloadService } from '@/lib/domain/services/YouTubeDownloadService';
import { TranscriptionService } from '@/lib/domain/services/TranscriptionService';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Asset } from '@/lib/types';

export interface IngestYouTubeVideoInput {
  projectId: string;
  sourceUrl: string;
  userId: string;
}

export interface IngestYouTubeVideoOutput {
  asset: Asset;
  metadata: {
    title?: string;
    durationSec: number;
    transcriptionGenerated: boolean;
  };
}

@injectable()
export class IngestYouTubeVideoUseCase {
  constructor(
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.YouTubeDownloadService) private youtubeDownloader: YouTubeDownloadService,
    @inject(TYPES.TranscriptionService) private transcriptionService: TranscriptionService
  ) {}

  async execute(input: IngestYouTubeVideoInput): Promise<IngestYouTubeVideoOutput> {
    const { projectId, sourceUrl, userId } = input;

    logger.info('Starting YouTube video ingestion', {
      projectId,
      sourceUrl,
      userId,
    });

    // Step 1: Validate project and user permissions
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    if (project.userId !== userId) {
      throw AppError.forbidden('Access denied to this project');
    }

    // Step 2: Download YouTube video
    logger.info('Downloading YouTube video', { sourceUrl });

    const downloadResult = await this.youtubeDownloader.downloadVideo(sourceUrl, projectId);

    logger.info('YouTube video downloaded', {
      filePath: downloadResult.filePath,
      durationSec: downloadResult.durationSec,
      title: downloadResult.title,
    });

    // Step 3: Transcribe video
    logger.info('Transcribing video', { filePath: downloadResult.filePath });

    const transcriptionResult = await this.transcriptionService.getOrCreateTranscription(
      downloadResult.filePath,
      null // No existing transcript
    );

    const transcriptionGenerated = true;

    logger.info('Transcription completed', {
      textLength: transcriptionResult.text.length,
      segmentCount: transcriptionResult.segments?.length || 0,
    });

    // Step 4: Create asset with transcript
    const asset = await this.assetRepo.create({
      projectId: project.id,
      type: 'video',
      path: downloadResult.publicPath,
      storagePath: downloadResult.filePath,
      durationSec: downloadResult.durationSec,
      transcript: this.transcriptionService.serializeTranscription(transcriptionResult),
    });

    logger.info('Asset created', { assetId: asset.id });

    // Step 5: Update project metadata
    await this.projectRepo.update(projectId, {
      updatedAt: new Date(),
      topic: project.topic || downloadResult.title || project.title,
      sourceUrl: sourceUrl,
    } as any);

    logger.info('YouTube video ingestion completed', {
      projectId,
      assetId: asset.id,
      durationSec: downloadResult.durationSec,
    });

    return {
      asset,
      metadata: {
        title: downloadResult.title,
        durationSec: downloadResult.durationSec,
        transcriptionGenerated,
      },
    };
  }
}
