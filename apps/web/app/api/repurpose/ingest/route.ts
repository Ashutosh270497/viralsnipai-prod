export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { assertSameOriginRequest } from '@/lib/security/origin';
import { consumeV1RateLimit, rateLimitResponse, V1_RATE_LIMITS } from '@/lib/security/rate-limit';
import { queueYouTubeIngestJob } from '@/lib/youtube-ingest-queue';
import { youtubeUrlSchema } from '@/lib/validations';

const ACTIVE_INGEST_STATUSES = ['queued', 'processing'] as const;

const schema = z.object({
  projectId: z.string(),
  sourceUrl: youtubeUrlSchema,
});

/**
 * POST /api/repurpose/ingest
 *
 * Queue a YouTube video ingestion job.
 * Returns immediately with job ID for status tracking.
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Job queue handles async processing
 * - Frontend polls for status updates
 */
export const POST = withErrorHandling(async (request: Request) => {
  const originError = assertSameOriginRequest(request);
  if (originError) return originError;

  // Step 1: Validate authentication
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized('Authentication required');
  }

  const rateLimit = await consumeV1RateLimit({
    request,
    userId: user.id,
    routeKey: 'youtube_ingest',
    rules: V1_RATE_LIMITS.YOUTUBE_INGEST,
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit, 'YouTube imports are being requested too quickly. Please wait and try again.');
  }

  // Step 2: Validate request body
  const json = await request.json();
  const result = schema.safeParse(json);

  if (!result.success) {
    return ApiResponseBuilder.badRequest('Invalid request body', {
      errors: result.error.flatten(),
    });
  }

  const { projectId } = result.data;
  const sourceUrl = result.data.sourceUrl.trim();

  // Step 2.5: Verify project ownership before creating job
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: user.id,
    },
    select: { id: true },
  });

  if (!project) {
    return ApiResponseBuilder.forbidden('Access denied to this project');
  }

  logger.info('YouTube ingest API called', {
    projectId,
    sourceHost: safeSourceHost(sourceUrl),
    userId: user.id,
  });

  // Step 3: Return an active job for the same project/source instead of
  // creating duplicate ingest workers on double-clicks or retries.
  const activeJob = await prisma.youTubeIngestJob.findFirst({
    where: {
      projectId,
      sourceUrl,
      status: { in: [...ACTIVE_INGEST_STATUSES] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeJob) {
    logger.info('Returning existing active YouTube ingest job', {
      jobId: activeJob.id,
      projectId,
      sourceHost: safeSourceHost(sourceUrl),
      status: activeJob.status,
    });

    return ApiResponseBuilder.success(
      {
        jobId: activeJob.id,
        status: activeJob.status,
        reused: true,
      },
      'YouTube video ingestion already queued'
    );
  }

  let ingestJob;
  try {
    ingestJob = await prisma.youTubeIngestJob.create({
      data: {
        projectId,
        sourceUrl,
        status: 'queued',
        metadata: {
          phase: 'Queued',
          phaseKey: 'queued',
          progress: 5,
          message: 'Job queued',
        } as any,
      },
    });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      const existingJob = await prisma.youTubeIngestJob.findFirst({
        where: {
          projectId,
          sourceUrl,
          status: { in: [...ACTIVE_INGEST_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingJob) {
        return ApiResponseBuilder.success(
          {
            jobId: existingJob.id,
            status: existingJob.status,
            reused: true,
          },
          'YouTube video ingestion already queued'
        );
      }
    }

    throw error;
  }

  logger.info('YouTube ingest job created', {
    jobId: ingestJob.id,
    projectId,
    sourceHost: safeSourceHost(sourceUrl),
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'ingesting' },
  });

  // Step 4: Queue the background job
  queueYouTubeIngestJob({
    ingestJobId: ingestJob.id,
    projectId,
    sourceUrl,
    userId: user.id,
  });

  // Step 5: Return success response with job ID
  return ApiResponseBuilder.success(
    {
      jobId: ingestJob.id,
      status: 'queued',
    },
    'YouTube video ingestion queued'
  );
});

function safeSourceHost(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return 'unknown';
  }
}
