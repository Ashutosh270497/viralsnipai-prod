/**
 * Caption Generation Service
 *
 * Generates SRT subtitle files from transcript segments.
 * Creates word-level captions synchronized with audio.
 */

import { logger } from '../logger';
import { srtUtils } from '../srt-utils';

export interface CaptionSegment {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptWord {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface TranscriptSegment {
  id: number;
  start: number; // seconds
  end: number;   // seconds
  text: string;
  words?: TranscriptWord[];
}

export interface CaptionStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  position?: 'top' | 'center' | 'bottom';
  maxWidth?: number;
  outlineColor?: string;
  outlineWidth?: number;
}

export interface Clip {
  id: string;
  startMs: number;
  endMs: number;
}

export interface Asset {
  transcript?: string | null;
}

export class CaptionService {
  /**
   * Generate SRT file from transcript segments
   * Maps transcript words to clip timeframe
   */
  async generateSRT(
    clip: Clip,
    asset: Asset,
    options?: {
      maxWordsPerCaption?: number;
      maxDurationMs?: number;
      style?: CaptionStyle;
    }
  ): Promise<string> {
    if (!asset.transcript) {
      throw new Error('Asset must have a transcript to generate captions');
    }

    try {
      // 1. Parse transcript JSON to get segments
      const transcriptData = this.parseTranscript(asset.transcript);

      // 2. Filter segments that fall within clip timeframe
      const clipSegments = this.filterSegmentsByTimeRange(
        transcriptData,
        clip.startMs,
        clip.endMs
      );

      if (clipSegments.length === 0) {
        logger.warn('No transcript segments found within clip timeframe', {
          clipId: clip.id,
          startMs: clip.startMs,
          endMs: clip.endMs
        });

        // Return minimal caption
        return this.generateFallbackSRT(clip);
      }

      // 3. Normalize timestamps to be relative to clip start (0-based)
      const normalizedSegments = this.normalizeTimestamps(
        clipSegments,
        clip.startMs
      );

      // 4. Group words into readable caption chunks
      const captionSegments = this.groupWordsIntoChunks(
        normalizedSegments,
        {
          maxWordsPerCaption: options?.maxWordsPerCaption || 4,
          maxDurationMs: options?.maxDurationMs || 2000
        }
      );

      // 5. Generate SRT format
      const srtContent = this.toSRT(captionSegments);

      logger.info('Generated SRT captions', {
        clipId: clip.id,
        segmentCount: captionSegments.length
      });

      return srtContent;

    } catch (error) {
      logger.error('Failed to generate captions', { clipId: clip.id, error });
      return this.generateFallbackSRT(clip);
    }
  }

  /**
   * Parse transcript JSON (handles various formats)
   */
  private parseTranscript(transcript: string): TranscriptSegment[] {
    try {
      const parsed = JSON.parse(transcript);

      // Handle array of segments
      if (Array.isArray(parsed)) {
        return parsed as TranscriptSegment[];
      }

      // Handle object with segments property
      if (parsed.segments && Array.isArray(parsed.segments)) {
        return parsed.segments as TranscriptSegment[];
      }

      // Handle single segment
      if (parsed.text) {
        return [{
          id: 0,
          start: 0,
          end: 30,
          text: parsed.text
        }];
      }

      throw new Error('Invalid transcript format');

    } catch (error) {
      logger.error('Failed to parse transcript', error);
      return [];
    }
  }

  /**
   * Filter transcript segments by time range
   */
  private filterSegmentsByTimeRange(
    segments: TranscriptSegment[],
    startMs: number,
    endMs: number
  ): TranscriptSegment[] {
    const startSec = startMs / 1000;
    const endSec = endMs / 1000;

    return segments.filter((segment) => {
      // Include segments that overlap with clip timeframe
      const segmentStart = segment.start;
      const segmentEnd = segment.end;

      return (
        (segmentStart >= startSec && segmentStart < endSec) || // Starts within clip
        (segmentEnd > startSec && segmentEnd <= endSec) ||      // Ends within clip
        (segmentStart <= startSec && segmentEnd >= endSec)      // Spans entire clip
      );
    });
  }

  /**
   * Normalize timestamps to be relative to clip start
   */
  private normalizeTimestamps(
    segments: TranscriptSegment[],
    clipStartMs: number
  ): TranscriptSegment[] {
    const clipStartSec = clipStartMs / 1000;

    return segments.map((segment) => ({
      ...segment,
      start: Math.max(0, segment.start - clipStartSec),
      end: segment.end - clipStartSec,
      words: segment.words?.map((word) => ({
        ...word,
        start: Math.max(0, word.start - clipStartSec),
        end: word.end - clipStartSec
      }))
    }));
  }

  /**
   * Group words into readable caption chunks
   */
  private groupWordsIntoChunks(
    segments: TranscriptSegment[],
    options: {
      maxWordsPerCaption: number;
      maxDurationMs: number;
    }
  ): CaptionSegment[] {
    const captionSegments: CaptionSegment[] = [];
    let currentIndex = 1;

    for (const segment of segments) {
      if (segment.words && segment.words.length > 0) {
        // Use word-level timing if available
        const wordChunks = this.chunkWords(segment.words, options.maxWordsPerCaption);

        for (const chunk of wordChunks) {
          const startSec = chunk[0].start;
          const endSec = chunk[chunk.length - 1].end;
          const text = chunk.map((w) => w.word).join(' ');

          captionSegments.push({
            index: currentIndex++,
            startMs: Math.round(startSec * 1000),
            endMs: Math.round(endSec * 1000),
            text: text.trim()
          });
        }
      } else {
        // Fall back to sentence-level timing
        const words = segment.text.split(' ');
        const chunks = this.chunkArray(words, options.maxWordsPerCaption);
        const segmentDurationMs = (segment.end - segment.start) * 1000;
        const msPerChunk = segmentDurationMs / chunks.length;

        for (let i = 0; i < chunks.length; i++) {
          const startMs = Math.round(segment.start * 1000 + i * msPerChunk);
          const endMs = Math.round(startMs + msPerChunk);

          captionSegments.push({
            index: currentIndex++,
            startMs,
            endMs,
            text: chunks[i].join(' ').trim()
          });
        }
      }
    }

    return captionSegments;
  }

  /**
   * Chunk words array into groups
   */
  private chunkWords(words: TranscriptWord[], chunkSize: number): TranscriptWord[][] {
    const chunks: TranscriptWord[][] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Chunk generic array
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Convert caption segments to SRT format
   */
  private toSRT(segments: CaptionSegment[]): string {
    return segments
      .map((seg) => {
        const start = srtUtils.formatSRTTime(seg.startMs);
        const end = srtUtils.formatSRTTime(seg.endMs);

        return `${seg.index}\n${start} --> ${end}\n${seg.text}\n`;
      })
      .join('\n');
  }

  /**
   * Generate fallback SRT when transcript is unavailable
   */
  private generateFallbackSRT(clip: Clip): string {
    const durationMs = clip.endMs - clip.startMs;
    const midpointMs = Math.round(durationMs / 2);

    return `1
00:00:00,000 --> ${srtUtils.formatSRTTime(midpointMs)}
[Generated content]

2
${srtUtils.formatSRTTime(midpointMs)} --> ${srtUtils.formatSRTTime(durationMs)}
Captions unavailable
`;
  }
}

/**
 * Singleton instance
 */
export const captionService = new CaptionService();
