/**
 * Caption Generation Service (Domain Layer)
 *
 * Domain service for generating synchronized captions from transcripts.
 * Handles word-level synchronization and SRT formatting.
 *
 * @module CaptionGenerationService
 */

import { injectable } from 'inversify';
import { logger } from '@/lib/logger';
import { srtUtils } from '@/lib/srt-utils';

export interface CaptionSegment {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface TranscriptSegment {
  id: number;
  start: number; // seconds
  end: number; // seconds
  text: string;
  words?: TranscriptWord[];
}

export interface CaptionGenerationOptions {
  maxWordsPerCaption?: number;
  maxDurationMs?: number;
}

@injectable()
export class CaptionGenerationService {
  /**
   * Generate SRT captions from transcript for a specific clip timeframe
   */
  async generateSRT(
    clipStartMs: number,
    clipEndMs: number,
    transcript: string,
    options: CaptionGenerationOptions = {}
  ): Promise<string> {
    const maxWordsPerCaption = options.maxWordsPerCaption || 4;
    const maxDurationMs = options.maxDurationMs || 2000;

    try {
      // Parse transcript JSON (pass clip timing for plain text handling)
      const transcriptData = this.parseTranscript(transcript, clipStartMs, clipEndMs);

      if (transcriptData.length === 0) {
        logger.warn('No transcript segments found, generating fallback');
        return this.generateFallbackSRT(clipStartMs, clipEndMs);
      }

      // Filter segments within clip timeframe
      const clipSegments = this.filterSegmentsByTimeRange(
        transcriptData,
        clipStartMs,
        clipEndMs
      );

      if (clipSegments.length === 0) {
        logger.warn('No segments found within clip timeframe');
        return this.generateFallbackSRT(clipStartMs, clipEndMs);
      }

      // Normalize timestamps to be relative to clip start
      const normalizedSegments = this.normalizeTimestamps(clipSegments, clipStartMs);

      // Group words into caption chunks
      const captionSegments = this.groupWordsIntoChunks(normalizedSegments, {
        maxWordsPerCaption,
        maxDurationMs,
      });

      // Generate SRT format
      return this.toSRT(captionSegments);
    } catch (error) {
      logger.error('Failed to generate captions', { error });
      return this.generateFallbackSRT(clipStartMs, clipEndMs);
    }
  }

  /**
   * Parse transcript (handles JSON with segments or plain text)
   */
  private parseTranscript(transcript: string, clipStartMs?: number, clipEndMs?: number): TranscriptSegment[] {
    try {
      // Try to parse as JSON first
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
        return [
          {
            id: 0,
            start: 0,
            end: 30,
            text: parsed.text,
          },
        ];
      }

      throw new Error('Invalid transcript format');
    } catch (error) {
      // If JSON parsing fails, treat as plain text
      logger.info('Transcript is plain text, not JSON. Creating simple segments with timing scaled to clip duration.');

      if (!transcript || transcript.trim().length === 0) {
        return [];
      }

      // Split plain text into sentences
      const sentences = this.splitIntoSentences(transcript.trim());

      // If we have clip timing, scale segments to fit the actual clip duration
      if (clipStartMs !== undefined && clipEndMs !== undefined) {
        const clipDurationSec = (clipEndMs - clipStartMs) / 1000;
        const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
        const wordsPerSecond = totalWords / clipDurationSec;

        const segments: TranscriptSegment[] = [];
        let currentTime = 0;

        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          const wordCount = sentence.split(/\s+/).length;
          const durationSec = wordCount / wordsPerSecond;

          segments.push({
            id: i,
            start: currentTime,
            end: currentTime + durationSec,
            text: sentence,
          });

          currentTime += durationSec;
        }

        return segments;
      } else {
        // Fallback: estimate timing without clip duration (assume ~3 words per second)
        const segments: TranscriptSegment[] = [];
        let currentTime = 0;

        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          const wordCount = sentence.split(/\s+/).length;
          const durationSec = Math.max(2, wordCount / 3); // ~3 words per second, minimum 2 seconds

          segments.push({
            id: i,
            start: currentTime,
            end: currentTime + durationSec,
            text: sentence,
          });

          currentTime += durationSec;
        }

        return segments;
      }
    }
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Split by sentence boundaries (., !, ?)
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0);

    // If no sentence boundaries found, split by newlines or return as single sentence
    if (sentences.length === 0 || sentences.length === 1) {
      const lines = text.split(/\n+/).filter(s => s.trim().length > 0);
      return lines.length > 0 ? lines : [text];
    }

    return sentences;
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
      const segmentStart = segment.start;
      const segmentEnd = segment.end;

      return (
        (segmentStart >= startSec && segmentStart < endSec) || // Starts within clip
        (segmentEnd > startSec && segmentEnd <= endSec) || // Ends within clip
        (segmentStart <= startSec && segmentEnd >= endSec) // Spans entire clip
      );
    });
  }

  /**
   * Normalize timestamps to be relative to clip start (0-based)
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
        end: word.end - clipStartSec,
      })),
    }));
  }

  /**
   * Group words into readable caption chunks
   */
  private groupWordsIntoChunks(
    segments: TranscriptSegment[],
    options: { maxWordsPerCaption: number; maxDurationMs: number }
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
            text: text.trim(),
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
            text: chunks[i].join(' ').trim(),
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
  private generateFallbackSRT(clipStartMs: number, clipEndMs: number): string {
    const durationMs = clipEndMs - clipStartMs;
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
