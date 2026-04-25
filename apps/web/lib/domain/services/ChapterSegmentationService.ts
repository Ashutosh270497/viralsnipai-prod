/**
 * Chapter Segmentation Service (Domain Layer)
 *
 * AI-powered chapter detection for long-form videos.
 * Analyzes transcripts to detect topic changes, scene transitions,
 * and logical chapter boundaries.
 *
 * @module ChapterSegmentationService
 */

import { injectable } from 'inversify';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import { openRouterClient, OPENROUTER_MODELS } from '@/lib/openrouter-client';

const client = openRouterClient;
const CHAPTER_MODEL = OPENROUTER_MODELS.highlights;

export interface Chapter {
  title: string;
  summary: string;
  startMs: number;
  endMs: number;
  durationSec: number;
  keywords: string[];
  topicCategory?: string;
}

export interface ChapterSegmentationResult {
  chapters: Chapter[];
  totalChapters: number;
  totalDurationSec: number;
  analysisMethod: 'ai' | 'fallback';
}

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

@injectable()
export class ChapterSegmentationService {
  /**
   * Segment video into chapters using AI-powered topic detection
   */
  async segmentIntoChapters(
    transcript: string,
    durationMs: number,
    targetChapterCount?: number
  ): Promise<ChapterSegmentationResult> {
    if (!transcript || transcript.trim().length === 0) {
      throw AppError.badRequest('Transcript cannot be empty');
    }

    if (durationMs <= 0) {
      throw AppError.badRequest('Duration must be positive');
    }

    const durationSec = Math.floor(durationMs / 1000);

    // Determine target chapter count based on duration if not specified
    const targetCount = targetChapterCount || this.determineOptimalChapterCount(durationSec);

    logger.info('Segmenting video into chapters', {
      transcriptLength: transcript.length,
      durationSec,
      targetChapterCount: targetCount,
    });

    if (!client) {
      logger.warn('OpenAI client not configured, using fallback segmentation');
      return this.fallbackSegmentation(transcript, durationMs, targetCount);
    }

    try {
      const chapters = await this.analyzeChaptersWithAI(
        transcript,
        durationMs,
        targetCount
      );

      logger.info('Chapter segmentation complete', {
        chaptersGenerated: chapters.length,
        method: 'ai',
      });

      return {
        chapters,
        totalChapters: chapters.length,
        totalDurationSec: durationSec,
        analysisMethod: 'ai',
      };
    } catch (error) {
      logger.error('AI chapter segmentation failed, using fallback', { error });
      return this.fallbackSegmentation(transcript, durationMs, targetCount);
    }
  }

