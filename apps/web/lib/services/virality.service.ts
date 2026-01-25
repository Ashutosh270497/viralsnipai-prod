/**
 * Virality Analysis Service
 *
 * Analyzes video clips for viral potential using AI.
 * Provides 0-100 scoring with detailed factor breakdown.
 */

import OpenAI from 'openai';
import { logger } from '../logger';
import type { TranscriptionSegment } from '../transcript';
import { transcriptEnhancementService } from './transcript-enhancement.service';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ViralityFactors {
  hookStrength: number;      // 0-100: First 3 seconds grab attention
  emotionalPeak: number;     // 0-100: Intensity of emotional moment
  storyArc: number;          // 0-100: Clear beginning, tension, and payoff
  pacing: number;            // 0-100: No dead air, dynamic flow
  transcriptQuality: number; // 0-100: Clear, engaging language
}

export interface EnhancedViralityFactors extends ViralityFactors {
  // Additional metrics from transcript enhancement
  fillerScore: number;       // 0-100: Lower filler = higher score
  pauseScore: number;        // 0-100: Better pause distribution = higher score
  energyScore: number;       // 0-100: Consistent/rising energy = higher score
}

export interface ViralityAnalysis {
  score: number;              // Overall 0-100 score
  factors: ViralityFactors;   // Individual factor scores
  reasoning: string;          // 2-3 sentence explanation
  improvements: string[];     // Specific suggestions
}

