/**
 * Export Queue Service (Domain Layer)
 *
 * Domain service for queuing video export jobs.
 * Handles background job queuing for video rendering.
 *
 * @module ExportQueueService
 */

import { injectable } from 'inversify';
import { queueExportJob } from '@/lib/render-queue';
import { logger } from '@/lib/logger';

@injectable()
export class ExportQueueService {
  /**
   * Queue an export job for background processing
   */
  async queueJob(exportId: string): Promise<void> {
    logger.info('Queuing export job', { exportId });

    try {
      await queueExportJob(exportId);

      logger.info('Export job queued successfully', { exportId });
    } catch (error) {
      logger.error('Failed to queue export job', { error, exportId });
      throw error;
    }
  }
}
