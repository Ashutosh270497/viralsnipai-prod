/**
 * YouTube Download Service (Domain Layer)
 *
 * Domain service for downloading YouTube videos.
 * Handles video download and metadata extraction.
 *
 * @module YouTubeDownloadService
 */

import { injectable } from 'inversify';
import { downloadYouTubeVideo } from '@/lib/youtube';
import { logger } from '@/lib/logger';

export interface YouTubeDownloadResult {
  filePath: string;
  publicPath: string;
  durationSec: number;
  title?: string;
  thumbnail?: string;
}

@injectable()
export class YouTubeDownloadService {
  /**
   * Download a YouTube video and return file paths and metadata
   */
  async downloadVideo(sourceUrl: string, projectId: string): Promise<YouTubeDownloadResult> {
    logger.info('Downloading YouTube video', { sourceUrl, projectId });

    try {
      const result = await downloadYouTubeVideo(sourceUrl, projectId);

      logger.info('YouTube video downloaded successfully', {
        projectId,
        durationSec: result.durationSec,
        title: result.title,
      });

      return result;
    } catch (error) {
      logger.error('Failed to download YouTube video', {
        error,
        sourceUrl,
        projectId,
      });
      throw error;
    }
  }
}
