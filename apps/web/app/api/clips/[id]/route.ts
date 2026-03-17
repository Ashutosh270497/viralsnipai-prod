export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { UpdateClipUseCase } from '@/lib/application/use-cases/UpdateClipUseCase';
import type { UpdateClipInput } from '@/lib/application/use-cases/UpdateClipUseCase';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { normalizeClipCaptionStyle } from '@/lib/repurpose/caption-style-config';

const patchSchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().optional(),
    callToAction: z.string().optional(),
    captionSrt: z.string().optional(),
    captionStyle: z.record(z.any()).nullable().optional(),
    previewPath: z.string().nullable().optional(),
    startMs: z.number().int().min(0).optional(),
    endMs: z.number().int().positive().optional(),
    transcriptEditRangesMs: z
      .array(
        z
          .object({
            startMs: z.number().int().min(0),
            endMs: z.number().int().positive(),
          })
          .refine((range) => range.endMs > range.startMs, {
            message: 'Range endMs must be greater than startMs',
            path: ['endMs'],
          })
      )
      .nullable()
      .optional(),
  })
  .refine((data) => {
    if (data.startMs !== undefined && data.endMs !== undefined) {
      return data.endMs > data.startMs;
    }
    return true;
  }, {
    message: 'endMs must be greater than startMs',
    path: ['endMs'],
  });

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    const json = await request.json();
    const result = patchSchema.safeParse(json);

    if (!result.success) {
      return ApiResponseBuilder.badRequest('Invalid request body', {
        errors: result.error.flatten(),
      });
    }

    const { id } = params;

    logger.info('Clip update API called', {
      clipId: id,
      updates: Object.keys(result.data),
      userId: user.id,
    });

    const useCase = container.get<UpdateClipUseCase>(TYPES.UpdateClipUseCase);

    const normalizedUpdates: UpdateClipInput['updates'] = {
      ...(result.data.title !== undefined ? { title: result.data.title } : {}),
      ...(result.data.summary !== undefined ? { summary: result.data.summary } : {}),
      ...(result.data.callToAction !== undefined ? { callToAction: result.data.callToAction } : {}),
      ...(result.data.captionSrt !== undefined ? { captionSrt: result.data.captionSrt } : {}),
      ...(result.data.previewPath !== undefined ? { previewPath: result.data.previewPath } : {}),
      ...(result.data.startMs !== undefined ? { startMs: result.data.startMs } : {}),
      ...(result.data.endMs !== undefined ? { endMs: result.data.endMs } : {}),
      ...(result.data.transcriptEditRangesMs !== undefined
        ? { transcriptEditRangesMs: result.data.transcriptEditRangesMs }
        : {}),
      ...(result.data.captionStyle !== undefined
        ? {
            captionStyle: result.data.captionStyle
              ? normalizeClipCaptionStyle(result.data.captionStyle)
              : null,
          }
        : {}),
    };

    const output = await useCase.execute({
      clipId: id,
      userId: user.id,
      updates: normalizedUpdates,
    });

    return ApiResponseBuilder.success(
      {
        clip: output.clip,
        fieldsUpdated: output.fieldsUpdated,
        normalizedTranscriptEditRangesMs:
          output.normalizedTranscriptEditRangesMs ?? null,
      },
      'Clip updated successfully'
    );
  }
);

export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    const { id } = params;
    const clipRepo = container.get<IClipRepository>(TYPES.IClipRepository);
    const projectRepo = container.get<IProjectRepository>(TYPES.IProjectRepository);

    const clip = await clipRepo.findById(id);
    if (!clip) {
      return ApiResponseBuilder.notFound('Clip not found');
    }

    const project = await projectRepo.findById(clip.projectId);
    if (!project || project.userId !== user.id) {
      return ApiResponseBuilder.forbidden('Access denied');
    }

    logger.info('Clip delete API called', { clipId: id, userId: user.id });

    await clipRepo.delete(id);

    return ApiResponseBuilder.success({ deleted: true }, 'Clip deleted');
  }
);
