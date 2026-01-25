/**
 * Clip Manipulation Service (Domain Layer)
 *
 * Domain service for clip manipulation operations.
 * Handles splitting, trimming, and updating clip boundaries.
 *
 * @module ClipManipulationService
 */

import { injectable } from 'inversify';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface ClipBoundaries {
  startMs: number;
  endMs: number;
}

@injectable()
export class ClipManipulationService {
  /**
   * Validate clip split point
   * Ensures split point is within clip boundaries
   */
  validateSplitPoint(clipStart: number, clipEnd: number, splitAtMs: number): void {
    if (splitAtMs <= clipStart || splitAtMs >= clipEnd) {
      throw AppError.badRequest(
        `Split point must be between ${clipStart}ms and ${clipEnd}ms`
      );
    }

    // Ensure minimum clip duration of 1 second for both resulting clips
    const minDuration = 1000;
    const firstClipDuration = splitAtMs - clipStart;
    const secondClipDuration = clipEnd - splitAtMs;

    if (firstClipDuration < minDuration) {
      throw AppError.badRequest(
        `First clip would be too short (${firstClipDuration}ms). Minimum duration is ${minDuration}ms`
      );
    }

    if (secondClipDuration < minDuration) {
      throw AppError.badRequest(
        `Second clip would be too short (${secondClipDuration}ms). Minimum duration is ${minDuration}ms`
      );
    }

    logger.info('Split point validated', {
      clipStart,
      clipEnd,
      splitAtMs,
      firstClipDuration,
      secondClipDuration,
    });
  }

  /**
   * Calculate boundaries for split clips
   */
  calculateSplitBoundaries(
    originalStart: number,
    originalEnd: number,
    splitAtMs: number
  ): { firstClip: ClipBoundaries; secondClip: ClipBoundaries } {
    return {
      firstClip: {
        startMs: originalStart,
        endMs: splitAtMs,
      },
      secondClip: {
        startMs: splitAtMs,
        endMs: originalEnd,
      },
    };
  }

  /**
   * Validate trim boundaries
   * Ensures new boundaries are within asset duration and maintain minimum duration
   */
  validateTrimBoundaries(
    newStartMs: number,
    newEndMs: number,
    assetDurationSec: number
  ): void {
    const assetDurationMs = assetDurationSec * 1000;

    if (newStartMs < 0) {
      throw AppError.badRequest('Start time cannot be negative');
    }

    if (newEndMs > assetDurationMs) {
      throw AppError.badRequest(
        `End time (${newEndMs}ms) exceeds asset duration (${assetDurationMs}ms)`
      );
    }

    if (newStartMs >= newEndMs) {
      throw AppError.badRequest('Start time must be before end time');
    }

    // Ensure minimum clip duration of 1 second
    const minDuration = 1000;
    const duration = newEndMs - newStartMs;

    if (duration < minDuration) {
      throw AppError.badRequest(
        `Clip duration (${duration}ms) is below minimum (${minDuration}ms)`
      );
    }

    logger.info('Trim boundaries validated', {
      newStartMs,
      newEndMs,
      duration,
      assetDurationMs,
    });
  }
}
