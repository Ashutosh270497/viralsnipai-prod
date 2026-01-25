/**
 * Clip Extraction Service
 *
 * Handles extraction, normalization, and deduplication of clips from AI suggestions.
 * Ensures clips meet duration requirements and don't overlap significantly.
 *
 * @module ClipExtractionService
 */

import { injectable } from 'inversify';
import type { HighlightSuggestion } from '@clippers/types';
import type { TranscriptionSegment } from '@/lib/transcript';
import { logger } from '@/lib/logger';

export interface ExtractedClip {
  title: string;
  hook: string;
  startMs: number;
  endMs: number;
  callToAction?: string;
}

export interface TranscriptionData {
  text: string;
  segments?: TranscriptionSegment[];
}

export interface ClipExtractionOptions {
  minDurationMs?: number;
  maxDurationMs?: number;
  minClipCount?: number;
  targetClipCount?: number;
  deduplicationThresholdMs?: number;
}

const DEFAULT_MIN_DURATION_MS = 30_000; // 30 seconds
const DEFAULT_MAX_DURATION_MS = 45_000; // 45 seconds
const DEFAULT_DEDUP_THRESHOLD_MS = 5_000; // 5 seconds

@injectable()
export class ClipExtractionService {
  /**
   * Extract and process clips from AI highlight suggestions
   * @param suggestions - AI-generated highlight suggestions
   * @param durationMs - Total video duration in milliseconds
   * @param transcription - Transcription data with segments
   * @param options - Extraction options
   * @returns Processed clips ready for storage
   */
  extractClips(
    suggestions: HighlightSuggestion[],
    durationMs: number,
    transcription: TranscriptionData,
    options: ClipExtractionOptions = {}
  ): ExtractedClip[] {
    const {
      minDurationMs = DEFAULT_MIN_DURATION_MS,
      maxDurationMs = DEFAULT_MAX_DURATION_MS,
      minClipCount = 3,
      targetClipCount = 6,
      deduplicationThresholdMs = DEFAULT_DEDUP_THRESHOLD_MS,
    } = options;

    logger.info('Extracting clips from suggestions', {
      suggestionCount: suggestions.length,
      durationMs,
      targetClipCount,
    });

    // Step 1: Convert suggestions to time ranges
    const segments = suggestions
      .map((suggestion) => {
        const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
        const startMs = Math.floor(clampPercent(suggestion.startPercent) * 0.01 * durationMs);
        const endMs = Math.floor(clampPercent(suggestion.endPercent) * 0.01 * durationMs);

        // Normalize window to meet duration constraints
        const window = this.normalizeWindow(
          startMs,
          endMs <= startMs ? startMs + minDurationMs : endMs,
          durationMs,
          transcription,
          minDurationMs,
          maxDurationMs
        );

        return {
          title: suggestion.title,
          hook: suggestion.hook,
          startMs: window.start,
          endMs: window.end,
          callToAction: suggestion.callToAction,
        };
      })
      .filter((segment) => segment.startMs < segment.endMs);

    // Step 2: Deduplicate overlapping clips
    const deduped = this.deduplicateClips(segments, deduplicationThresholdMs, targetClipCount);

    // Step 3: Ensure minimum clip count
    const finalSegments =
      deduped.length >= minClipCount
        ? deduped
        : this.ensureMinimumClips(
            deduped,
            segments,
            durationMs,
            transcription,
            targetClipCount,
            minClipCount,
            minDurationMs,
            maxDurationMs
          );

    logger.info('Clips extracted', {
      originalCount: suggestions.length,
      afterNormalization: segments.length,
      afterDeduplication: deduped.length,
      finalCount: finalSegments.length,
    });

    return finalSegments;
  }

  /**
   * Normalize clip time window to meet duration constraints and align with transcript
   * @private
   */
  private normalizeWindow(
    startMs: number,
    endMs: number,
    durationMs: number,
    transcription: TranscriptionData,
    minDurationMs: number,
    maxDurationMs: number
  ): { start: number; end: number } {
    let start = Math.max(0, Math.min(startMs, durationMs));
    let end = Math.max(start + 1, Math.min(endMs, durationMs));

    // Snap to transcript boundaries (word-level if available)
    const aligned = this.snapToTranscriptBoundaries(
      start,
      end,
      transcription,
      durationMs,
      minDurationMs,
      maxDurationMs
    );

    start = aligned.start;
    end = aligned.end;

    // Enforce max duration
    if (end - start > maxDurationMs) {
      end = Math.min(durationMs, start + maxDurationMs);
    }

    // Handle clips exceeding video duration
    if (end > durationMs) {
      end = durationMs;
      start = Math.max(0, end - maxDurationMs);
    }

    // Enforce min duration
    if (end - start < minDurationMs) {
      end = Math.min(durationMs, start + minDurationMs);
    }

    return { start, end };
  }

