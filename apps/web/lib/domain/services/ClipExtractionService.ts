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
import { analyzeClipQuality } from '@/lib/repurpose/clip-optimization';
import type { ClipQualitySignals } from '@/lib/types';

export interface ExtractedClip {
  title: string;
  hook: string;
  startMs: number;
  endMs: number;
  callToAction?: string;
  qualitySignals?: ClipQualitySignals;
  selectionScore?: number;
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
  sceneCutsMs?: number[];
}

const DEFAULT_MIN_DURATION_MS = 60_000; // 60 seconds
const DEFAULT_MAX_DURATION_MS = 95_000; // 95 seconds
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
      sceneCutsMs = [],
    } = options;

    logger.info('Extracting clips from suggestions', {
      suggestionCount: suggestions.length,
      durationMs,
      targetClipCount,
      minDurationMs,
      maxDurationMs,
      sceneCutsCount: sceneCutsMs.length,
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
          maxDurationMs,
          sceneCutsMs
        );

        return {
          title: suggestion.title,
          hook: suggestion.hook,
          startMs: window.start,
          endMs: window.end,
          callToAction: suggestion.callToAction,
          qualitySignals: analyzeClipQuality({
            startMs: window.start,
            endMs: window.end,
            transcriptionSegments: transcription.segments,
            sceneCutsMs,
            minDurationMs,
            maxDurationMs,
          }),
        };
      })
      .filter((segment) => segment.startMs < segment.endMs)
      .map((segment) => ({
        ...segment,
        selectionScore: segment.qualitySignals?.overallScore ?? 0,
      }));

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
            maxDurationMs,
            sceneCutsMs
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
    maxDurationMs: number,
    sceneCutsMs: number[]
  ): { start: number; end: number } {
    let start = Math.max(0, Math.min(startMs, durationMs));
    let end = Math.max(start + 1, Math.min(endMs, durationMs));

    // Snap to transcript boundaries (word-level if available)
    const transcriptAligned = this.snapToTranscriptBoundaries(
      start,
      end,
      transcription,
      durationMs,
      minDurationMs,
      maxDurationMs
    );

    start = transcriptAligned.start;
    end = transcriptAligned.end;

    // Snap to scene cuts for more natural visual transitions (motion-aware heuristic)
    const sceneAligned = this.snapToSceneCuts(
      start,
      end,
      durationMs,
      minDurationMs,
      maxDurationMs,
      sceneCutsMs
    );

    start = sceneAligned.start;
    end = sceneAligned.end;

    // Enforce max duration
    if (end - start > maxDurationMs) {
      end = Math.min(durationMs, start + maxDurationMs);
    }

    // Handle clips exceeding video duration
    if (end > durationMs) {
      end = durationMs;
      start = Math.max(0, end - maxDurationMs);
    }

    // Enforce min duration (if source permits)
    if (end - start < minDurationMs) {
      end = Math.min(durationMs, start + minDurationMs);
      if (end - start < minDurationMs) {
        // If we hit source boundary, shift window backward to keep minimum duration.
        start = Math.max(0, end - minDurationMs);
      }
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

    const firstSegment = overlappingSegments[0];
    const lastSegment = overlappingSegments[overlappingSegments.length - 1];

    let alignedStart = startMs;
    let alignedEnd = endMs;

    // Start: prefer nearest earlier word start to avoid chopping first spoken word.
    if (firstSegment.words && firstSegment.words.length > 0) {
      const wordStartSec = this.findWordStartNearTarget(firstSegment.words, startSec);
      alignedStart = Math.round(wordStartSec * 1000);
    } else {
      alignedStart = Math.round(firstSegment.start * 1000);
    }

    // End: prefer forward word end to avoid abrupt cutoff at sentence tail.
    if (lastSegment.words && lastSegment.words.length > 0) {
      const wordEndSec = this.findWordEndNearTarget(lastSegment.words, endSec);
      alignedEnd = Math.round(wordEndSec * 1000);
    } else {
      alignedEnd = Math.round(lastSegment.end * 1000);
    }

    alignedStart = Math.max(0, Math.min(alignedStart, durationMs));
    alignedEnd = Math.max(alignedStart + 1, Math.min(alignedEnd, durationMs));

    // Ensure aligned clip still meets duration constraints
    if (alignedEnd - alignedStart < minDurationMs) {
      alignedEnd = Math.min(durationMs, alignedStart + minDurationMs);
      if (alignedEnd - alignedStart < minDurationMs) {
        alignedStart = Math.max(0, alignedEnd - minDurationMs);
      }
    }

    if (alignedEnd - alignedStart > maxDurationMs) {
      alignedEnd = Math.min(durationMs, alignedStart + maxDurationMs);
    }

    return { start: alignedStart, end: alignedEnd };
  }

  private findWordStartNearTarget(
    words: Array<{ start: number; end: number }>,
    targetSec: number
  ): number {
    const maxLookBackSec = 2.0;
    const maxLookAheadSec = 0.8;

    // Prefer word start before target.
    let bestBefore: number | null = null;
    for (const word of words) {
      if (word.start <= targetSec && targetSec - word.start <= maxLookBackSec) {
        if (bestBefore === null || word.start > bestBefore) {
          bestBefore = word.start;
        }
      }
    }
    if (bestBefore !== null) return bestBefore;

    // Fallback to near-after start.
    let bestAfter: number | null = null;
    for (const word of words) {
      if (word.start >= targetSec && word.start - targetSec <= maxLookAheadSec) {
        if (bestAfter === null || word.start < bestAfter) {
          bestAfter = word.start;
        }
      }
    }

    return bestAfter ?? words[0].start;
  }

  private findWordEndNearTarget(
    words: Array<{ start: number; end: number }>,
    targetSec: number
  ): number {
    const maxLookAheadSec = 2.6;
    const maxLookBackSec = 1.2;

    // Prefer word end after target to reduce abrupt cutoff.
    let bestAfter: number | null = null;
    for (const word of words) {
      if (word.end >= targetSec && word.end - targetSec <= maxLookAheadSec) {
        if (bestAfter === null || word.end < bestAfter) {
          bestAfter = word.end;
        }
      }
    }
    if (bestAfter !== null) return bestAfter;

    // Fallback to near-before end.
    let bestBefore: number | null = null;
    for (const word of words) {
      if (word.end <= targetSec && targetSec - word.end <= maxLookBackSec) {
        if (bestBefore === null || word.end > bestBefore) {
          bestBefore = word.end;
        }
      }
    }

    return bestBefore ?? words[words.length - 1].end;
  }

  /**
   * Snap boundaries to nearby scene cuts to make visual edits feel natural.
   */
  private snapToSceneCuts(
    startMs: number,
    endMs: number,
    durationMs: number,
    minDurationMs: number,
    maxDurationMs: number,
    sceneCutsMs: number[]
  ): { start: number; end: number } {
    if (!sceneCutsMs || sceneCutsMs.length === 0) {
      return { start: startMs, end: endMs };
    }

    const cuts = sceneCutsMs
      .filter((cut) => Number.isFinite(cut) && cut > 0 && cut < durationMs)
      .sort((a, b) => a - b);

    if (cuts.length === 0) {
      return { start: startMs, end: endMs };
    }

    let start = startMs;
    let end = endMs;

    const startCut = this.findNearestCutBefore(cuts, startMs, 2200);
    if (startCut !== null) {
      start = startCut;
    }

    const endCutForward = this.findNearestCutAfter(cuts, endMs, 2800);
    if (endCutForward !== null) {
      end = endCutForward;
    } else {
      const endCutBack = this.findNearestCutBefore(cuts, endMs, 1400);
      if (endCutBack !== null) {
        end = endCutBack;
      }
    }

    start = Math.max(0, Math.min(start, durationMs));
    end = Math.max(start + 1, Math.min(end, durationMs));

    if (end - start < minDurationMs) {
      end = Math.min(durationMs, start + minDurationMs);
    }
    if (end - start > maxDurationMs) {
      end = Math.min(durationMs, start + maxDurationMs);
    }

    return { start, end };
  }

  private findNearestCutBefore(cuts: number[], target: number, maxDistanceMs: number): number | null {
    for (let i = cuts.length - 1; i >= 0; i -= 1) {
      const cut = cuts[i];
      if (cut <= target && target - cut <= maxDistanceMs) {
        return cut;
      }
      if (cut < target - maxDistanceMs) {
        return null;
      }
    }
    return null;
  }

  private findNearestCutAfter(cuts: number[], target: number, maxDistanceMs: number): number | null {
    for (let i = 0; i < cuts.length; i += 1) {
      const cut = cuts[i];
      if (cut >= target && cut - target <= maxDistanceMs) {
        return cut;
      }
      if (cut > target + maxDistanceMs) {
        return null;
      }
    }
    return null;
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
    const selected = segments
      .slice()
      .sort((left, right) => {
        const scoreDelta = (right.selectionScore ?? 0) - (left.selectionScore ?? 0);
        if (scoreDelta !== 0) return scoreDelta;
        return left.startMs - right.startMs;
      })
      .reduce<ExtractedClip[]>((accumulator, segment) => {
        const isDuplicate = accumulator.some((existing) =>
          this.isDuplicateWindow(existing, segment, thresholdMs)
        );

        if (!isDuplicate) {
          accumulator.push(segment);
        }

        return accumulator;
      }, []);

    return selected
      .sort((left, right) => left.startMs - right.startMs)
      .slice(0, targetCount);
  }

  private isDuplicateWindow(
    left: ExtractedClip,
    right: ExtractedClip,
    thresholdMs: number
  ): boolean {
    if (Math.abs(left.startMs - right.startMs) < thresholdMs) {
      return true;
    }

    const overlapMs = Math.min(left.endMs, right.endMs) - Math.max(left.startMs, right.startMs);
    if (overlapMs <= 0) {
      return false;
    }

    const smallerDuration = Math.min(left.endMs - left.startMs, right.endMs - right.startMs);
    return overlapMs >= smallerDuration * 0.55;
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
    maxDurationMs: number,
    sceneCutsMs: number[]
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
        maxDurationMs,
        sceneCutsMs
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
        qualitySignals: analyzeClipQuality({
          startMs: window.start,
          endMs: window.end,
          transcriptionSegments: transcription.segments,
          sceneCutsMs,
          minDurationMs,
          maxDurationMs,
        }),
      });
    }

    return fallback.map((segment) => ({
      ...segment,
      selectionScore: segment.qualitySignals?.overallScore ?? 0,
    }));
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

    const overlappingSegments = transcription.segments.filter(
      (seg) => seg.end > startSec && seg.start < endSec
    );

    const timedWords = overlappingSegments
      .flatMap((segment) => segment.words ?? [])
      .filter((word) => word.end > startSec && word.start < endSec)
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((word) => word.word.trim())
      .filter((word) => word.length > 0);

    if (timedWords.length > 0) {
      return timedWords.join(' ');
    }

    const relevantText = overlappingSegments
      .map((seg) => seg.text.trim())
      .filter((text) => text.length > 0)
      .join(' ');

    return relevantText;
  }
}
