/**
 * Queue Export Use Case
 *
 * Orchestrates the export queuing workflow:
 * 1. Validate project and user permissions
 * 2. Validate clips belong to project
 * 3. Create export record in database
 * 4. Set storage and output paths
 * 5. Queue export job for background processing
 * 6. Update project timestamp
 *
 * @module QueueExportUseCase
 */

import { injectable, inject } from 'inversify';
import path from 'path';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IExportRepository } from '@/lib/domain/repositories/IExportRepository';
import type { ExportRecord } from '@/lib/types';
import { ExportQueueService } from '@/lib/domain/services/ExportQueueService';
import { getLocalUploadDir } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import {
  resolvePlatformExportPreset,
  type ExportOutputType,
  type PlatformExportPresetId,
} from '@/lib/repurpose/export-presets';

export interface QueueExportInput {
  projectId: string;
  clipIds: string[];
  preset: 'shorts_9x16_1080' | 'square_1x1_1080' | 'portrait_4x5_1080' | 'landscape_16x9_1080';
  platformPreset?: PlatformExportPresetId | string | null;
  aspectRatio?: string | null;
  outputFormat?: ExportOutputType;
  captionTrackId?: string | null;
  layoutPreset?: string | null;
  layoutConfig?: Record<string, unknown> | null;
  exportQuality?: 'standard' | 'high';
  allowRejected?: boolean;
  includeCaptions?: boolean;
  userId: string;
}

export interface QueueExportOutput {
  export: ExportRecord;
  queued: boolean;
}

@injectable()
export class QueueExportUseCase {
  constructor(
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IExportRepository) private exportRepo: IExportRepository,
    @inject(TYPES.ExportQueueService) private exportQueueService: ExportQueueService
  ) {}

  async execute(input: QueueExportInput): Promise<QueueExportOutput> {
    const {
      projectId,
      clipIds,
      preset,
      platformPreset,
      aspectRatio,
      outputFormat = 'mp4',
      captionTrackId,
      layoutPreset,
      layoutConfig,
      exportQuality = 'high',
      allowRejected = false,
      includeCaptions = false,
      userId,
    } = input;
    const platform = resolvePlatformExportPreset(platformPreset);

    logger.info('Starting export queue', {
      projectId,
      clipIds,
      preset,
      platformPreset: platform.id,
      aspectRatio: aspectRatio ?? platform.aspectRatio,
      outputFormat,
      includeCaptions,
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

    // Step 2: Validate clips
    if (clipIds.length === 0) {
      throw AppError.badRequest('At least one clip is required');
    }

    const clipCount = await this.clipRepo.countByProjectId(projectId);
    if (clipCount === 0) {
      throw AppError.badRequest('No clips available in this project');
    }

    const projectClips = await this.clipRepo.findByProjectId(projectId);
    const validClipIds = new Set(
      projectClips
        .filter((clip) => allowRejected || clip.reviewStatus !== 'rejected')
        .map((clip) => clip.id)
    );
    const selectedClipIds = clipIds.filter((clipId) => validClipIds.has(clipId));

    if (selectedClipIds.length === 0) {
      throw AppError.badRequest('Selected clips are invalid or no longer available');
    }

    if (selectedClipIds.length !== clipIds.length) {
      logger.warn('Ignoring stale clip ids during export queue', {
        projectId,
        requestedClipCount: clipIds.length,
        validClipCount: selectedClipIds.length,
      });
    }

    logger.info('Validated clips for export', {
      projectId,
      requestedClips: selectedClipIds.length,
    });

    // Step 3: Create export record
    const exportRecord = await this.exportRepo.create({
      projectId: project.id,
      userId,
      clipIds: selectedClipIds,
      preset,
      includeCaptions,
      outputFormat,
      platformPreset: platform.id,
      aspectRatio: aspectRatio ?? platform.aspectRatio,
      captionTrackId: captionTrackId ?? null,
      layoutPreset: layoutPreset ?? null,
      metadata: {
        exportQuality,
        platformPreset: platform,
        layoutConfig: layoutConfig ?? null,
        allowRejected,
        requestedClipCount: clipIds.length,
      },
      progress: 0,
      phase: 'queued',
      outputPath: '', // Will be set after determining storage path
      storagePath: '', // Will be set next
      status: 'queued',
    });

    logger.info('Export record created', { exportId: exportRecord.id });

    // Step 4: Set storage and output paths
    const uploadsDir = getLocalUploadDir();
    const extension = outputFormat === 'zip' ? 'zip' : outputFormat === 'thumbnail' ? 'jpg' : outputFormat;
    const storagePath = path.join(uploadsDir, 'exports', `${platform.fileNamePrefix}-${exportRecord.id}.${extension}`);
    const outputPath = `/api/uploads/exports/${platform.fileNamePrefix}-${exportRecord.id}.${extension}`;

    const updatedExport = await this.exportRepo.update(exportRecord.id, {
      storagePath,
      outputPath,
    });

    logger.info('Export paths configured', {
      exportId: exportRecord.id,
      storagePath,
      outputPath,
    });

    // Step 5: Queue export job for background processing
    await this.exportQueueService.queueJob(exportRecord.id);

    // Step 6: Update project timestamp
    await this.projectRepo.update(projectId, {
      status: 'exporting',
      updatedAt: new Date(),
    });

    logger.info('Export queued successfully', {
      exportId: exportRecord.id,
      projectId,
    });

    return {
      export: updatedExport,
      queued: true,
    };
  }
}
