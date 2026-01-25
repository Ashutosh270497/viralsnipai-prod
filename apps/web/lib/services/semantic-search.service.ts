/**
 * Semantic Search Service
 *
 * @status IMPLEMENTED - Phase 2 Backend Feature
 * @frontend Phase 2 UI component: /components/repurpose/natural-language-search.tsx
 * @api /api/repurpose/search-clips (POST & GET)
 * @see docs/REPURPOSE_OS_ENHANCEMENT_SUMMARY.md - Phase 2.2
 * @see docs/PHASE_2_UI_IMPLEMENTATION_GUIDE.md
 *
 * Enables users to find clips using natural language prompts (ClipAnything feature):
 * - "Find moments where speaker discusses pricing"
 * - "Extract the most emotional parts"
 * - "Show all examples with specific numbers"
 * - "Get controversial or contrarian takes"
 *
 * Uses keyword extraction and relevance scoring (OpusClip-style).
 * Supports 4 search types: topic, emotion, action, example
 *
 * @example
 * ```typescript
 * const intent = semanticSearchService.parsePrompt("Find pricing discussions");
 * const results = semanticSearchService.searchTranscript({
 *   transcript: videoTranscript,
 *   segments: transcriptionSegments,
 *   intent,
 *   durationMs: 600000
 * });
 * ```
 */

import { logger } from '../logger';

export type SearchIntent = {
  keywords: string[];
  topics: string[];
  emotions: string[];
  actions: string[];
  timeReferences: string[];
  searchType: 'topic' | 'emotion' | 'action' | 'example' | 'general';
  includeNumbers: boolean;
  includeQuestions: boolean;
};

export type TranscriptMatch = {
  segment: string;
  startMs: number;
  endMs: number;
  relevanceScore: number; // 0-100
  matchedKeywords: string[];
  matchReason: string;
};

class SemanticSearchService {
  /**
   * Parse user prompt to extract intent
   */
  parsePrompt(userPrompt: string): SearchIntent {
    const lowerPrompt = userPrompt.toLowerCase();

    // Extract emotion keywords
    const emotions = this.extractEmotions(lowerPrompt);

    // Extract action verbs
    const actions = this.extractActions(lowerPrompt);

    // Extract topic keywords
    const keywords = this.extractKeywords(userPrompt);

    // Extract time references
    const timeReferences = this.extractTimeReferences(lowerPrompt);

    // Determine search type
    const searchType = this.determineSearchType(lowerPrompt, emotions, actions);

    // Check for special filters
    const includeNumbers = /numbers?|metrics?|data|statistics|percent|dollar|\d+/.test(lowerPrompt);
    const includeQuestions = /questions?|asks?|Q&A|inquiry/.test(lowerPrompt);

    return {
      keywords,
      topics: keywords,
      emotions,
      actions,
      timeReferences,
      searchType,
      includeNumbers,
      includeQuestions
    };
  }

  /**
   * Search transcript for matches based on intent
   */
  searchTranscript(params: {
    transcript: string;
    segments?: Array<{ text: string; start: number; end: number }>;
    intent: SearchIntent;
    durationMs: number;
  }): TranscriptMatch[] {
    const { transcript, segments, intent, durationMs } = params;

    // If segments available, search segment-wise (more accurate)
    if (segments && segments.length > 0) {
      return this.searchSegments(segments, intent);
    }

    // Otherwise, split transcript into sentences and search
    return this.searchSentences(transcript, intent, durationMs);
  }

