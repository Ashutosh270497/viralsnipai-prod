/**
 * Video Extraction Service (Domain Layer)
 *
 * Domain service for extracting video clips from source files.
 * Handles FFmpeg operations for clip extraction.
 *
 * @module VideoExtractionService
 */

import { injectable } from 'inversify';
import { extractClip, PRESETS } from '@/lib/ffmpeg';
import { logger } from '@/lib/logger';
import type { ClipReframePlan } from '@/lib/types';

export interface ClipExtractionInput {
  inputPath: string;
  startMs: number;
  endMs: number;
  outputPath: string;
  preset?: keyof typeof PRESETS;
  reframePlan?: ClipReframePlan | null;
}

@injectable()
export class VideoExtractionService {
  /**
   * Extract a video clip from source file without burning captions
   * Captions will be displayed via browser's native subtitle system
   */
  async extractClip(input: ClipExtractionInput): Promise<void> {
    const { inputPath, startMs, endMs, outputPath, preset, reframePlan } = input;

    logger.info('Extracting video clip', {
      inputPath,
      startMs,
      endMs,
      outputPath,
      duration: endMs - startMs,
      preset,
      reframeMode: reframePlan?.mode ?? 'none',
    });

    try {
      await extractClip({
        inputPath,
        startMs,
        endMs,
        outputPath,
        preset,
        reframePlan,
      });

      logger.info('Video clip extracted successfully', { outputPath });
    } catch (error) {
      logger.error('Failed to extract video clip', { error, inputPath, outputPath });
      throw error;
    }
  }
}
