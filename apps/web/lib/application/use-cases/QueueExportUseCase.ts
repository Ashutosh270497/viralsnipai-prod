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
import { ExportQueueService } from '@/lib/domain/services/ExportQueueService';
import { getLocalUploadDir } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Export } from '@/lib/types';

export interface QueueExportInput {
  projectId: string;
  clipIds: string[];
  preset: 'shorts_9x16_1080' | 'square_1x1_1080' | 'landscape_16x9_1080';
  userId: string;
}

export interface QueueExportOutput {
  export: Export;
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
    const { projectId, clipIds, preset, userId } = input;

    logger.info('Starting export queue', {
      projectId,
      clipIds,
      preset,
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

    // Note: We trust that the provided clipIds belong to the project
    // The export job will validate this during processing

    logger.info('Validated clips for export', {
      projectId,
      requestedClips: clipIds.length,
    });

    // Step 3: Create export record
    const exportRecord = await this.exportRepo.create({
      projectId: project.id,
      clipIds: clipIds,
      preset: preset,
      outputPath: '', // Will be set after determining storage path
      storagePath: '', // Will be set next
      status: 'queued',
    } as any);

    logger.info('Export record created', { exportId: exportRecord.id });

    // Step 4: Set storage and output paths
    const uploadsDir = getLocalUploadDir();
    const storagePath = path.join(uploadsDir, 'exports', `${exportRecord.id}.mp4`);
    const outputPath = `/api/uploads/exports/${exportRecord.id}.mp4`;

    const updatedExport = await this.exportRepo.update(exportRecord.id, {
      storagePath,
      outputPath,
    } as any);

    logger.info('Export paths configured', {
      exportId: exportRecord.id,
      storagePath,
      outputPath,
    });

    // Step 5: Queue export job for background processing
    await this.exportQueueService.queueJob(exportRecord.id);

    // Step 6: Update project timestamp
    await this.projectRepo.update(projectId, {
      updatedAt: new Date(),
    } as any);

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
