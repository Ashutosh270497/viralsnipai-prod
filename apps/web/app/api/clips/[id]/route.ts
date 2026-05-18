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
import { ASPECT_RATIO_VALUES, LAYOUT_PRESET_VALUES } from '@/lib/repurpose/layout-config';
import type { TranscriptEditRange } from '@/lib/repurpose/transcript-sync';
import { assertSameOriginRequest } from '@/lib/security/origin';

const SMART_REFRAME_MODES = [
  "smart_auto",
  "smart_face",
  "smart_person",
  "dynamic_auto",
  "dynamic_face",
  "dynamic_person",
  "center_crop",
  "blurred_background",
] as const;

const layoutCropBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.08).max(1),
  height: z.number().min(0.08).max(1),
});

const layoutConfigSchema = z.object({
  preset: z.enum(LAYOUT_PRESET_VALUES),
  aspectRatio: z.enum(ASPECT_RATIO_VALUES),
  cropBox: layoutCropBoxSchema,
  speakerRegion: layoutCropBoxSchema.nullable().optional(),
  screenRegion: layoutCropBoxSchema.nullable().optional(),
  backgroundMode: z.enum(["crop", "blur", "letterbox", "solid"]).optional(),
  blurBackground: z.boolean().optional(),
  borderRadius: z.number().min(0).max(48).optional(),
  padding: z.number().min(0).max(120).optional(),
  safeZones: z
    .object({
      top: z.number().min(0).max(0.35),
      bottom: z.number().min(0).max(0.35),
      left: z.number().min(0).max(0.25),
      right: z.number().min(0).max(0.25),
    })
    .optional(),
  reframeConfidence: z.enum(["high", "medium", "low"]).optional(),
  reason: z.string().max(500).optional(),
});

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
    expectedVersion: z.number().int().min(1),
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
    /** Smart reframe mode — applied to next export when set. */
    reframeMode: z.enum(SMART_REFRAME_MODES).optional(),
    trackingSmoothness: z.enum(["low", "medium", "high"]).optional(),
    exportQuality: z.enum(["balanced", "high"]).optional(),
    /** Whether captions should be burned into the exported video. */
    captionsEnabled: z.boolean().optional(),
    /** Whether to apply the caption safe zone when computing crop windows. */
    captionSafeZoneEnabled: z.boolean().optional(),
    layoutPreset: z.enum(LAYOUT_PRESET_VALUES).optional(),
    aspectRatio: z.enum(ASPECT_RATIO_VALUES).optional(),
    layoutConfig: layoutConfigSchema.optional(),
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
    const originError = assertSameOriginRequest(request);
    if (originError) return originError;

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

    const exportSettings: NonNullable<UpdateClipInput['updates']['exportSettings']> = {};
    if (result.data.reframeMode !== undefined) exportSettings.reframeMode = result.data.reframeMode;
    if (result.data.trackingSmoothness !== undefined) exportSettings.trackingSmoothness = result.data.trackingSmoothness;
    if (result.data.exportQuality !== undefined) exportSettings.exportQuality = result.data.exportQuality;
    if (result.data.captionsEnabled !== undefined) exportSettings.captionsEnabled = result.data.captionsEnabled;
    if (result.data.captionSafeZoneEnabled !== undefined) exportSettings.captionSafeZoneEnabled = result.data.captionSafeZoneEnabled;
    if (result.data.layoutPreset !== undefined) exportSettings.layoutPreset = result.data.layoutPreset;
    if (result.data.aspectRatio !== undefined) exportSettings.aspectRatio = result.data.aspectRatio;
    if (result.data.layoutConfig !== undefined) exportSettings.layoutConfig = result.data.layoutConfig;
    const hasExportSettings = Object.keys(exportSettings).length > 0;

    const normalizedUpdates: UpdateClipInput['updates'] = {
      ...(result.data.title !== undefined ? { title: result.data.title } : {}),
      ...(result.data.summary !== undefined ? { summary: result.data.summary } : {}),
      ...(result.data.callToAction !== undefined ? { callToAction: result.data.callToAction } : {}),
      ...(result.data.captionSrt !== undefined ? { captionSrt: result.data.captionSrt } : {}),
      ...(result.data.previewPath !== undefined ? { previewPath: result.data.previewPath } : {}),
      ...(result.data.startMs !== undefined ? { startMs: result.data.startMs } : {}),
      ...(result.data.endMs !== undefined ? { endMs: result.data.endMs } : {}),
      ...(result.data.transcriptEditRangesMs !== undefined
        ? { transcriptEditRangesMs: result.data.transcriptEditRangesMs as TranscriptEditRange[] }
        : {}),
      ...(result.data.captionStyle !== undefined
        ? {
            captionStyle: result.data.captionStyle
              ? normalizeClipCaptionStyle(result.data.captionStyle)
              : null,
          }
        : {}),
      ...(hasExportSettings ? { exportSettings } : {}),
    };

    const output = await useCase.execute({
      clipId: id,
      userId: user.id,
      expectedVersion: result.data.expectedVersion,
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
  async (request: Request, { params }: { params: { id: string } }) => {
    const originError = assertSameOriginRequest(request);
    if (originError) return originError;

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
