/**
 * Video Storage Service
 *
 * Handles video file storage (local or S3).
 * Abstracts storage implementation from business logic.
 *
 * @module VideoStorageService
 */

import { injectable } from 'inversify';
import { saveBuffer, ensureUploadsSubdir, getLocalUploadDir } from '@/lib/storage';
import type { SavedFile } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface StoredVideo {
  key: string;
  url: string;
  storagePath: string;
}

@injectable()
export class VideoStorageService {
  /**
   * Save a video file from buffer
   * @param buffer - Video file buffer
   * @param projectId - Project ID (for organizing files)
   * @param options - Storage options
   * @returns Stored video metadata
   */
  async saveVideo(
    buffer: Buffer,
    projectId: string,
    options?: {
      extension?: string;
      contentType?: string;
    }
  ): Promise<StoredVideo> {
    try {
      logger.info('Saving video file', {
        projectId,
        bufferSize: buffer.length,
        extension: options?.extension,
        contentType: options?.contentType,
      });

      const saved = await saveBuffer(buffer, {
        prefix: `projects/${projectId}/videos/`,
        extension: options?.extension || '.mp4',
        contentType: options?.contentType || 'video/mp4',
      });

      logger.info('Video file saved', {
        projectId,
        key: saved.key,
        storagePath: saved.storagePath,
      });

      return {
        key: saved.key,
        url: saved.url,
        storagePath: saved.storagePath,
      };
    } catch (error) {
      logger.error('Failed to save video file', { projectId, error });
      const errorMessage = error instanceof Error ? `: ${error.message}` : '';
      throw AppError.internal(`Failed to save video file${errorMessage}`);
    }
  }

  /**
   * Save a video from a File object (from FormData)
   * @param file - File object
   * @param projectId - Project ID
   * @returns Stored video metadata
   */
  async saveVideoFromFile(file: File, projectId: string): Promise<StoredVideo> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      const extension = file.name.includes('.')
        ? `.${file.name.split('.').pop()}`
        : '.mp4';

      return await this.saveVideo(buffer, projectId, {
        extension,
        contentType: file.type || 'video/mp4',
      });
    } catch (error) {
      logger.error('Failed to save video from file', { projectId, fileName: file.name, error });
      throw AppError.internal('Failed to upload video file');
    }
  }

  /**
   * Save a thumbnail image
   * @param buffer - Thumbnail buffer
   * @param projectId - Project ID
   * @param clipId - Clip ID
   * @returns Stored thumbnail metadata
   */
  async saveThumbnail(
    buffer: Buffer,
    projectId: string,
    clipId: string
  ): Promise<StoredVideo> {
    try {
      logger.info('Saving thumbnail', { projectId, clipId });

      const saved = await saveBuffer(buffer, {
        prefix: `projects/${projectId}/thumbnails/`,
        extension: '.jpg',
        contentType: 'image/jpeg',
      });

      logger.info('Thumbnail saved', {
        projectId,
        clipId,
        key: saved.key,
      });

      return {
        key: saved.key,
        url: saved.url,
        storagePath: saved.storagePath,
      };
    } catch (error) {
      logger.error('Failed to save thumbnail', { projectId, clipId, error });
      throw AppError.internal('Failed to save thumbnail');
    }
  }

  /**
   * Ensure uploads subdirectory exists
   * @param subdir - Subdirectory name
   * @returns Directory path
   */
  async ensureDirectory(subdir: string): Promise<string> {
    return await ensureUploadsSubdir(subdir);
  }

  /**
   * Get local upload directory path
   * @returns Upload directory path
   */
  getUploadDirectory(): string {
    return getLocalUploadDir();
  }
}