  /**
   * Search using segment-level data (preferred)
   */
  private searchSegments(
    segments: Array<{ text: string; start: number; end: number }>,
    intent: SearchIntent
  ): TranscriptMatch[] {
    const matches: TranscriptMatch[] = [];

    for (const segment of segments) {
      const relevance = this.calculateRelevance(segment.text, intent);

      if (relevance.score > 30) { // Threshold for relevance
        matches.push({
          segment: segment.text,
          startMs: segment.start * 1000,
          endMs: segment.end * 1000,
          relevanceScore: relevance.score,
          matchedKeywords: relevance.matchedKeywords,
          matchReason: relevance.reason
        });
      }
    }

    // Sort by relevance score (highest first)
    return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Search using sentence-based approach (fallback)
   */
  private searchSentences(
    transcript: string,
    intent: SearchIntent,
    durationMs: number
  ): TranscriptMatch[] {
    const sentences = this.splitIntoSentences(transcript);
    const matches: TranscriptMatch[] = [];
    const avgSentenceDuration = durationMs / sentences.length;

    sentences.forEach((sentence, index) => {
      const relevance = this.calculateRelevance(sentence, intent);

      if (relevance.score > 30) {
        const startMs = Math.round(index * avgSentenceDuration);
        const endMs = Math.round((index + 1) * avgSentenceDuration);

        matches.push({
          segment: sentence,
          startMs,
          endMs,
          relevanceScore: relevance.score,
          matchedKeywords: relevance.matchedKeywords,
          matchReason: relevance.reason
        });
      }
    });

    return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate relevance score for a text segment
   */
  private calculateRelevance(
    text: string,
    intent: SearchIntent
  ): { score: number; matchedKeywords: string[]; reason: string } {
    const lowerText = text.toLowerCase();
    let score = 0;
    const matchedKeywords: string[] = [];
    const reasons: string[] = [];

    // Check keyword matches
    for (const keyword of intent.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 20;
        matchedKeywords.push(keyword);
      }
    }

    // Check emotion matches
    for (const emotion of intent.emotions) {
      if (lowerText.includes(emotion)) {
        score += 15;
        matchedKeywords.push(emotion);
        reasons.push(`emotional tone: ${emotion}`);
      }
    }

    // Check action matches
    for (const action of intent.actions) {
      if (lowerText.includes(action)) {
        score += 10;
        matchedKeywords.push(action);
        reasons.push(`action: ${action}`);
      }
    }

    // Bonus for numbers if requested
    if (intent.includeNumbers && /\d+/.test(text)) {
      score += 15;
      reasons.push('contains specific numbers/metrics');
    }

    // Bonus for questions if requested
    if (intent.includeQuestions && /\?/.test(text)) {
      score += 10;
      reasons.push('contains question');
    }

    // Bonus for longer, substantive segments
    const wordCount = text.split(/\s+/).length;
    if (wordCount >= 20 && wordCount <= 100) {
      score += 5;
    }

    const reason = reasons.length > 0 ? reasons.join(', ') : 'keyword match';

    return {
      score: Math.min(100, score),
      matchedKeywords: [...new Set(matchedKeywords)],
      reason
    };
  }

  /**
   * Extract emotion keywords from prompt
   */
  private extractEmotions(prompt: string): string[] {
    const emotionWords = [
      'emotional', 'inspiring', 'motivational', 'exciting', 'shocking',
      'surprising', 'funny', 'humorous', 'sad', 'angry', 'controversial',
      'passionate', 'enthusiastic', 'dramatic', 'intense', 'powerful',
      'vulnerable', 'authentic', 'honest', 'raw', 'heartfelt'
    ];

    return emotionWords.filter(emotion => prompt.includes(emotion));
  }

  /**
   * Extract action verbs from prompt
   */
  private extractActions(prompt: string): string[] {
    const actionWords = [
      'discusses', 'explains', 'demonstrates', 'shows', 'teaches',
      'reveals', 'shares', 'tells', 'describes', 'talks about',
      'mentions', 'covers', 'explores', 'analyzes', 'breaks down'
    ];

    return actionWords.filter(action => prompt.includes(action));
  }

  /**
   * Extract main keywords from prompt
   */
  private extractKeywords(prompt: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'find', 'show',
      'extract', 'get', 'where', 'when', 'what', 'how', 'why', 'who',
      'moments', 'parts', 'sections', 'clips', 'segments'
    ]);

    const words = prompt.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    return [...new Set(words)];
  }

  /**
   * Extract time references from prompt
   */
  private extractTimeReferences(prompt: string): string[] {
    const timePatterns = [
      /beginning|start|intro|first/gi,
      /middle|midpoint|halfway/gi,
      /end|ending|conclusion|final|last/gi,
      /minute \d+/gi,
      /\d+ minutes? in/gi
    ];

    const matches: string[] = [];
    timePatterns.forEach(pattern => {
      const found = prompt.match(pattern);
      if (found) matches.push(...found);
    });

    return matches;
  }

  /**
   * Determine the primary search type
   */
  private determineSearchType(
    prompt: string,
    emotions: string[],
    actions: string[]
  ): SearchIntent['searchType'] {
    if (emotions.length > 0) return 'emotion';
    if (actions.length > 0) return 'action';
    if (/examples?|instance|case/.test(prompt)) return 'example';
    if (/topic|about|discusses/.test(prompt)) return 'topic';
    return 'general';
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);
  }

  /**
   * Generate example prompts for UI
   */
  getExamplePrompts(): string[] {
    return [
      "Find moments where speaker discusses pricing strategy",
      "Extract the most emotional and inspiring parts",
      "Show segments with specific numbers or metrics",
      "Find all questions asked in the video",
      "Get controversial or contrarian takes",
      "Find transformation stories with before/after",
      "Show all product demonstrations",
      "Extract motivational quotes or advice",
      "Find moments mentioning money or revenue",
      "Get all actionable tips and tactics"
    ];
  }
}

/**
 * Singleton instance
 */
export const semanticSearchService = new SemanticSearchService();