  /**
   * Use AI to analyze transcript and detect chapter boundaries
   */
  private async analyzeChaptersWithAI(
    transcript: string,
    durationMs: number,
    targetCount: number
  ): Promise<Chapter[]> {
    const systemPrompt = `You are a video chapter analyzer. Your job is to segment video transcripts into logical chapters based on topic changes and natural breaks.

Analyze the transcript and identify ${targetCount} distinct chapters. For each chapter:
1. **Title**: A concise, descriptive title (3-8 words)
2. **Summary**: A brief summary of what's discussed (1-2 sentences)
3. **Keywords**: 3-5 key topics or concepts discussed
4. **Topic Category**: General category (e.g., "Introduction", "Main Content", "Tutorial", "Q&A", "Conclusion")
5. **Start Time**: Estimated start time in seconds (based on position in transcript)
6. **Duration**: Estimated duration in seconds

Look for:
- Topic shifts or transitions
- Natural breaks in conversation
- Introduction of new concepts
- Question/answer segments
- Conclusions or summaries

Return ONLY valid JSON matching this structure:
{
  "chapters": [
    {
      "title": string,
      "summary": string,
      "keywords": string[],
      "topicCategory": string,
      "startTimeSec": number,
      "durationSec": number
    }
  ]
}

Ensure chapters:
- Cover the full video duration (${Math.floor(durationMs / 1000)} seconds)
- Do not overlap
- Are in chronological order
- Have reasonable durations (at least 30 seconds each)`;

    const response = await client!.chat.completions.create({
      model: CHAPTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze this transcript and segment it into ${targetCount} chapters:\n\n${transcript}`,
        },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content) as {
      chapters: Array<{
        title: string;
        summary: string;
        keywords: string[];
        topicCategory: string;
        startTimeSec: number;
        durationSec: number;
      }>;
    };

    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error('Invalid AI response format');
    }

    // Convert to Chapter format with milliseconds
    const chapters: Chapter[] = parsed.chapters.map((ch, idx) => {
      const startMs = Math.floor(ch.startTimeSec * 1000);
      const durationSec = Math.floor(ch.durationSec);
      const endMs = startMs + durationSec * 1000;

      return {
        title: ch.title || `Chapter ${idx + 1}`,
        summary: ch.summary || '',
        keywords: ch.keywords || [],
        topicCategory: ch.topicCategory,
        startMs,
        endMs: Math.min(endMs, durationMs), // Don't exceed video duration
        durationSec,
      };
    });

    // Validate and adjust chapter boundaries
    return this.normalizeChapterBoundaries(chapters, durationMs);
  }

  /**
   * Normalize chapter boundaries to ensure they cover full duration without gaps/overlaps
   */
  private normalizeChapterBoundaries(chapters: Chapter[], totalDurationMs: number): Chapter[] {
    if (chapters.length === 0) {
      return [];
    }

    // Sort by start time
    const sorted = [...chapters].sort((a, b) => a.startMs - b.startMs);

    // Adjust boundaries
    const normalized: Chapter[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const chapter = sorted[i];
      const nextChapter = sorted[i + 1];

      const startMs = i === 0 ? 0 : normalized[i - 1].endMs;
      const endMs = nextChapter ? nextChapter.startMs : totalDurationMs;
      const durationSec = Math.floor((endMs - startMs) / 1000);

      // Only include chapters with reasonable duration (at least 10 seconds)
      if (durationSec >= 10) {
        normalized.push({
          ...chapter,
          startMs,
          endMs,
          durationSec,
        });
      }
    }

    return normalized;
  }

  /**
   * Fallback segmentation when AI is unavailable
   * Simply divides video into equal-length chapters
   */
  private fallbackSegmentation(
    transcript: string,
    durationMs: number,
    targetCount: number
  ): ChapterSegmentationResult {
    const durationSec = Math.floor(durationMs / 1000);
    const chapterDurationMs = Math.floor(durationMs / targetCount);

    const chapters: Chapter[] = [];
    for (let i = 0; i < targetCount; i++) {
      const startMs = i * chapterDurationMs;
      const endMs = i === targetCount - 1 ? durationMs : (i + 1) * chapterDurationMs;
      const durationSec = Math.floor((endMs - startMs) / 1000);

      chapters.push({
        title: `Chapter ${i + 1}`,
        summary: `Segment ${i + 1} of ${targetCount}`,
        keywords: [],
        startMs,
        endMs,
        durationSec,
      });
    }

    logger.info('Fallback segmentation complete', {
      chaptersGenerated: chapters.length,
      method: 'fallback',
    });

    return {
      chapters,
      totalChapters: chapters.length,
      totalDurationSec: durationSec,
      analysisMethod: 'fallback',
    };
  }

  /**
   * Determine optimal chapter count based on video duration
   */
  private determineOptimalChapterCount(durationSec: number): number {
    if (durationSec < 5 * 60) {
      // < 5 minutes - no chapters needed
      return 1;
    }
    if (durationSec < 10 * 60) {
      // 5-10 minutes
      return 3;
    }
    if (durationSec < 20 * 60) {
      // 10-20 minutes
      return 5;
    }
    if (durationSec < 40 * 60) {
      // 20-40 minutes
      return 7;
    }
    // > 40 minutes
    return 10;
  }

  /**
   * Extract a specific chapter segment from transcript
   * Useful for generating clips from chapters
   */
  extractChapterTranscript(
    fullTranscript: string,
    chapter: Chapter,
    totalDurationMs: number
  ): string {
    // Simple approximation: extract proportional text segment
    const startRatio = chapter.startMs / totalDurationMs;
    const endRatio = chapter.endMs / totalDurationMs;

    const transcriptLength = fullTranscript.length;
    const startIndex = Math.floor(startRatio * transcriptLength);
    const endIndex = Math.floor(endRatio * transcriptLength);

    return fullTranscript.slice(startIndex, endIndex).trim();
  }

  /**
   * Validate chapter count for a given duration
   */
  validateChapterCount(targetCount: number, durationSec: number): number {
    const maxCount = Math.floor(durationSec / 30); // At least 30 seconds per chapter
    const minCount = 1;
    return Math.min(maxCount, Math.max(minCount, targetCount));
  }
}
