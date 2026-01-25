/**
 * AI Analysis Service
 *
 * Handles AI-powered analysis of transcripts for highlight generation.
 * Abstracts AI provider details (Gemini, OpenAI, etc.) from business logic.
 *
 * @module AIAnalysisService
 */

import { injectable } from 'inversify';
import { generateHighlights } from '@/lib/openai';
import type { HighlightSuggestion } from '@clippers/types';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface HighlightGenerationOptions {
  transcript: string;
  durationSec: number;
  targetCount?: number;
  model?: string;
  audience?: string;
  tone?: string;
  brief?: string;
  callToAction?: string;
}

export interface AnalysisResult {
  suggestions: HighlightSuggestion[];
  model: string;
  requestedCount: number;
  receivedCount: number;
}

@injectable()
export class AIAnalysisService {
  /**
   * Generate highlight suggestions from transcript using AI
   * @param options - Generation options
   * @returns Analysis result with highlight suggestions
   */
  async generateHighlights(options: HighlightGenerationOptions): Promise<AnalysisResult> {
    const {
      transcript,
      durationSec,
      targetCount = this.determineOptimalClipCount(durationSec),
      model,
      audience,
      tone,
      brief,
      callToAction,
    } = options;

    try {
      logger.info('Generating AI highlights', {
        transcriptLength: transcript.length,
        durationSec,
        targetCount,
        model: model ?? 'auto',
        hasAudience: !!audience,
        hasTone: !!tone,
        hasBrief: !!brief,
        hasCTA: !!callToAction,
      });

      const suggestions = (await generateHighlights({
        transcript,
        durationSec,
        target: targetCount,
        model,
        audience,
        tone,
        brief,
        callToAction,
      })) as HighlightSuggestion[];

      logger.info('AI highlights generated', {
        model: model ?? 'auto',
        requested: targetCount,
        received: suggestions?.length ?? 0,
      });

      return {
        suggestions: suggestions || [],
        model: model ?? 'auto',
        requestedCount: targetCount,
        receivedCount: suggestions?.length ?? 0,
      };
    } catch (error) {
      logger.error('AI highlight generation failed', { error });
      throw AppError.aiAnalysis(
        'Failed to generate highlights',
        error instanceof Error ? error.message : undefined
      );
    }
  }

  /**
   * Determine optimal clip count based on video duration
   * @param durationSec - Video duration in seconds
   * @returns Recommended number of clips
   */
  determineOptimalClipCount(durationSec: number): number {
    if (durationSec <= 0) {
      return 3;
    }
    if (durationSec < 10 * 60) {
      // < 10 minutes
      return 3;
    }
    if (durationSec <= 30 * 60) {
      // 10-30 minutes
      return 6;
    }
    // > 30 minutes
    return 10;
  }

  /**
   * Get maximum clip count for a given duration
   * @param durationSec - Video duration in seconds
   * @returns Maximum number of clips
   */
  getMaxClipCount(durationSec: number): number {
    return this.determineOptimalClipCount(durationSec);
  }

  /**
   * Validate and clamp target clip count
   * @param targetCount - Desired number of clips
   * @param durationSec - Video duration in seconds
   * @returns Clamped clip count
   */
  validateClipCount(targetCount: number, durationSec: number): number {
    const maxCount = this.getMaxClipCount(durationSec);
    const minCount = Math.min(maxCount, 3);
    return Math.min(maxCount, Math.max(minCount, targetCount));
  }
}
