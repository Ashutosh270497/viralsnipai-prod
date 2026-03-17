export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/repurpose/ingest/[jobId]
 *
 * Check the status of a YouTube ingestion job.
 * Returns job status and asset details when completed.
 *
 * @module api/repurpose/ingest/[jobId]
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: { jobId: string } }) => {
    // Step 1: Validate authentication
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    const jobId = params.jobId;

    logger.info('Checking YouTube ingest job status', {
      jobId,
      userId: user.id,
    });

    // Step 2: Get job status
    const job = await prisma.youTubeIngestJob.findUnique({
      where: { id: jobId },
      include: {
        asset: true,
        project: true,
      },
    });

    if (!job) {
      return ApiResponseBuilder.notFound('Ingest job not found');
    }

    // Step 3: Verify user has access to this project
    if (job.project.userId !== user.id) {
      return ApiResponseBuilder.forbidden('Access denied to this job');
    }

    // Step 4: Return job status
    return ApiResponseBuilder.success({
      jobId: job.id,
      status: job.status,
      metadata: job.metadata,
      assetId: job.assetId,
      asset: job.asset,
      processingTime: job.processingTime,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  }
);
