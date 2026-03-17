/**
 * Update Project Clip Order Use Case
 *
 * Orchestrates updating the display order of clips within a project:
 * 1. Validate project and user permissions
 * 2. Validate all clips belong to the project
 * 3. Update clip order based on array position
 * 4. Update project timestamp
 *
 * @module UpdateProjectClipOrderUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface UpdateProjectClipOrderInput {
  projectId: string;
  clipIds: string[];
  userId: string;
}

export interface UpdateProjectClipOrderOutput {
  success: boolean;
  clipsReordered: number;
}

@injectable()
export class UpdateProjectClipOrderUseCase {
  constructor(
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository
  ) {}

  async execute(input: UpdateProjectClipOrderInput): Promise<UpdateProjectClipOrderOutput> {
    const { projectId, clipIds, userId } = input;

    logger.info('Updating clip order', {
      projectId,
      clipCount: clipIds.length,
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

    // Step 2: Validate clips exist and belong to project
    if (clipIds.length === 0) {
      throw AppError.badRequest('At least one clip ID is required');
    }

    // Get all clips for the project to validate
    const projectClips = await this.clipRepo.findByProjectId(projectId);
    const projectClipIds = new Set(projectClips.map((clip) => clip.id));

    // Validate all provided clipIds belong to the project
    const invalidClipIds = clipIds.filter((id) => !projectClipIds.has(id));
    if (invalidClipIds.length > 0) {
      throw AppError.badRequest(
        `Invalid clip IDs: ${invalidClipIds.join(', ')} do not belong to this project`
      );
    }

    logger.info('Validated clips for reordering', {
      projectId,
      totalClips: projectClips.length,
      reorderingClips: clipIds.length,
    });

    // Step 3: Update clip order based on array position
    // Each clip's order field will be set to its index in the array
    await Promise.all(
      clipIds.map((clipId, index) =>
        this.clipRepo.update(clipId, {
          order: index,
        })
      )
    );

    logger.info('Clips reordered successfully', {
      projectId,
      clipsReordered: clipIds.length,
    });

    // Step 4: Update project timestamp
    await this.projectRepo.update(projectId, {
      updatedAt: new Date(),
    });

    return {
      success: true,
      clipsReordered: clipIds.length,
    };
  }
}
