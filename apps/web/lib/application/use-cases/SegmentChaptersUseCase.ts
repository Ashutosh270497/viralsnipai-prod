/**
 * Segment Chapters Use Case
 *
 * Orchestrates AI-powered chapter segmentation:
 * 1. Validate project and user permissions
 * 2. Retrieve asset with transcript
 * 3. Use ChapterSegmentationService to analyze and segment
 * 4. Return chapters with metadata
 *
 * @module SegmentChaptersUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import { ChapterSegmentationService, type Chapter } from '@/lib/domain/services/ChapterSegmentationService';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface SegmentChaptersInput {
  projectId: string;
  assetId: string;
  userId: string;
  targetChapterCount?: number;
}

export interface SegmentChaptersOutput {
  chapters: Chapter[];
  totalChapters: number;
  totalDurationSec: number;
  analysisMethod: 'ai' | 'fallback';
  assetId: string;
  projectId: string;
}

@injectable()
export class SegmentChaptersUseCase {
  constructor(
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.ChapterSegmentationService) private segmentationService: ChapterSegmentationService
  ) {}

  async execute(input: SegmentChaptersInput): Promise<SegmentChaptersOutput> {
    const { projectId, assetId, userId, targetChapterCount } = input;

    logger.info('Segmenting chapters', {
      projectId,
      assetId,
      userId,
      targetChapterCount,
    });

    // Step 1: Validate project and user permissions
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    if (project.userId !== userId) {
      throw AppError.forbidden('Access denied to this project');
    }

    // Step 2: Retrieve asset with transcript
    const asset = await this.assetRepo.findById(assetId);
    if (!asset) {
      throw AppError.notFound('Asset not found');
    }

    // Validate asset belongs to project
    if (asset.projectId !== projectId) {
      throw AppError.forbidden('Asset does not belong to this project');
    }

    // Ensure transcript exists
    if (!asset.transcript || asset.transcript.trim().length === 0) {
      throw AppError.badRequest('Asset does not have a transcript. Please transcribe the video first.');
    }

    // Ensure duration is available
    if (!asset.durationSec || asset.durationSec <= 0) {
      throw AppError.badRequest('Asset duration is invalid');
    }

    // Convert duration from seconds to milliseconds
    const durationMs = asset.durationSec * 1000;

    logger.info('Asset retrieved for segmentation', {
      assetId,
      hasTranscript: !!asset.transcript,
      durationSec: asset.durationSec,
      durationMs,
      transcriptLength: asset.transcript.length,
    });

    // Step 3: Segment into chapters using AI
    const result = await this.segmentationService.segmentIntoChapters(
      asset.transcript,
      durationMs,
      targetChapterCount
    );

    logger.info('Chapter segmentation complete', {
      projectId,
      assetId,
      chaptersGenerated: result.totalChapters,
      method: result.analysisMethod,
    });

    return {
      chapters: result.chapters,
      totalChapters: result.totalChapters,
      totalDurationSec: result.totalDurationSec,
      analysisMethod: result.analysisMethod,
      assetId,
      projectId,
    };
  }

  /**
   * Validate chapter count for the asset's duration
   */
  async validateChapterCount(assetId: string, targetCount: number): Promise<number> {
    const asset = await this.assetRepo.findById(assetId);
    if (!asset || !asset.durationSec) {
      return targetCount;
    }

    return this.segmentationService.validateChapterCount(targetCount, asset.durationSec);
  }
}
