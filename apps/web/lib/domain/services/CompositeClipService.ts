/**
 * Composite Clip Service (Domain Layer)
 *
 * Handles business logic for creating composite clips by stitching
 * multiple video segments together. Validates clip sequences and
 * prepares data for video stitching.
 *
 * @module CompositeClipService
 */

import { injectable } from 'inversify';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';

export interface ClipSegment {
  clipId: string;
  startMs: number;
  endMs: number;
  order: number;
  title?: string;
  transitionType?: 'cut' | 'fade' | 'crossfade';
}

export interface CompositeClipDefinition {
  title: string;
  description?: string;
  segments: ClipSegment[];
  totalDurationMs: number;
  outputFormat?: 'mp4' | 'mov' | 'webm';
  outputQuality?: 'low' | 'medium' | 'high' | 'max';
}

export interface ValidatedCompositeClip {
  definition: CompositeClipDefinition;
  totalDurationSec: number;
  segmentCount: number;
  estimatedFileSizeMB: number;
  warnings: string[];
}

@injectable()
export class CompositeClipService {
  /**
   * Validate and prepare composite clip definition
   */
  validateCompositeClip(
    definition: CompositeClipDefinition,
    availableClips: Clip[]
  ): ValidatedCompositeClip {
    const warnings: string[] = [];

    // Validate segments exist
    if (!definition.segments || definition.segments.length === 0) {
      throw AppError.badRequest('Composite clip must have at least one segment');
    }

    if (definition.segments.length > 50) {
      throw AppError.badRequest('Composite clip cannot have more than 50 segments');
    }

    // Validate all clip IDs exist
    const clipMap = new Map(availableClips.map((c) => [c.id, c]));
    for (const segment of definition.segments) {
      if (!clipMap.has(segment.clipId)) {
        throw AppError.badRequest(`Clip ${segment.clipId} not found`);
      }

      const clip = clipMap.get(segment.clipId)!;
      const clipDuration = clip.endMs - clip.startMs;

      // Validate segment times are within clip bounds
      if (segment.startMs < 0 || segment.endMs > clipDuration) {
        throw AppError.badRequest(
          `Segment times out of bounds for clip ${segment.clipId}`
        );
      }

      if (segment.startMs >= segment.endMs) {
        throw AppError.badRequest(
          `Segment start time must be before end time for clip ${segment.clipId}`
        );
      }
    }

    // Validate segment order is sequential
    const orders = definition.segments.map((s) => s.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw AppError.badRequest('Segment orders must be unique');
    }

    // Calculate total duration
    const totalDurationMs = definition.segments.reduce(
      (sum, segment) => sum + (segment.endMs - segment.startMs),
      0
    );

    const totalDurationSec = Math.floor(totalDurationMs / 1000);

    // Validate duration constraints
    if (totalDurationSec < 1) {
      throw AppError.badRequest('Composite clip must be at least 1 second long');
    }

    if (totalDurationSec > 600) {
      // 10 minutes
      warnings.push(
        'Composite clip exceeds 10 minutes, processing may take longer'
      );
    }

    // Estimate file size (rough approximation)
    const qualityMultiplier = this.getQualityMultiplier(
      definition.outputQuality || 'medium'
    );
    const estimatedFileSizeMB =
      (totalDurationSec * qualityMultiplier * 0.5) / 8; // Very rough estimate

    if (estimatedFileSizeMB > 500) {
      warnings.push(
        `Estimated file size (${Math.round(estimatedFileSizeMB)}MB) is very large`
      );
    }

    logger.info('Composite clip validated', {
      segmentCount: definition.segments.length,
      totalDurationSec,
      estimatedFileSizeMB: Math.round(estimatedFileSizeMB),
      warningsCount: warnings.length,
    });

    return {
      definition,
      totalDurationSec,
      segmentCount: definition.segments.length,
      estimatedFileSizeMB: Math.round(estimatedFileSizeMB),
      warnings,
    };
  }

  /**
   * Create composite clip from multiple clip segments
   */
  createCompositeDefinition(
    clips: Clip[],
    title: string,
    description?: string,
    options?: {
      outputFormat?: 'mp4' | 'mov' | 'webm';
      outputQuality?: 'low' | 'medium' | 'high' | 'max';
      transitionType?: 'cut' | 'fade' | 'crossfade';
    }
  ): CompositeClipDefinition {
    if (!clips || clips.length === 0) {
      throw AppError.badRequest('Must provide at least one clip');
    }

    // Sort clips by start time
    const sortedClips = [...clips].sort((a, b) => a.startMs - b.startMs);

    // Create segments from clips
    const segments: ClipSegment[] = sortedClips.map((clip, index) => ({
      clipId: clip.id,
      startMs: 0, // Use full clip by default
      endMs: clip.endMs - clip.startMs,
      order: index,
      title: clip.title || undefined,
      transitionType: options?.transitionType || 'cut',
    }));

    const totalDurationMs = segments.reduce(
      (sum, segment) => sum + (segment.endMs - segment.startMs),
      0
    );

    return {
      title,
      description,
      segments,
      totalDurationMs,
      outputFormat: options?.outputFormat || 'mp4',
      outputQuality: options?.outputQuality || 'medium',
    };
  }

  /**
   * Optimize segment order for better narrative flow
   */
  optimizeSegmentOrder(
    segments: ClipSegment[],
    clips: Clip[]
  ): ClipSegment[] {
    // For now, keep chronological order
    // In future, could use AI to determine optimal narrative order
    const clipMap = new Map(clips.map((c) => [c.id, c]));

    return [...segments].sort((a, b) => {
      const clipA = clipMap.get(a.clipId);
      const clipB = clipMap.get(b.clipId);

      if (!clipA || !clipB) return 0;

      // Sort by original video timestamp
      return clipA.startMs - clipB.startMs;
    });
  }

  /**
   * Suggest clips that work well together
   */
  suggestComplementaryClips(
    baseClip: Clip,
    availableClips: Clip[],
    maxSuggestions = 5
  ): Clip[] {
    // Filter out the base clip
    const candidates = availableClips.filter((c) => c.id !== baseClip.id);

    // Simple heuristic: clips with high virality scores and similar topics
    const scored = candidates.map((clip) => {
      let score = 0;

      // Prefer high virality
      if (clip.viralityScore) {
        score += clip.viralityScore;
      }

      // Prefer clips close in time (same general topic area)
      const timeDiffMs = Math.abs(clip.startMs - baseClip.startMs);
      const timeDiffMinutes = timeDiffMs / (1000 * 60);
      if (timeDiffMinutes < 5) {
        score += 20;
      } else if (timeDiffMinutes < 15) {
        score += 10;
      }

      return { clip, score };
    });

    // Sort by score and return top suggestions
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
      .map((s) => s.clip);
  }

  /**
   * Get quality multiplier for file size estimation
   */
  private getQualityMultiplier(
    quality: 'low' | 'medium' | 'high' | 'max'
  ): number {
    switch (quality) {
      case 'low':
        return 1;
      case 'medium':
        return 2;
      case 'high':
        return 4;
      case 'max':
        return 8;
      default:
        return 2;
    }
  }

  /**
   * Calculate maximum recommended duration for composite clips
   */
  getMaxRecommendedDuration(): number {
    return 600; // 10 minutes in seconds
  }

  /**
   * Calculate minimum required duration for composite clips
   */
  getMinRequiredDuration(): number {
    return 1; // 1 second
  }
}
