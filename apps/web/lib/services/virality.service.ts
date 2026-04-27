/**
 * Virality Analysis Service
 *
 * Analyzes video clips for viral potential using AI.
 * Provides 0-100 scoring with detailed factor breakdown.
 */

import { logger } from '../logger';
import type { TranscriptionSegment } from '../transcript';
import { transcriptEnhancementService } from './transcript-enhancement.service';
import { HAS_OPENROUTER_KEY, openRouterClient } from '@/lib/openrouter-client';

// ── Config ────────────────────────────────────────────────────────────────────
// Use a fast, cheap structured-output model — NOT the large highlights/reasoning
// model which burns thousands of thinking tokens before producing output JSON.
// gemini-3.1-flash-lite-preview: reliable JSON, low cost, fast (~1-2s per clip).
const VIRALITY_MODEL =
  process.env.OPENROUTER_VIRALITY_MODEL ?? 'google/gemini-3.1-flash-lite-preview';

// 2048 tokens is enough for all 5 scores + 3 sentences of reasoning + 3 improvements.
// Well within the ~29 870 per-request credit limit on standard OpenRouter keys.
const VIRALITY_MAX_TOKENS = 2048;

// Truncate very long transcripts so input tokens stay predictable.
const MAX_TRANSCRIPT_CHARS = 1800;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ViralityFactors {
  hookStrength: number;      // 0-100: First 3 seconds grab attention
  emotionalPeak: number;     // 0-100: Intensity of emotional moment
  storyArc: number;          // 0-100: Clear beginning, tension, and payoff
  pacing: number;            // 0-100: No dead air, dynamic flow
  transcriptQuality: number; // 0-100: Clear, engaging language
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

/**
 * Extract a JSON object from a model response that may contain:
 *   - Raw JSON: {"score": ...}
 *   - Markdown-fenced JSON: ```json\n{...}\n```
 *   - Prefixed text then JSON
 */
function extractJson(raw: string): ViralityAnalysis | null {
  // Strip markdown fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  // Try direct parse
  try {
    return JSON.parse(stripped) as ViralityAnalysis;
  } catch {
    // Try to find the outermost {...} block
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1)) as ViralityAnalysis;
      } catch {
        // fall through
      }
    }
    return null;
  }
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

    if (!HAS_OPENROUTER_KEY || !openRouterClient) {
      logger.warn('Virality: OpenRouter not configured — using default scores');
      return defaultAnalysis('OpenRouter API key not set.');
    }

    // Truncate long transcripts
    const safeTranscript =
      transcript.length > MAX_TRANSCRIPT_CHARS
        ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '…'
        : transcript;

    const duration = Math.round(endSec - startSec);
    const userPrompt = [
      `Analyze this ${duration}-second clip for viral potential.`,
      '',
      `Transcript:\n${safeTranscript}`,
      metadata?.title ? `Title: ${metadata.title}` : '',
      metadata?.summary ? `Summary: ${metadata.summary}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await openRouterClient.chat.completions.create({
        model: VIRALITY_MODEL,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: VIRALITY_MAX_TOKENS,
        // Do NOT pass response_format — Gemini models on OpenRouter may ignore it
        // and returning the json_object header actually confuses some versions.
        // We parse the JSON ourselves with fence-stripping + recovery instead.
      });

      const raw = response.choices?.[0]?.message?.content ?? '';
      if (!raw.trim()) {
        logger.warn('Virality: empty response from model');
        return defaultAnalysis('Model returned empty response.');
      }

      const parsed = extractJson(raw);
      if (!parsed) {
        logger.warn('Virality: could not parse JSON from model response', { raw: raw.slice(0, 200) });
        return defaultAnalysis('Could not parse model response as JSON.');
      }

      // Validate and normalise all numeric fields
      const analysis: ViralityAnalysis = {
        score: clamp(parsed.score),
        factors: {
          hookStrength:     clamp(parsed.factors?.hookStrength),
          emotionalPeak:    clamp(parsed.factors?.emotionalPeak),
          storyArc:         clamp(parsed.factors?.storyArc),
          pacing:           clamp(parsed.factors?.pacing),
          transcriptQuality:clamp(parsed.factors?.transcriptQuality),
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

  // ── System prompt (concise — fewer input tokens per clip) ──────────────────

  private getSystemPrompt(): string {
    return `You are a viral short-form video analyst. Score clips for TikTok/Reels/Shorts.

Return ONLY valid JSON, no markdown, no explanation outside the JSON:
{
  "score": <0-100 overall>,
  "factors": {
    "hookStrength": <0-100>,
    "emotionalPeak": <0-100>,
    "storyArc": <0-100>,
    "pacing": <0-100>,
    "transcriptQuality": <0-100>
  },
  "reasoning": "<2 sentences on main strengths/weaknesses>",
  "improvements": ["<actionable fix 1>", "<actionable fix 2>"]
}

Scoring:
- hookStrength: Does the first 3 sec stop the scroll? (90+ = scroll-stopper)
- emotionalPeak: Authentic intensity/vulnerability/humor (90+ = high stakes)
- storyArc: Setup → conflict → payoff structure (90+ = delivers on hook)
- pacing: No dead air, rapid-fire value (90+ = zero lulls)
- transcriptQuality: Punchy, specific, quotable language (90+ = shareable)
- score: Weighted average; add 5-10 if clip has viral mechanics (transformation, curiosity gap, contrarian take).`;
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
