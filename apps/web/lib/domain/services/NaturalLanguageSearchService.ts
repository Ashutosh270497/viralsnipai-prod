/**
 * Natural Language Search Service (Domain Layer)
 *
 * AI-powered natural language search for clips.
 * Extracts keywords, emotions, and intent from user queries,
 * then scores clips based on relevance.
 *
 * @module NaturalLanguageSearchService
 */

import { injectable } from 'inversify';
import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
const client = hasApiKey
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SEARCH_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

export interface SearchQuery {
  query: string;
  projectId: string;
}

export interface QueryAnalysis {
  keywords: string[];
  emotions: string[];
  actions: string[];
  intent: string;
  targetDuration?: number; // milliseconds
}

export interface ClipSearchResult {
  clip: Clip;
  relevanceScore: number; // 0-100
  matchReasons: string[];
}

export interface SearchResults {
  analysis: QueryAnalysis;
  results: ClipSearchResult[];
  totalMatches: number;
}

@injectable()
export class NaturalLanguageSearchService {
  /**
   * Analyze natural language query and extract search parameters
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    if (!query || query.trim().length === 0) {
      throw AppError.badRequest('Search query cannot be empty');
    }

    if (!client) {
      logger.warn('OpenAI client not configured, using fallback analysis');
      return this.fallbackAnalysis(query);
    }

    try {
      logger.info('Analyzing search query with AI', { query });

      const systemPrompt = `You are a video clip search analyzer. Extract structured information from user queries about video clips.

Extract:
1. **Keywords**: Important nouns, topics, entities (e.g., "growth", "marketing", "AI")
2. **Emotions**: Sentiment or emotional tone (e.g., "happy", "excited", "angry", "motivational")
3. **Actions**: Verbs or actions mentioned (e.g., "explaining", "demonstrating", "discussing")
4. **Intent**: What the user wants to find (one sentence)
5. **Target Duration**: If mentioned, convert to milliseconds (e.g., "30 seconds" = 30000)

Return ONLY valid JSON matching this structure:
{
  "keywords": string[],
  "emotions": string[],
  "actions": string[],
  "intent": string,
  "targetDuration": number | null
}`;

      const response = await client.chat.completions.create({
        model: SEARCH_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Analyze this search query: "${query}"`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const parsed = JSON.parse(content) as {
        keywords: string[];
        emotions: string[];
        actions: string[];
        intent: string;
        targetDuration: number | null;
      };

      logger.info('Query analysis complete', {
        keywords: parsed.keywords?.length,
        emotions: parsed.emotions?.length,
        actions: parsed.actions?.length,
      });

      return {
        keywords: parsed.keywords || [],
        emotions: parsed.emotions || [],
        actions: parsed.actions || [],
        intent: parsed.intent || query,
        targetDuration: parsed.targetDuration || undefined,
      };
    } catch (error) {
      logger.error('Query analysis failed, using fallback', { error });
      return this.fallbackAnalysis(query);
    }
  }

  /**
   * Score a clip's relevance to the analyzed query
   */
  scoreClipRelevance(
    clip: Clip,
    analysis: QueryAnalysis,
    transcript?: string
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Prepare searchable text from clip
    const clipText = [
      clip.title || '',
      clip.summary || '',
      transcript || '',
    ]
      .join(' ')
      .toLowerCase();

    // Score based on keyword matches
    const keywordMatches = analysis.keywords.filter((keyword) =>
      clipText.includes(keyword.toLowerCase())
    );
    if (keywordMatches.length > 0) {
      const keywordScore = (keywordMatches.length / analysis.keywords.length) * 40;
      score += keywordScore;
      reasons.push(`Matches keywords: ${keywordMatches.join(', ')}`);
    }

    // Score based on emotion/sentiment matches
    const emotionMatches = analysis.emotions.filter((emotion) =>
      clipText.includes(emotion.toLowerCase())
    );
    if (emotionMatches.length > 0) {
      const emotionScore = (emotionMatches.length / analysis.emotions.length) * 20;
      score += emotionScore;
      reasons.push(`Matches emotions: ${emotionMatches.join(', ')}`);
    }

    // Score based on action matches
    const actionMatches = analysis.actions.filter((action) =>
      clipText.includes(action.toLowerCase())
    );
    if (actionMatches.length > 0) {
      const actionScore = (actionMatches.length / analysis.actions.length) * 20;
      score += actionScore;
      reasons.push(`Contains actions: ${actionMatches.join(', ')}`);
    }

    // Bonus for high virality score
    if (clip.viralityScore && clip.viralityScore > 70) {
      score += 10;
      reasons.push(`High virality score (${clip.viralityScore})`);
    }

    // Match target duration if specified
    if (analysis.targetDuration) {
      const clipDuration = clip.endMs - clip.startMs;
      const durationDiff = Math.abs(clipDuration - analysis.targetDuration);
      const durationMatch = Math.max(0, 1 - durationDiff / analysis.targetDuration);
      if (durationMatch > 0.7) {
        score += 10 * durationMatch;
        reasons.push(
          `Duration close to target (${Math.round(clipDuration / 1000)}s)`
        );
      }
    }

    return {
      score: Math.min(100, Math.round(score)),
      reasons,
    };
  }

  /**
   * Search clips using natural language query
   */
  async searchClips(
    query: SearchQuery,
    clips: Clip[],
    transcripts?: Map<string, string>
  ): Promise<SearchResults> {
    // Step 1: Analyze the query
    const analysis = await this.analyzeQuery(query.query);

    // Step 2: Score all clips
    const scoredClips: ClipSearchResult[] = clips
      .map((clip) => {
        const transcript = transcripts?.get(clip.assetId);
        const { score, reasons } = this.scoreClipRelevance(clip, analysis, transcript);

        return {
          clip,
          relevanceScore: score,
          matchReasons: reasons,
        };
      })
      .filter((result) => result.relevanceScore > 0) // Only include matches
      .sort((a, b) => b.relevanceScore - a.relevanceScore); // Sort by relevance

    logger.info('Search complete', {
      query: query.query,
      totalClips: clips.length,
      matches: scoredClips.length,
      topScore: scoredClips[0]?.relevanceScore,
    });

    return {
      analysis,
      results: scoredClips,
      totalMatches: scoredClips.length,
    };
  }

  /**
   * Fallback analysis when AI is unavailable
   */
  private fallbackAnalysis(query: string): QueryAnalysis {
    const words = query.toLowerCase().split(/\s+/);

    // Simple keyword extraction (nouns, longer words)
    const keywords = words
      .filter((w) => w.length > 3)
      .filter((w) => !['that', 'this', 'with', 'from', 'have'].includes(w))
      .slice(0, 5);

    // Detect common emotions
    const emotionWords = ['happy', 'sad', 'excited', 'angry', 'calm', 'energetic'];
    const emotions = emotionWords.filter((emotion) =>
      query.toLowerCase().includes(emotion)
    );

    // Detect common actions
    const actionWords = [
      'explaining',
      'showing',
      'demonstrating',
      'discussing',
      'talking',
    ];
    const actions = actionWords.filter((action) =>
      query.toLowerCase().includes(action)
    );

    return {
      keywords,
      emotions,
      actions,
      intent: query,
    };
  }
}
