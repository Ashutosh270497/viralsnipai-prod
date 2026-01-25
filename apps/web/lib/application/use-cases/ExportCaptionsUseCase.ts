/**
 * Export Captions Use Case
 *
 * Orchestrates exporting clip captions in various formats:
 * 1. Validate clip and user permissions
 * 2. Ensure captions exist
 * 3. Export captions in requested format (SRT, WebVTT, JSON)
 * 4. Return export result with content and metadata
 *
 * @module ExportCaptionsUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import { CaptionExportService, type CaptionExportFormat, type CaptionExportResult } from '@/lib/domain/services/CaptionExportService';
import type { CaptionStyleId, AggressivenessValue } from '@/lib/constants/caption-styles';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface ExportCaptionsInput {
  clipId: string;
  userId: string;
  format: CaptionExportFormat;
  includeStyle?: boolean;
  styleId?: CaptionStyleId;
  aggressiveness?: AggressivenessValue;
}

export interface ExportCaptionsOutput {
  export: CaptionExportResult;
  clipTitle: string;
}

@injectable()
export class ExportCaptionsUseCase {
  constructor(
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.CaptionExportService) private captionExportService: CaptionExportService
  ) {}

  async execute(input: ExportCaptionsInput): Promise<ExportCaptionsOutput> {
    const { clipId, userId, format, includeStyle, styleId, aggressiveness } = input;

    logger.info('Exporting captions', {
      clipId,
      format,
      includeStyle,
      userId,
    });

    // Step 1: Validate clip exists
    const clip = await this.clipRepo.findById(clipId);
    if (!clip) {
      throw AppError.notFound('Clip not found');
    }

    // Step 2: Validate user permissions through project ownership
    const project = await this.projectRepo.findById(clip.projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    if (project.userId !== userId) {
      throw AppError.forbidden('Access denied to this clip');
    }

    // Step 3: Ensure captions exist
    if (!clip.captionSrt) {
      throw AppError.badRequest(
        'No captions available for this clip. Please generate captions first.'
      );
    }

    logger.info('Validated clip for caption export', {
      clipId,
      projectId: project.id,
      format,
    });

    // Step 4: Export captions in requested format
    const exportResult = await this.captionExportService.exportCaptions(
      clip.captionSrt,
      clipId,
      {
        format,
        includeStyle,
        styleId,
        aggressiveness,
      }
    );

    logger.info('Captions exported successfully', {
      clipId,
      format,
      filename: exportResult.filename,
    });

    return {
      export: exportResult,
      clipTitle: clip.title || 'Untitled Clip',
    };
  }
}
