/**
 * YouTube Ingest Queue
 *
 * Handles background job processing for YouTube video ingestion.
 * Uses the existing @clippers/jobs queue system.
 *
 * Workflow:
 * 1. Queue the ingestion job
 * 2. Download YouTube video in background
 * 3. Transcribe the video
 * 4. Create asset record
 * 5. Update status in database
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles job queuing for YouTube ingestion
 * - Open/Closed: Can be extended for different video sources
 *
 * @module youtube-ingest-queue
 */

import { enqueueRender } from '@clippers/jobs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IngestYouTubeVideoUseCase } from '@/lib/application/use-cases/IngestYouTubeVideoUseCase';

export interface YouTubeIngestJobParams {
  ingestJobId: string;
  projectId: string;
  sourceUrl: string;
  userId: string;
}

/**
 * Queue a YouTube ingestion job for background processing
 */
export function queueYouTubeIngestJob(params: YouTubeIngestJobParams): void {
  const { ingestJobId, projectId, sourceUrl, userId } = params;

  logger.info('Queueing YouTube ingest job', {
    ingestJobId,
    projectId,
    sourceUrl,
  });

  enqueueRender({
    exportId: ingestJobId,
    handler: async () => {
      const startTime = Date.now();

      try {
        logger.info('Processing YouTube ingest job', {
          ingestJobId,
          projectId,
          sourceUrl,
        });

        // Execute the ingestion use case
        const useCase = container.get<IngestYouTubeVideoUseCase>(
          TYPES.IngestYouTubeVideoUseCase
        );

        const output = await useCase.execute({
          projectId,
          sourceUrl,
          userId,
        });

        const processingTime = Date.now() - startTime;

        // Update ingest job with success
        await prisma.youTubeIngestJob.update({
          where: { id: ingestJobId },
          data: {
            assetId: output.asset.id,
            status: 'completed',
            processingTime,
            metadata: output.metadata as any,
            error: null,
          },
        });

        logger.info('YouTube ingest job completed successfully', {
          ingestJobId,
          assetId: output.asset.id,
          processingTime,
        });
      } catch (error) {
        logger.error('YouTube ingest job failed', {
          error,
          ingestJobId,
        });

        // Update ingest job with error
        await prisma.youTubeIngestJob.update({
          where: { id: ingestJobId },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        throw error;
      }
    },
    onStatusChange: async (status, error) => {
      logger.info('YouTube ingest job status change', {
        ingestJobId,
        status,
        error,
      });

      // Update status in database
      await prisma.youTubeIngestJob.update({
        where: { id: ingestJobId },
        data: {
          status: status === 'processing' ? 'processing' : status,
          error:
            status === 'failed' && error
              ? error instanceof Error
                ? error.message
                : String(error)
              : null,
        },
      });
    },
  });

  logger.info('YouTube ingest job enqueued', {
    ingestJobId,
    projectId,
    sourceUrl,
  });
}
