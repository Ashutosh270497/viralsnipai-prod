/**
 * Video Stitching Service (Infrastructure Layer)
 *
 * Handles video concatenation and stitching operations using FFmpeg.
 * Provides infrastructure-level support for creating composite clips
 * by combining multiple video segments.
 *
 * @module VideoStitchingService
 */

import { injectable } from 'inversify';
import path from 'path';
import { promises as fs } from 'fs';
import { concatClips, extractClip, PRESETS } from '@/lib/ffmpeg';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { ClipSegment } from '@/lib/domain/services/CompositeClipService';

export interface StitchingOptions {
  preset?: keyof typeof PRESETS;
  watermarkPath?: string | null;
  quality?: 'low' | 'medium' | 'high' | 'max';
}

export interface StitchingResult {
  outputPath: string;
  durationMs: number;
  fileSizeBytes: number;
}

@injectable()
export class VideoStitchingService {
  private readonly tempDir = '/tmp/composite-clips';

  constructor() {
    // Ensure temp directory exists
    this.ensureTempDir().catch((error) => {
      logger.error('Failed to create temp directory', { error });
    });
  }

  /**
   * Stitch multiple video segments into a single composite clip
   */
  async stitchSegments(
    segments: Array<{
      sourcePath: string;
      startMs: number;
      endMs: number;
      clipId: string;
    }>,
    outputPath: string,
    options: StitchingOptions = {}
  ): Promise<StitchingResult> {
    logger.info('Stitching video segments', {
      segmentCount: segments.length,
      outputPath,
      preset: options.preset || 'landscape_16x9_1080',
    });

    try {
      // Step 1: Extract each segment to temp files
      const tempSegmentPaths = await this.extractSegmentsToTemp(segments);

      // Step 2: Concatenate all temp segments
      await this.concatenateSegments(tempSegmentPaths, outputPath, options);

      // Step 3: Get output file info
      const stats = await fs.stat(outputPath);
      const totalDurationMs = segments.reduce(
        (sum, seg) => sum + (seg.endMs - seg.startMs),
        0
      );

      logger.info('Video stitching complete', {
        outputPath,
        segmentCount: segments.length,
        durationMs: totalDurationMs,
        fileSizeBytes: stats.size,
      });

      // Step 4: Clean up temp files
      await this.cleanupTempFiles(tempSegmentPaths);

      return {
        outputPath,
        durationMs: totalDurationMs,
        fileSizeBytes: stats.size,
      };
    } catch (error) {
      logger.error('Video stitching failed', { error, segmentCount: segments.length });
      throw AppError.internal(`Failed to stitch video segments: ${String(error)}`);
    }
  }

  /**
   * Extract segments to temporary files
   */
  private async extractSegmentsToTemp(
    segments: Array<{
      sourcePath: string;
      startMs: number;
      endMs: number;
      clipId: string;
    }>
  ): Promise<string[]> {
    const tempPaths: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const tempPath = path.join(
        this.tempDir,
        `segment-${Date.now()}-${i}-${segment.clipId}.mp4`
      );

      logger.info('Extracting segment to temp file', {
        index: i,
        clipId: segment.clipId,
        startMs: segment.startMs,
        endMs: segment.endMs,
        tempPath,
      });

      await extractClip({
        inputPath: segment.sourcePath,
        startMs: segment.startMs,
        endMs: segment.endMs,
        outputPath: tempPath,
      });

      tempPaths.push(tempPath);
    }

    return tempPaths;
  }

  /**
   * Concatenate extracted segments into final output
   */
  private async concatenateSegments(
    segmentPaths: string[],
    outputPath: string,
    options: StitchingOptions
  ): Promise<void> {
    const preset = options.preset || 'landscape_16x9_1080';

    logger.info('Concatenating segments', {
      segmentCount: segmentPaths.length,
      outputPath,
      preset,
    });

    await concatClips({
      clipPaths: segmentPaths,
      outputPath,
      preset,
      watermarkPath: options.watermarkPath,
    });
  }

  /**
   * Clean up temporary segment files
   */
  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        logger.debug('Cleaned up temp file', { filePath });
      } catch (error) {
        logger.warn('Failed to clean up temp file', { filePath, error });
        // Don't throw - cleanup failures shouldn't break the operation
      }
    }
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { tempDir: this.tempDir, error });
      throw error;
    }
  }

  /**
   * Get available output presets
   */
  getAvailablePresets(): Array<keyof typeof PRESETS> {
    return Object.keys(PRESETS) as Array<keyof typeof PRESETS>;
  }

  /**
   * Validate that source files exist
   */
  async validateSourceFiles(sourcePaths: string[]): Promise<void> {
    for (const sourcePath of sourcePaths) {
      try {
        await fs.access(sourcePath);
      } catch (error) {
        throw AppError.notFound(`Source file not found: ${sourcePath}`);
      }
    }
  }

  /**
   * Estimate processing time based on segment count and total duration
   */
  estimateProcessingTime(segmentCount: number, totalDurationSec: number): number {
    // Very rough estimate: 1 second of processing per 10 seconds of video per segment
    const baseTime = (totalDurationSec / 10) * segmentCount;
    // Add overhead for extraction and concatenation (30 seconds per segment)
    const overhead = segmentCount * 30;
    return Math.ceil(baseTime + overhead);
  }
}
