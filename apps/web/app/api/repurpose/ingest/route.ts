export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { queueYouTubeIngestJob } from '@/lib/youtube-ingest-queue';

const schema = z.object({
  projectId: z.string(),
  sourceUrl: z.string().url(),
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

  const { projectId, sourceUrl } = result.data;

  logger.info('YouTube ingest API called', {
    projectId,
    sourceUrl,
    userId: user.id,
  });

  // Step 3: Create ingest job record
  const ingestJob = await prisma.youTubeIngestJob.create({
    data: {
      projectId,
      sourceUrl,
      status: 'queued',
    },
  });

  logger.info('YouTube ingest job created', {
    jobId: ingestJob.id,
    projectId,
    sourceUrl,
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
