/**
 * Transcription Service
 *
 * Handles video/audio transcription with word-level timestamps.
 * Abstracts transcription logic from API routes.
 *
 * @module TranscriptionService
 */

import { injectable } from 'inversify';
import { transcribeFile } from '@/lib/transcript';
import { probeDuration } from '@/lib/ffmpeg';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface TranscriptionResult {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    words?: Array<{
      word: string;
      start: number;
      end: number;
    }>;
  }>;
  duration?: number;
}

export interface TranscriptionOptions {
  language?: string;
  model?: string;
}

@injectable()
export class TranscriptionService {
  /**
   * Transcribe a video or audio file
   * @param filePath - Path to the file to transcribe
   * @param options - Transcription options
   * @returns Transcription result with text and segments
   */
  async transcribe(
    filePath: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    try {
      logger.info('Starting transcription', { filePath, options });

      const transcription = await transcribeFile(filePath);

      logger.info('Transcription completed', {
        filePath,
        segmentCount: transcription.segments?.length ?? 0,
        hasWords: transcription.segments?.some((s) => s.words && s.words.length > 0) ?? false,
      });

      return transcription;
    } catch (error) {
      logger.error('Transcription failed', { filePath, error });
      throw AppError.transcription(
        'Failed to transcribe file',
        error instanceof Error ? error.message : undefined
      );
    }
  }

  /**
   * Parse stored transcript (supports both legacy JSON and new plain text formats)
   * @param transcriptData - Raw transcript data from database
   * @returns Parsed transcription result
   */
  parseTranscript(transcriptData: string): TranscriptionResult {
    try {
      const parsed = JSON.parse(transcriptData);

      if (parsed && typeof parsed === 'object' && parsed.text) {
        // Legacy format: JSON with text and segments (from old implementation)
        logger.info('Parsed legacy JSON transcript with segments', {
          segmentCount: parsed.segments?.length ?? 0,
        });
        return parsed;
      } else {
        // Plain text format (current standard)
        logger.info('Using transcript as plain text');
        return { text: transcriptData };
      }
    } catch {
      // Current format: plain text (not JSON)
      logger.info('Using raw transcript as plain text');
      return { text: transcriptData };
    }
  }

  /**
   * Get or create transcription for an asset
   * If transcription exists, parse and return it
   * Otherwise, transcribe the file and return result
   *
   * @param filePath - Path to the file
   * @param existingTranscript - Existing transcript data (if any)
   * @param options - Transcription options
   * @returns Transcription result
   */
  async getOrCreateTranscription(
    filePath: string,
    existingTranscript: string | null,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (existingTranscript) {
      logger.info('Using existing transcript');
      return this.parseTranscript(existingTranscript);
    }

    logger.info('No existing transcript, creating new one');
    return await this.transcribe(filePath, options);
  }

  /**
   * Probe the duration of a media file
   * @param filePath - Path to the file
   * @returns Duration in seconds, or null if unable to probe
   */
  async probeDuration(filePath: string): Promise<number | null> {
    try {
      const duration = await probeDuration(filePath);
      if (duration && Number.isFinite(duration)) {
        return Math.round(duration);
      }
      return null;
    } catch (error) {
      logger.warn('Unable to probe duration', { filePath, error });
      return null;
    }
  }

  /**
   * Serialize transcription result for database storage
   * Only stores the plain text to keep database size manageable.
   * Word-level timestamps are available during transcription but not persisted.
   *
   * @param transcription - Transcription result
   * @returns Plain text transcript for storage
   */
  serializeTranscription(transcription: TranscriptionResult): string {
    // Store only the text to avoid massive JSON blobs in the database
    // The transcript field is meant for plain text, not structured data
    return transcription.text;
  }
}
