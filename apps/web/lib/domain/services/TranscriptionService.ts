/**
 * Transcription Service
 *
 * Handles video/audio transcription with word-level timestamps.
 * Abstracts transcription logic from API routes.
 *
 * @module TranscriptionService
 */

import { injectable } from 'inversify';
import { probeDuration } from '@/lib/ffmpeg';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import {
  type CanonicalTranscript,
  type TranscriptPrecision,
  transcribeWithOpenAI,
  hasWordLevelTimestamps,
  hasSegmentTimestamps,
  getTranscriptPrecision,
  logTranscriptPrecision,
} from '@/lib/ai/providers/openai-transcription-provider';

export interface TranscriptionResult {
  text: string;
  segments?: Array<{
    id?: string;
    start: number;
    end: number;
    text: string;
    speaker?: string | null;
    words?: Array<{
      index?: number;
      word: string;
      start: number;
      end: number;
      confidence?: number | null;
    }>;
  }>;
  duration?: number;
  durationSec?: number | null;
  language?: string | null;
  precision?: TranscriptPrecision;
  provider?: 'openai';
  model?: string;
  warnings?: string[];
  createdAt?: string;
}

export interface TranscriptionOptions {
  language?: string;
  model?: string;
  forceRetranscribeOnUntimed?: boolean;
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

      const transcription = await transcribeWithOpenAI(filePath);
      logTranscriptPrecision(transcription);

      logger.info('Transcription completed', {
        filePath,
        segmentCount: transcription.segments?.length ?? 0,
        hasWords: transcription.segments?.some((s) => s.words && s.words.length > 0) ?? false,
        precision: transcription.precision,
        provider: transcription.provider,
        model: transcription.model,
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

      if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
        const canonical = this.normalizeStoredTranscript(parsed);
        logger.info('Parsed JSON transcript', {
          segmentCount: canonical.segments?.length ?? 0,
          precision: canonical.precision,
          provider: canonical.provider,
        });
        return canonical;
      } else {
        logger.info('Using transcript as plain text');
        return this.legacyPlainTextTranscript(transcriptData);
      }
    } catch {
      logger.info('Using raw transcript as plain text');
      return this.legacyPlainTextTranscript(transcriptData);
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
      const parsed = this.parseTranscript(existingTranscript);
      const needsPrecision =
        options?.forceRetranscribeOnUntimed &&
        parsed.precision !== 'word';

      if (needsPrecision) {
        logger.warn('Existing transcript is below V1 word-level precision, re-transcribing source with OpenAI', {
          filePath,
          oldPrecision: parsed.precision ?? 'unknown',
          reason: 'V1 clip generation requires word-level transcript timestamps when forceRetranscribeOnUntimed is enabled.',
        });
        return await this.transcribe(filePath, options);
      }

      logger.info('Using existing transcript');
      return parsed;
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
   * Serialize transcription result for database storage.
   * New V1 transcripts are stored as canonical JSON so word/segment timings can
   * drive deterministic clip boundaries and captions.
   *
   * @param transcription - Transcription result
   * @returns Plain text transcript for storage
   */
  serializeTranscription(transcription: TranscriptionResult): string {
    return JSON.stringify({
      text: transcription.text,
      language: transcription.language ?? null,
      durationSec: transcription.durationSec ?? transcription.duration ?? null,
      segments: transcription.segments ?? [],
      precision: transcription.precision ?? getTranscriptPrecision({ segments: (transcription.segments ?? []) as CanonicalTranscript['segments'] }),
      provider: transcription.provider ?? 'openai',
      model: transcription.model ?? process.env.OPENAI_TRANSCRIBE_MODEL ?? process.env.WHISPER_MODEL ?? 'whisper-1',
      warnings: transcription.warnings ?? [],
      createdAt: transcription.createdAt ?? new Date().toISOString(),
    });
  }

  hasTimedSegments(transcription: TranscriptionResult): boolean {
    return hasSegmentTimestamps({ segments: (transcription.segments ?? []) as CanonicalTranscript['segments'] });
  }

  hasWordLevelTimestamps(transcription: TranscriptionResult): boolean {
    return hasWordLevelTimestamps({ segments: (transcription.segments ?? []) as CanonicalTranscript['segments'] });
  }

  private normalizeStoredTranscript(parsed: Record<string, unknown>): TranscriptionResult {
    const segments = Array.isArray(parsed.segments)
      ? parsed.segments.map((segment, index) => {
          const record = segment as Record<string, unknown>;
          const words = Array.isArray(record.words)
            ? record.words
                .map((word, wordIndex) => {
                  const wordRecord = word as Record<string, unknown>;
                  const text = typeof wordRecord.word === 'string' ? wordRecord.word.trim() : '';
                  const start = Number(wordRecord.start);
                  const end = Number(wordRecord.end);
                  if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
                    return null;
                  }
                  return {
                    index: Number.isFinite(Number(wordRecord.index)) ? Number(wordRecord.index) : wordIndex,
                    word: text,
                    start,
                    end,
                    confidence: typeof wordRecord.confidence === 'number' ? wordRecord.confidence : null,
                  };
                })
                .filter((word): word is {
                  index: number;
                  word: string;
                  start: number;
                  end: number;
                  confidence: number | null;
                } => Boolean(word))
            : undefined;
          return {
            id: typeof record.id === 'string' ? record.id : `seg-${index + 1}`,
            start: Number(record.start),
            end: Number(record.end),
            text: typeof record.text === 'string' ? record.text : '',
            speaker: typeof record.speaker === 'string' ? record.speaker : null,
            ...(words && words.length > 0 ? { words } : {}),
          };
        })
        .filter((segment) => segment.text && Number.isFinite(segment.start) && Number.isFinite(segment.end))
      : [];

    const precision =
      typeof parsed.precision === 'string'
        ? parsed.precision as TranscriptPrecision
        : getTranscriptPrecision({ segments: segments as CanonicalTranscript['segments'] });

    return {
      text: String(parsed.text ?? ''),
      language: typeof parsed.language === 'string' ? parsed.language : null,
      durationSec: typeof parsed.durationSec === 'number' ? parsed.durationSec : null,
      segments,
      precision,
      provider: 'openai',
      model: typeof parsed.model === 'string' ? parsed.model : process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1',
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((item): item is string => typeof item === 'string') : [],
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    };
  }

  private legacyPlainTextTranscript(text: string): TranscriptionResult {
    return {
      text,
      segments: [],
      precision: 'none',
      provider: 'openai',
      model: 'legacy-import',
      warnings: ['Legacy transcript has no timestamp data.'],
      createdAt: new Date().toISOString(),
    };
  }
}
