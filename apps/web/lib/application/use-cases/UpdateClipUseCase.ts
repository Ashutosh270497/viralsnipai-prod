/**
 * Update Clip Use Case
 *
 * Orchestrates the clip update workflow:
 * 1. Validate clip and user permissions
 * 2. Update clip properties (title, summary, etc.)
 * 3. Update project timestamp
 *
 * @module UpdateClipUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';

export interface UpdateClipInput {
  clipId: string;
  userId: string;
  updates: {
    title?: string;
    summary?: string;
    callToAction?: string;
  };
}

export interface UpdateClipOutput {
  clip: Clip;
  fieldsUpdated: string[];
}

@injectable()
export class UpdateClipUseCase {
  constructor(
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository
  ) {}

  async execute(input: UpdateClipInput): Promise<UpdateClipOutput> {
    const { clipId, userId, updates } = input;

    logger.info('Starting clip update', { clipId, userId, updates });

    // Step 1: Validate clip and user permissions
    const clip = await this.clipRepo.findById(clipId);
    if (!clip) {
      throw AppError.notFound('Clip not found');
    }

    const project = await this.projectRepo.findById(clip.projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this clip');
    }

    // Step 2: Validate at least one field to update
    const fieldsUpdated = Object.keys(updates).filter(
      (key) => updates[key as keyof typeof updates] !== undefined
    );

    if (fieldsUpdated.length === 0) {
      throw AppError.badRequest('No fields to update');
    }

    logger.info('Fields to update', { fieldsUpdated });

    // Step 3: Update clip properties
    const updatedClip = await this.clipRepo.update(clipId, updates as any);

    logger.info('Clip updated', { clipId, fieldsUpdated });

    // Step 4: Update project timestamp
    await this.projectRepo.update(clip.projectId, {
      updatedAt: new Date(),
    } as any);

    logger.info('Clip update completed', { clipId });

    return {
      clip: updatedClip,
      fieldsUpdated,
    };
  }
}