export class ViralityService {
  /**
   * Analyze a video clip for viral potential
   */
  async analyzeClip(params: {
    transcript: string;
    startSec: number;
    endSec: number;
    metadata?: {
      title?: string;
      summary?: string;
      tone?: string;
    };
  }): Promise<ViralityAnalysis> {
    const { transcript, startSec, endSec, metadata } = params;

    try {
      const prompt = this.buildAnalysisPrompt(transcript, startSec, endSec, metadata);

      logger.debug('Analyzing clip virality', {
        duration: endSec - startSec,
        transcriptLength: transcript.length
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and cost-effective
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(content) as ViralityAnalysis;

      // Validate and normalize scores
      analysis.score = Math.max(0, Math.min(100, analysis.score));
      analysis.factors.hookStrength = Math.max(0, Math.min(100, analysis.factors.hookStrength));
      analysis.factors.emotionalPeak = Math.max(0, Math.min(100, analysis.factors.emotionalPeak));
      analysis.factors.storyArc = Math.max(0, Math.min(100, analysis.factors.storyArc));
      analysis.factors.pacing = Math.max(0, Math.min(100, analysis.factors.pacing));
      analysis.factors.transcriptQuality = Math.max(0, Math.min(100, analysis.factors.transcriptQuality));

      logger.info('Virality analysis complete', {
        score: analysis.score,
        duration: endSec - startSec
      });

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze clip virality', error);

      // Return fallback analysis
      return this.getFallbackAnalysis();
    }
  }

  /**
   * System prompt for AI virality analysis
   */
  private getSystemPrompt(): string {
    return `You are a viral content expert and social media strategist analyzing short-form video clips for TikTok, Instagram Reels, and YouTube Shorts.

Your task is to analyze video transcripts and provide a virality score based on proven patterns that generate millions of views.

**Scoring Criteria:**

1. **Hook Strength (0-100)**: First 3 seconds must STOP the scroll
   - 90-100: Pattern interrupt, bold contrarian statement, curiosity gap with specific numbers ("$1k to $50k"), shocking claim, authority challenge
   - 70-89: Strong question or provocative statement with some specificity
   - 50-69: Decent opener but lacks punch or specificity
   - 30-49: Weak intro with context-setting or slow buildup
   - 0-29: Generic greeting, slow intro, or no clear hook

2. **Emotional Peak (0-100)**: Intensity and authenticity of emotional moment
   - 90-100: High-stakes vulnerability, dramatic transformation, controversy, or powerful surprise with specific metrics
   - 70-89: Strong emotion (excitement, inspiration, humor) with good energy
   - 50-69: Some emotional variation but lacks intensity or authenticity
   - 30-49: Mostly flat delivery with minimal emotional range
   - 0-29: Monotone, detached, or no emotional connection

3. **Story Arc (0-100)**: Narrative structure and payoff delivery
   - 90-100: Perfect setup → tension/conflict → satisfying resolution with CTA; delivers on hook's promise
   - 70-89: Clear beginning, middle, end with good payoff
   - 50-69: Basic structure but weak tension or incomplete payoff
   - 30-49: Disjointed or information-only without narrative
   - 0-29: No story structure, just rambling information

4. **Pacing (0-100)**: Energy, momentum, and content density
   - 90-100: Rapid-fire insights, no dead air, dynamic energy throughout, specific actionable information
   - 70-89: Good flow with consistent energy and clear points
   - 50-69: Decent pacing with some slower moments
   - 30-49: Uneven with noticeable lulls or rambling
   - 0-29: Slow delivery, long pauses, verbose, loses viewer attention

5. **Transcript Quality (0-100)**: Language clarity, specificity, and shareability
   - 90-100: Concise, punchy, quotable phrases; specific numbers/examples; contrarian insights; highly shareable
   - 70-89: Clear language with good specificity and some memorable phrases
   - 50-69: Understandable but lacks punch or specificity
   - 30-49: Vague advice, filler words, unclear messaging
   - 0-29: Confusing, verbose, generic platitudes

**VIRAL MECHANICS BONUS POINTS:**
Add 5-10 points to overall score if clip demonstrates:
- Transformation story with specific metrics (e.g., "lost 30 lbs in 60 days")
- Challenges authority/conventional wisdom ("Doctors are wrong about...")
- Creates curiosity gap that delivers payoff
- Personal vulnerability with high stakes
- Instant gratification promise that's realistic
- Pattern interrupt in first 2 seconds

**Overall Score Calculation:**
- 90-100: VIRAL POTENTIAL - Has multiple viral mechanics, scroll-stopping hook, emotional resonance, and delivers value
- 75-89: STRONG CONTENT - Good engagement potential, one or two minor improvements needed
- 60-74: ABOVE AVERAGE - Solid content but needs work on hook, emotional peaks, or pacing to stand out
- 40-59: AVERAGE - Decent but missing key viral elements; significant improvements needed
- 20-39: BELOW AVERAGE - Major issues with hook, pacing, or structure; unlikely to perform well
- 0-19: POOR - Complete rework needed; lacks fundamental viral mechanics

**ANALYSIS FRAMEWORK:**
Ask yourself:
1. Would this stop me mid-scroll in the first 3 seconds?
2. Is there a specific, valuable insight or transformation?
3. Would I share this with a friend or save it?
4. Does it deliver on the hook's promise?
5. Is there emotional resonance or controversy?

Return ONLY a JSON object with this exact structure:
{
  "score": <0-100>,
  "factors": {
    "hookStrength": <0-100>,
    "emotionalPeak": <0-100>,
    "storyArc": <0-100>,
    "pacing": <0-100>,
    "transcriptQuality": <0-100>
  },
  "reasoning": "<2-3 sentence explanation citing specific viral mechanics or deficiencies>",
  "improvements": ["<specific, actionable suggestion 1>", "<specific, actionable suggestion 2>", "<optional suggestion 3>"]
}`;
  }

  /**
   * Build user prompt for clip analysis
   */
  private buildAnalysisPrompt(
    transcript: string,
    startSec: number,
    endSec: number,
    metadata?: {
      title?: string;
      summary?: string;
      tone?: string;
    }
  ): string {
    const duration = endSec - startSec;

    return `Analyze this ${duration}-second video clip for viral potential on social media:

**Transcript:**
${transcript}

${metadata?.title ? `**Title:** ${metadata.title}` : ''}
${metadata?.summary ? `**Summary:** ${metadata.summary}` : ''}
${metadata?.tone ? `**Tone:** ${metadata.tone}` : ''}

Provide your virality analysis as JSON.`;
  }

  /**
   * Analyze clip with enhanced transcript data (includes word-level timestamps)
   * This provides more accurate pacing and quality analysis
   */
  async analyzeClipEnhanced(params: {
    transcript: string;
    segments: TranscriptionSegment[];
    startMs: number;
    endMs: number;
    metadata?: {
      title?: string;
      summary?: string;
      tone?: string;
    };
  }): Promise<ViralityAnalysis & { enhancementData?: any }> {
    const { transcript, segments, startMs, endMs, metadata } = params;

    // Get base AI analysis
    const baseAnalysis = await this.analyzeClip({
      transcript,
      startSec: startMs / 1000,
      endSec: endMs / 1000,
      metadata
    });

    // Enhance with transcript analysis if segments available
    if (segments && segments.length > 0) {
      const durationMs = endMs - startMs;
      const enhancement = transcriptEnhancementService.analyzeTranscript(segments, durationMs);

      // Adjust pacing score based on actual metrics
      const pacingAdjustment = (enhancement.pacingAnalysis.pacingScore - 50) * 0.3;
      baseAnalysis.factors.pacing = Math.max(0, Math.min(100, baseAnalysis.factors.pacing + pacingAdjustment));

      // Adjust transcript quality based on filler analysis
      const fillerPenalty = enhancement.fillerAnalysis.fillerPercentage * 2; // -2 points per 1% filler
      baseAnalysis.factors.transcriptQuality = Math.max(0, baseAnalysis.factors.transcriptQuality - fillerPenalty);

      // Penalize for excessive pauses
      if (enhancement.pauseAnalysis.hasExcessiveDeadAir) {
        baseAnalysis.factors.pacing = Math.max(0, baseAnalysis.factors.pacing - 15);
      }

      // Recalculate overall score
      const factorValues = Object.values(baseAnalysis.factors);
      const avgScore = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;
      baseAnalysis.score = Math.round(avgScore);

      // Add enhancement insights to improvements
      if (enhancement.overallQuality.issues.length > 0) {
        baseAnalysis.improvements = [
          ...baseAnalysis.improvements,
          ...enhancement.overallQuality.issues.map(issue => `Quality: ${issue}`)
        ].slice(0, 5); // Keep top 5 suggestions
      }

      logger.info('Enhanced virality analysis complete', {
        baseScore: avgScore,
        finalScore: baseAnalysis.score,
        pacingScore: enhancement.pacingAnalysis.pacingScore,
        fillerPercentage: enhancement.fillerAnalysis.fillerPercentage,
        qualityScore: enhancement.overallQuality.score
      });

      return {
        ...baseAnalysis,
        enhancementData: {
          fillerPercentage: enhancement.fillerAnalysis.fillerPercentage,
          totalFillers: enhancement.fillerAnalysis.totalFillers,
          wordsPerSecond: enhancement.pacingAnalysis.wordsPerSecond,
          energyProfile: enhancement.pacingAnalysis.energyProfile,
          pauseCount: enhancement.pauseAnalysis.totalPauses,
          hasDeadAir: enhancement.pauseAnalysis.hasExcessiveDeadAir,
          overallQualityScore: enhancement.overallQuality.score
        }
      };
    }

    return baseAnalysis;
  }

  /**
   * Fallback analysis when AI fails
   */
  private getFallbackAnalysis(): ViralityAnalysis {
    return {
      score: 50,
      factors: {
        hookStrength: 50,
        emotionalPeak: 50,
        storyArc: 50,
        pacing: 50,
        transcriptQuality: 50
      },
      reasoning: 'Virality analysis unavailable. This is a default score.',
      improvements: [
        'Ensure strong hook in first 3 seconds',
        'Add emotional peaks or surprises',
        'Maintain fast pacing throughout'
      ]
    };
  }

  /**
   * Batch analyze multiple clips
   */
  async analyzeClips(clips: Array<{
    id: string;
    transcript: string;
    startSec: number;
    endSec: number;
    metadata?: {
      title?: string;
      summary?: string;
      tone?: string;
    };
  }>): Promise<Map<string, ViralityAnalysis>> {
    const results = new Map<string, ViralityAnalysis>();

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < clips.length; i += BATCH_SIZE) {
      const batch = clips.slice(i, i + BATCH_SIZE);

      const analyses = await Promise.all(
        batch.map(async (clip) => {
          try {
            const analysis = await this.analyzeClip({
              transcript: clip.transcript,
              startSec: clip.startSec,
              endSec: clip.endSec,
              metadata: clip.metadata
            });
            return { id: clip.id, analysis };
          } catch (error) {
            logger.error(`Failed to analyze clip ${clip.id}`, error);
            return { id: clip.id, analysis: this.getFallbackAnalysis() };
          }
        })
      );

      analyses.forEach(({ id, analysis }) => {
        results.set(id, analysis);
      });
    }

    return results;
  }
}

/**
 * Singleton instance
 */
export const viralityService = new ViralityService();
