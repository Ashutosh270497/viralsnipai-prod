export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { ExportCaptionsUseCase } from '@/lib/application/use-cases/ExportCaptionsUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { CAPTION_STYLES, AGGRESSIVENESS_LEVELS } from '@/lib/constants/caption-styles';

const schema = z.object({
  format: z.enum(['srt', 'vtt', 'json']),
  includeStyle: z.boolean().optional().default(false),
  styleId: z.string().optional(),
  aggressiveness: z.string().optional(),
});

/**
 * POST /api/clips/[id]/export-captions
 *
 * Export clip captions in various formats (SRT, WebVTT, JSON).
 * Optionally includes caption styling metadata for JSON format.
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Use Case orchestrates business logic
 * - Domain service handles format conversion
 * - Repositories handle data access
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string } }) => {
    // Step 1: Validate authentication
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    // Step 2: Validate request body
    const json = await request.json();
    const result = schema.safeParse(json);

    if (!result.success) {
      return ApiResponseBuilder.badRequest('Invalid request body', {
        errors: result.error.flatten(),
      });
    }

    const { format, includeStyle, styleId, aggressiveness } = result.data;
    const { id: clipId } = params;

    // Step 3: Validate style and aggressiveness if includeStyle is true
    if (includeStyle) {
      if (styleId) {
        const validStyleIds = CAPTION_STYLES.map((s) => s.id);
        if (!validStyleIds.includes(styleId as any)) {
          return ApiResponseBuilder.badRequest(`Invalid styleId: ${styleId}`);
        }
      }

      if (aggressiveness) {
        const validAggressiveness = AGGRESSIVENESS_LEVELS.map((l) => l.value);
        if (!validAggressiveness.includes(aggressiveness as any)) {
          return ApiResponseBuilder.badRequest(
            `Invalid aggressiveness: ${aggressiveness}`
          );
        }
      }
    }

    logger.info('Caption export API called', {
      clipId,
      format,
      includeStyle,
      userId: user.id,
    });

    // Step 4: Execute use case via DI container
    const useCase = container.get<ExportCaptionsUseCase>(TYPES.ExportCaptionsUseCase);

    const output = await useCase.execute({
      clipId,
      userId: user.id,
      format,
      includeStyle,
      styleId: styleId as any,
      aggressiveness: aggressiveness as any,
    });

    // Step 5: Return export as downloadable file
    return new NextResponse(output.export.content, {
      status: 200,
      headers: {
        'Content-Type': output.export.mimeType,
        'Content-Disposition': `attachment; filename="${output.export.filename}"`,
        'X-Clip-Title': encodeURIComponent(output.clipTitle),
      },
    });
  }
);
