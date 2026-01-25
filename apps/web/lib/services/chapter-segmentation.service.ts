/**
 * Chapter Segmentation Service
 *
 * @status IMPLEMENTED - Phase 2 Backend Feature
 * @frontend Phase 2 UI component: /components/repurpose/chapter-timeline.tsx
 * @see docs/REPURPOSE_OS_ENHANCEMENT_SUMMARY.md - Phase 2.1
 * @see docs/PHASE_2_UI_IMPLEMENTATION_GUIDE.md
 *
 * Uses AI (Gemini 2.5 Pro) to intelligently break videos into logical chapters based on:
 * - Topic transitions and semantic shifts
 * - Natural conversation breaks
 * - Content structure analysis
 * - Speaker activity patterns
 *
 * Provides better context for clip selection (OpusClip-style).
 *
 * @example
 * ```typescript
 * const chapters = await chapterSegmentationService.segmentIntoChapters({
 *   transcript: videoTranscript,
 *   durationMs: 600000, // 10 minutes
 *   segments: transcriptionSegments
 * });
 * ```
 */

import { logger } from '../logger';

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY?.trim() ?? process.env.GOOGLE_NANO_BANANA_API_KEY?.trim() ?? "";
const HAS_GEMINI_KEY = Boolean(GEMINI_API_KEY);
const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";

export type Chapter = {
  id: string;
  startMs: number;
  endMs: number;
  title: string;
  summary: string;
  keyTopics: string[];
  viralPotential: number; // 0-100
  emotionalTone: string;  // e.g., "inspirational", "educational", "controversial"
  speakerActivity?: string; // e.g., "Q&A", "monologue", "demonstration"
};

export type ChapterSegmentation = {
  chapters: Chapter[];
  overallStructure: string; // e.g., "intro → problem → solution → CTA"
  bestChaptersForClips: string[]; // Chapter IDs with highest viral potential
  contentType: string; // e.g., "tutorial", "interview", "vlog"
};

class ChapterSegmentationService {
  /**
   * Segment a video transcript into logical chapters
   */
  async segmentIntoChapters(params: {
    transcript: string;
    durationMs: number;
    contentHint?: string; // Optional: "educational", "entertainment", etc.
  }): Promise<ChapterSegmentation> {
    const { transcript, durationMs, contentHint } = params;

    if (!HAS_GEMINI_KEY) {
      logger.warn('No Gemini API key - using fallback chapter segmentation');
      return this.getFallbackSegmentation(durationMs);
    }

    try {
      logger.info('Segmenting video into chapters', {
        durationSec: Math.round(durationMs / 1000),
        transcriptLength: transcript.length,
        contentHint
      });

      const prompt = this.buildSegmentationPrompt(transcript, durationMs, contentHint);
      const response = await this.callGeminiAPI(prompt);

      if (!response) {
        return this.getFallbackSegmentation(durationMs);
      }

      logger.info('Chapter segmentation complete', {
        chapterCount: response.chapters.length,
        contentType: response.contentType
      });

      return response;

    } catch (error) {
      logger.error('Failed to segment chapters', error);
      return this.getFallbackSegmentation(durationMs);
    }
  }

  /**
   * Find best chapter for a given timestamp
   */
  findChapterAtTime(chapters: Chapter[], timestampMs: number): Chapter | null {
    return chapters.find(
      ch => ch.startMs <= timestampMs && ch.endMs > timestampMs
    ) || null;
  }

  /**
   * Get chapters with high viral potential
   */
  getHighPotentialChapters(
    chapters: Chapter[],
    threshold: number = 70
  ): Chapter[] {
    return chapters
      .filter(ch => ch.viralPotential >= threshold)
      .sort((a, b) => b.viralPotential - a.viralPotential);
  }

