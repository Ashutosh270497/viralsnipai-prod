/**
 * Virality Analysis Service
 *
 * Analyzes video clips for viral potential using AI.
 * Provides 0-100 scoring with detailed factor breakdown.
 */

import { logger } from '../logger';
import type { TranscriptionSegment } from '../transcript';
import { transcriptEnhancementService } from './transcript-enhancement.service';
import { scoreClipVirality } from '@/lib/ai/providers/openrouter-reasoning-provider';

// ── Config ────────────────────────────────────────────────────────────────────
// Use a fast, cheap structured-output model — NOT the large highlights/reasoning
// model which burns thousands of thinking tokens before producing output JSON.
// gemini-3.1-flash-lite-preview: reliable JSON, low cost, fast (~1-2s per clip).
const VIRALITY_MODEL =
  process.env.OPENROUTER_VIRALITY_MODEL ?? 'google/gemini-3.1-flash-lite-preview';

// Truncate very long transcripts so input tokens stay predictable.
const MAX_TRANSCRIPT_CHARS = 1800;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ViralityFactors {
  hookStrength: number;      // 0-100: First 3 seconds grab attention
  emotionalPeak: number;     // 0-100: Intensity of emotional moment
  storyArc: number;          // 0-100: Clear beginning, tension, and payoff
  pacing: number;            // 0-100: No dead air, dynamic flow
  transcriptQuality: number; // 0-100: Clear, engaging language
  shareability?: number;     // 0-100: Platform-native share/quote potential
}

export interface EnhancedViralityFactors extends ViralityFactors {
  fillerScore: number;
  pauseScore: number;
  energyScore: number;
}

export interface ViralityAnalysis {
  score: number;
  factors: ViralityFactors;
  reasoning: string;
  improvements: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Default scores used when AI analysis fails — keeps clip generation alive. */
function defaultAnalysis(reason?: string): ViralityAnalysis {
  return {
    score: 50,
    factors: {
      hookStrength: 50,
      emotionalPeak: 50,
      storyArc: 50,
      pacing: 50,
      transcriptQuality: 50,
    },
    reasoning: reason ?? 'Virality analysis unavailable — using neutral scores.',
    improvements: [],
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 50));
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ViralityService {
  /**
   * Analyze a video clip for viral potential.
   * Never throws — returns defaultAnalysis() on failure so highlight generation continues.
   */
  async analyzeClip(params: {
    transcript: string;
    startSec: number;
    endSec: number;
    metadata?: { title?: string; summary?: string; tone?: string };
  }): Promise<ViralityAnalysis> {
    const { transcript, startSec, endSec, metadata } = params;

    // Truncate long transcripts
    const safeTranscript =
      transcript.length > MAX_TRANSCRIPT_CHARS
        ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '…'
        : transcript;

    const duration = Math.round(endSec - startSec);
    try {
      const parsed = await scoreClipVirality({
        text: safeTranscript,
        firstThreeSecondsText: safeTranscript.split(/\s+/).slice(0, 14).join(' '),
        durationSec: duration,
        deterministicQualitySignals: metadata,
        model: VIRALITY_MODEL,
      });

      // Validate and normalise all numeric fields
      const analysis: ViralityAnalysis = {
        score: clamp(parsed.score),
        factors: {
          hookStrength:     clamp(parsed.factors?.hookStrength),
          emotionalPeak:    clamp(parsed.factors?.emotionalPeak),
          storyArc:         clamp(parsed.factors?.storyArc),
          pacing:           clamp(parsed.factors?.pacing),
          transcriptQuality:clamp(parsed.factors?.transcriptQuality),
          shareability:     clamp(parsed.factors?.shareability ?? parsed.score),
        },
        reasoning:    typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.filter(Boolean) : [],
      };

      logger.info('Virality analysis complete', { score: analysis.score, duration });
      return analysis;

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to analyze clip virality', error as Error);
      // Return defaults instead of throwing — keeps the whole clip batch alive.
      return defaultAnalysis(`AI analysis failed: ${msg.slice(0, 120)}`);
    }
  }

  // ── Enhanced analysis (with transcript segment data) ──────────────────────

  async analyzeClipEnhanced(params: {
    transcript: string;
    segments: TranscriptionSegment[];
    startMs: number;
    endMs: number;
    metadata?: { title?: string; summary?: string; tone?: string };
  }): Promise<ViralityAnalysis & { enhancementData?: unknown }> {
    const { transcript, segments, startMs, endMs, metadata } = params;

    const baseAnalysis = await this.analyzeClip({
      transcript,
      startSec: startMs / 1000,
      endSec: endMs / 1000,
      metadata,
    });

    if (segments?.length > 0) {
      const durationMs = endMs - startMs;
      const enhancement = transcriptEnhancementService.analyzeTranscript(segments, durationMs);

      const pacingAdj = (enhancement.pacingAnalysis.pacingScore - 50) * 0.3;
      baseAnalysis.factors.pacing = clamp(baseAnalysis.factors.pacing + pacingAdj);

      const fillerPenalty = enhancement.fillerAnalysis.fillerPercentage * 2;
      baseAnalysis.factors.transcriptQuality = clamp(baseAnalysis.factors.transcriptQuality - fillerPenalty);

      if (enhancement.pauseAnalysis.hasExcessiveDeadAir) {
        baseAnalysis.factors.pacing = clamp(baseAnalysis.factors.pacing - 15);
      }

      const avgScore =
        Object.values(baseAnalysis.factors).reduce((s, v) => s + v, 0) /
        Object.values(baseAnalysis.factors).length;
      baseAnalysis.score = Math.round(avgScore);

      if (enhancement.overallQuality.issues.length > 0) {
        baseAnalysis.improvements = [
          ...baseAnalysis.improvements,
          ...enhancement.overallQuality.issues.map((issue) => `Quality: ${issue}`),
        ].slice(0, 5);
      }

      return {
        ...baseAnalysis,
        enhancementData: {
          fillerPercentage: enhancement.fillerAnalysis.fillerPercentage,
          totalFillers: enhancement.fillerAnalysis.totalFillers,
          wordsPerSecond: enhancement.pacingAnalysis.wordsPerSecond,
          energyProfile: enhancement.pacingAnalysis.energyProfile,
          pauseCount: enhancement.pauseAnalysis.totalPauses,
          hasDeadAir: enhancement.pauseAnalysis.hasExcessiveDeadAir,
          overallQualityScore: enhancement.overallQuality.score,
        },
      };
    }

    return baseAnalysis;
  }

  // ── Batch analysis ────────────────────────────────────────────────────────

  async analyzeClips(
    clips: Array<{
      id: string;
      transcript: string;
      startSec: number;
      endSec: number;
      metadata?: { title?: string; summary?: string; tone?: string };
    }>
  ): Promise<Map<string, ViralityAnalysis>> {
    const results = new Map<string, ViralityAnalysis>();

    // Process in batches of 3 to stay under rate limits
    const BATCH_SIZE = 3;
    for (let i = 0; i < clips.length; i += BATCH_SIZE) {
      const batch = clips.slice(i, i + BATCH_SIZE);

      const analyses = await Promise.all(
        batch.map(async (clip) => {
          // analyzeClip never throws — returns defaults on failure
          const analysis = await this.analyzeClip({
            transcript: clip.transcript,
            startSec: clip.startSec,
            endSec: clip.endSec,
            metadata: clip.metadata,
          });
          return { id: clip.id, analysis };
        })
      );

      analyses.forEach(({ id, analysis }) => results.set(id, analysis));
    }

    return results;
  }
}

export const viralityService = new ViralityService();
