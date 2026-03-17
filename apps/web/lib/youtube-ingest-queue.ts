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
import type {
  IngestProgressUpdate,
  IngestYouTubeVideoUseCase
} from '@/lib/application/use-cases/IngestYouTubeVideoUseCase';

export interface YouTubeIngestJobParams {
  ingestJobId: string;
  projectId: string;
  sourceUrl: string;
  userId: string;
}

type QueueStatus = 'queued' | 'processing' | 'done' | 'failed' | string;

function mapQueueStatusToIngestStatus(status: QueueStatus): 'queued' | 'processing' | 'completed' | 'failed' {
  if (status === 'queued') return 'queued';
  if (status === 'processing') return 'processing';
  if (status === 'done') return 'completed';
  if (status === 'failed') return 'failed';
  return 'processing';
}

function formatProgressPhase(phase: IngestProgressUpdate['phase']) {
  switch (phase) {
    case 'validating':
      return 'Validating';
    case 'downloading':
      return 'Downloading';
    case 'transcribing':
      return 'Transcribing';
    case 'saving':
      return 'Saving';
    case 'completed':
      return 'Finalizing';
    default:
      return 'Processing';
  }
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
      let lastProgressWriteAt = 0;
      let lastProgressValue = 0;

      const updateJobMetadata = async (
        metadata: Record<string, unknown>,
        status?: 'queued' | 'processing' | 'completed' | 'failed'
      ) => {
        await prisma.youTubeIngestJob.update({
          where: { id: ingestJobId },
          data: {
            ...(status ? { status } : {}),
            metadata: metadata as any,
          },
        });
      };

      const updateProgress = async (update: IngestProgressUpdate) => {
        const now = Date.now();
        const progress = Math.max(0, Math.min(99, Math.round(update.progress)));

        // Throttle noisy updates from streaming download callbacks.
        if (progress <= lastProgressValue && now - lastProgressWriteAt < 1200) {
          return;
        }
        if (progress - lastProgressValue < 2 && now - lastProgressWriteAt < 1200) {
          return;
        }

        lastProgressWriteAt = now;
        lastProgressValue = Math.max(lastProgressValue, progress);

        await updateJobMetadata(
          {
            phase: formatProgressPhase(update.phase),
            phaseKey: update.phase,
            message: update.message ?? null,
            progress: lastProgressValue,
          },
          'processing'
        );
      };

      try {
        logger.info('Processing YouTube ingest job', {
          ingestJobId,
          projectId,
          sourceUrl,
        });

        await updateJobMetadata({
          phase: 'Starting',
          phaseKey: 'queued',
          message: 'Job queued',
          progress: 5,
        }, 'processing');

        // Execute the ingestion use case
        const useCase = container.get<IngestYouTubeVideoUseCase>(
          TYPES.IngestYouTubeVideoUseCase
        );

        const output = await useCase.execute({
          projectId,
          sourceUrl,
          userId,
          onProgress: updateProgress,
        });

        const processingTime = Date.now() - startTime;

        // Update ingest job with success
        await prisma.youTubeIngestJob.update({
          where: { id: ingestJobId },
          data: {
            assetId: output.asset.id,
            status: 'completed',
            processingTime,
            metadata: {
              ...output.metadata,
              phase: 'Completed',
              phaseKey: 'completed',
              progress: 100,
            } as any,
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

      const mappedStatus = mapQueueStatusToIngestStatus(status);

      // Update status in database
      await prisma.youTubeIngestJob.update({
        where: { id: ingestJobId },
        data: {
          status: mappedStatus,
          metadata:
            mappedStatus === 'failed'
              ? {
                  phase: 'Failed',
                  phaseKey: 'failed',
                  progress: 100,
                }
              : undefined,
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