  /**
   * Build AI prompt for chapter segmentation
   */
  private buildSegmentationPrompt(
    transcript: string,
    durationMs: number,
    contentHint?: string
  ): string {
    const durationSec = Math.round(durationMs / 1000);
    const durationMin = Math.round(durationSec / 60);

    return `You are an expert video editor analyzing a ${durationMin}-minute video transcript to identify logical chapter breaks for optimal content repurposing.

**Video Duration:** ${durationMin} minutes (${durationSec} seconds)
${contentHint ? `**Content Type Hint:** ${contentHint}` : ''}

**Transcript:**
${transcript}

**Your Task:**
Analyze this transcript and break it into 3-8 logical chapters. Each chapter should represent a distinct topic, section, or narrative beat.

**Chapter Criteria:**
1. **Natural Breaks:** Topic transitions, speaker changes, tonal shifts
2. **Optimal Length:** 2-10 minutes per chapter (avoid too short or too long)
3. **Viral Potential:** Rate each chapter's potential for short-form content (0-100)
4. **Clear Theme:** Each chapter should have a specific focus
5. **Standalone Value:** Chapters should make sense independently

**Viral Potential Scoring:**
- **90-100:** Contains transformation stories, shocking claims, specific numbers, high emotion
- **70-89:** Strong hooks, actionable insights, clear value propositions
- **50-69:** Decent content but lacks viral mechanics
- **30-49:** Informational but not engaging
- **0-29:** Filler, intros, generic content

**For Indian Creators:**
- Consider cultural context and bilingual content
- Identify moments with universal appeal vs. local relevance
- Note use of Hindi/English code-switching if present

**Return ONLY valid JSON in this exact format:**
{
  "chapters": [
    {
      "id": "ch1",
      "startMs": <milliseconds>,
      "endMs": <milliseconds>,
      "title": "<concise chapter title 3-6 words>",
      "summary": "<2-3 sentence chapter summary>",
      "keyTopics": ["<topic1>", "<topic2>", "<topic3>"],
      "viralPotential": <0-100>,
      "emotionalTone": "<inspirational|educational|controversial|entertaining|motivational|practical>",
      "speakerActivity": "<monologue|Q&A|demonstration|storytelling|debate>"
    }
  ],
  "overallStructure": "<describe video structure e.g., 'intro → problem → solution → examples → CTA'>",
  "bestChaptersForClips": ["<ch_id1>", "<ch_id2>", "<ch_id3>"],
  "contentType": "<tutorial|interview|vlog|review|documentary|presentation|educational|entertainment>"
}

**Important:**
- Chapters must be chronological (no overlaps)
- Use milliseconds for timestamps
- First chapter starts at 0ms
- Last chapter ends at ${durationMs}ms
- Ensure chapter breaks align with natural pauses in speech`;
  }

  /**
   * Call Gemini API for chapter segmentation
   */
  private async callGeminiAPI(prompt: string): Promise<ChapterSegmentation | null> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.4, // Lower temperature for more consistent structure
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('No response from Gemini');
      }

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

      const result = JSON.parse(jsonText) as ChapterSegmentation;

      // Validate structure
      if (!result.chapters || !Array.isArray(result.chapters)) {
        throw new Error('Invalid chapter segmentation response');
      }

      return result;

    } catch (error) {
      logger.error('Gemini API call failed', error);
      return null;
    }
  }

  /**
   * Fallback segmentation when AI is unavailable
   */
  private getFallbackSegmentation(durationMs: number): ChapterSegmentation {
    const chapterCount = Math.min(5, Math.max(3, Math.floor(durationMs / (5 * 60 * 1000))));
    const chapterDuration = durationMs / chapterCount;

    const chapters: Chapter[] = Array.from({ length: chapterCount }, (_, i) => ({
      id: `ch${i + 1}`,
      startMs: Math.round(i * chapterDuration),
      endMs: Math.round((i + 1) * chapterDuration),
      title: `Section ${i + 1}`,
      summary: `Content section ${i + 1}`,
      keyTopics: [],
      viralPotential: 50,
      emotionalTone: 'educational',
      speakerActivity: 'monologue'
    }));

    return {
      chapters,
      overallStructure: 'Sequential content flow',
      bestChaptersForClips: chapters.map(ch => ch.id),
      contentType: 'general'
    };
  }

  /**
   * Cache chapter segmentation to avoid re-processing
   */
  private segmentationCache = new Map<string, {
    segmentation: ChapterSegmentation;
    timestamp: number;
  }>();

  private CACHE_TTL = 60 * 60 * 1000; // 1 hour

  getCachedSegmentation(assetId: string): ChapterSegmentation | null {
    const cached = this.segmentationCache.get(assetId);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL) {
      this.segmentationCache.delete(assetId);
      return null;
    }

    return cached.segmentation;
  }

  cacheSegmentation(assetId: string, segmentation: ChapterSegmentation): void {
    this.segmentationCache.set(assetId, {
      segmentation,
      timestamp: Date.now()
    });
  }
}

/**
 * Singleton instance
 */
export const chapterSegmentationService = new ChapterSegmentationService();