  /**
   * Snap clip boundaries to natural transcript breaks (word or sentence boundaries)
   * @private
   */
  private snapToTranscriptBoundaries(
    startMs: number,
    endMs: number,
    transcription: TranscriptionData,
    durationMs: number,
    minDurationMs: number,
    maxDurationMs: number
  ): { start: number; end: number } {
    // If no segments, return as-is
    if (!transcription.segments || transcription.segments.length === 0) {
      return { start: startMs, end: endMs };
    }

    const startSec = startMs / 1000;
    const endSec = endMs / 1000;

    // Find segments that overlap with the clip
    const overlappingSegments = transcription.segments.filter(
      (seg) => seg.end > startSec && seg.start < endSec
    );

    if (overlappingSegments.length === 0) {
      return { start: startMs, end: endMs };
    }

    // Snap to word boundaries if available
    const firstSegment = overlappingSegments[0];
    const lastSegment = overlappingSegments[overlappingSegments.length - 1];

    let alignedStart = startMs;
    let alignedEnd = endMs;

    // Try to snap start to word boundary
    if (firstSegment.words && firstSegment.words.length > 0) {
      const closestWord = firstSegment.words.reduce((closest, word) => {
        const wordStartMs = word.start * 1000;
        const closestDiff = Math.abs(closest.start * 1000 - startMs);
        const wordDiff = Math.abs(wordStartMs - startMs);
        return wordDiff < closestDiff ? word : closest;
      });
      alignedStart = closestWord.start * 1000;
    } else {
      alignedStart = firstSegment.start * 1000;
    }

    // Try to snap end to word boundary
    if (lastSegment.words && lastSegment.words.length > 0) {
      const closestWord = lastSegment.words.reduce((closest, word) => {
        const wordEndMs = word.end * 1000;
        const closestDiff = Math.abs(closest.end * 1000 - endMs);
        const wordDiff = Math.abs(wordEndMs - endMs);
        return wordDiff < closestDiff ? word : closest;
      });
      alignedEnd = closestWord.end * 1000;
    } else {
      alignedEnd = lastSegment.end * 1000;
    }

    // Ensure aligned clip still meets duration constraints
    if (alignedEnd - alignedStart < minDurationMs) {
      alignedEnd = Math.min(durationMs, alignedStart + minDurationMs);
    }

    if (alignedEnd - alignedStart > maxDurationMs) {
      alignedEnd = Math.min(durationMs, alignedStart + maxDurationMs);
    }

    return { start: alignedStart, end: alignedEnd };
  }

  /**
   * Remove duplicate clips (clips that start too close to each other)
   * @private
   */
  private deduplicateClips(
    segments: ExtractedClip[],
    thresholdMs: number,
    targetCount: number
  ): ExtractedClip[] {
    return segments
      .sort((a, b) => a.startMs - b.startMs)
      .reduce<ExtractedClip[]>((accumulator, segment) => {
        const isDuplicate = accumulator.some(
          (existing) => Math.abs(existing.startMs - segment.startMs) < thresholdMs
        );
        if (!isDuplicate) {
          accumulator.push(segment);
        }
        return accumulator;
      }, [])
      .slice(0, targetCount);
  }

  /**
   * Ensure minimum number of clips by generating fallback clips if needed
   * @private
   */
  private ensureMinimumClips(
    processedSegments: ExtractedClip[],
    originalSegments: ExtractedClip[],
    durationMs: number,
    transcription: TranscriptionData,
    targetCount: number,
    minCount: number,
    minDurationMs: number,
    maxDurationMs: number
  ): ExtractedClip[] {
    if (processedSegments.length >= minCount) {
      return processedSegments;
    }

    logger.warn('Not enough clips after processing, generating fallbacks', {
      processed: processedSegments.length,
      minCount,
      targetCount,
    });

    // Use original segments if we have them
    if (originalSegments.length >= minCount) {
      return originalSegments.slice(0, targetCount);
    }

    // Generate evenly-spaced fallback clips
    const fallback: ExtractedClip[] = [];
    const slotSize = Math.max(
      minDurationMs,
      Math.min(maxDurationMs, Math.floor(durationMs / targetCount) || minDurationMs)
    );

    for (let index = 0; index < targetCount; index += 1) {
      const idealStart = Math.floor((durationMs / targetCount) * index);
      const clampedStart = Math.max(0, Math.min(idealStart, durationMs - slotSize));
      const rawEnd = Math.min(durationMs, clampedStart + slotSize);

      const window = this.normalizeWindow(
        clampedStart,
        rawEnd,
        durationMs,
        transcription,
        minDurationMs,
        maxDurationMs
      );

      fallback.push({
        title: originalSegments[index]?.title ?? `Highlight ${index + 1}`,
        hook:
          originalSegments[index]?.hook ??
          originalSegments[index - 1]?.hook ??
          originalSegments[0]?.hook ??
          '',
        startMs: window.start,
        endMs: window.end,
        callToAction: originalSegments[index]?.callToAction,
      });
    }

    return fallback;
  }

  /**
   * Get transcript text for a specific time range
   * @param transcription - Full transcription data
   * @param startMs - Start time in milliseconds
   * @param endMs - End time in milliseconds
   * @returns Transcript text for the time range
   */
  getTranscriptSegment(
    transcription: TranscriptionData,
    startMs: number,
    endMs: number
  ): string {
    if (!transcription.segments || transcription.segments.length === 0) {
      return transcription.text;
    }

    const startSec = startMs / 1000;
    const endSec = endMs / 1000;

    const relevantSegments = transcription.segments
      .filter((seg) => seg.end > startSec && seg.start < endSec)
      .map((seg) => seg.text)
      .join(' ');

    return relevantSegments || transcription.text;
  }
}
