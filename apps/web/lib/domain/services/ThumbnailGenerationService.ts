/**
 * Thumbnail Generation Service
 *
 * Generates video thumbnails for clips using FFmpeg.
 * Creates a single frame snapshot at a specific timestamp.
 *
 * @module ThumbnailGenerationService
 */

import { injectable } from 'inversify';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface GenerateThumbnailOptions {
  videoPath: string;
  timestampSeconds: number;
  projectId: string;
  clipId?: string;
}

export interface ThumbnailResult {
  thumbnailPath: string;
  publicUrl: string;
}

@injectable()
export class ThumbnailGenerationService {
  /**
   * Generate a single thumbnail at a specific timestamp
   * @param options - Generation options
   * @returns Thumbnail file paths
   */
  async generateThumbnail(options: GenerateThumbnailOptions): Promise<ThumbnailResult> {
    const { videoPath, timestampSeconds, projectId, clipId } = options;

    try {
      logger.info('Generating thumbnail', {
        videoPath,
        timestampSeconds,
        projectId,
        clipId,
      });

      // Ensure output directory exists
      const outputDir = path.join(
        process.cwd(),
        'public',
        'uploads',
        'thumbnails',
        projectId
      );

      await fs.mkdir(outputDir, { recursive: true });

      // Generate unique filename
      const filename = clipId
        ? `clip-${clipId}-${nanoid(8)}.jpg`
        : `thumb-${nanoid(12)}.jpg`;

      const outputPath = path.join(outputDir, filename);

      // Ensure we have an absolute path to the video
      let absoluteVideoPath: string;
      if (path.isAbsolute(videoPath)) {
        // Already absolute path (e.g., /Users/.../file.mp4)
        absoluteVideoPath = videoPath;
      } else if (videoPath.startsWith('/uploads')) {
        // Public URL path - convert to absolute file system path
        absoluteVideoPath = path.join(process.cwd(), 'public', videoPath);
      } else {
        // Relative path - use as-is
        absoluteVideoPath = videoPath;
      }

      logger.info('Thumbnail generation paths', {
        originalPath: videoPath,
        absolutePath: absoluteVideoPath,
        outputPath,
      });

      // Generate thumbnail using FFmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(absoluteVideoPath)
          .seekInput(timestampSeconds)
          .outputOptions([
            '-frames:v', '1',          // Extract only 1 frame
            '-q:v', '2',               // High quality
            '-vf', 'scale=1280:720'    // Resize to 1280x720
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            logger.info('Starting thumbnail generation', {
              command: commandLine,
              timestampSeconds,
            });
          })
          .on('end', () => {
            logger.info('Thumbnail generated successfully', {
              outputPath,
              publicUrl: `/uploads/thumbnails/${projectId}/${filename}`,
              projectId,
              clipId,
            });
            resolve();
          })
          .on('error', (error) => {
            logger.error('Thumbnail generation failed in ffmpeg', {
              error: error.message,
              videoPath: absoluteVideoPath,
              timestampSeconds,
              projectId,
              outputPath,
            });
            reject(error);
          })
          .run();
      });

      // Convert to public URL
      const publicUrl = `/uploads/thumbnails/${projectId}/${filename}`;

      return {
        thumbnailPath: outputPath,
        publicUrl,
      };
    } catch (error) {
      logger.error('Failed to generate thumbnail', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        videoPath,
        timestampSeconds,
        projectId,
        clipId,
      });

      // Throw error so caller can handle it
      throw AppError.internal(
        'Thumbnail generation failed',
        error instanceof Error ? error.message : undefined
      );
    }
  }

  /**
   * Generate thumbnail for a clip (at the midpoint)
   * @param videoPath - Path to source video
   * @param startMs - Clip start time in milliseconds
   * @param endMs - Clip end time in milliseconds
   * @param projectId - Project ID
   * @param clipId - Optional clip ID
   * @returns Thumbnail result or null if generation fails
   */
  async generateClipThumbnail(
    videoPath: string,
    startMs: number,
    endMs: number,
    projectId: string,
    clipId?: string
  ): Promise<ThumbnailResult | null> {
    try {
      // Calculate midpoint timestamp in seconds
      const midpointMs = startMs + (endMs - startMs) / 2;
      const timestampSeconds = midpointMs / 1000;

      return await this.generateThumbnail({
        videoPath,
        timestampSeconds,
        projectId,
        clipId,
      });
    } catch (error) {
      logger.warn('Clip thumbnail generation failed, continuing without thumbnail', {
        error: error instanceof Error ? error.message : String(error),
        clipId,
        projectId,
      });
      return null;
    }
  }

  /**
   * Batch generate thumbnails for multiple clips
   * @param clips - Array of clip info
   * @returns Array of thumbnail results (null for failed generations)
   */
  async generateClipThumbnails(
    clips: Array<{
      id?: string;
      startMs: number;
      endMs: number;
      videoPath: string;
      projectId: string;
    }>
  ): Promise<Array<ThumbnailResult | null>> {
    logger.info('Batch generating thumbnails', { clipCount: clips.length });

    const results = await Promise.allSettled(
      clips.map((clip) =>
        this.generateClipThumbnail(
          clip.videoPath,
          clip.startMs,
          clip.endMs,
          clip.projectId,
          clip.id
        )
      )
    );

    return results.map((result) =>
      result.status === 'fulfilled' ? result.value : null
    );
  }
}
