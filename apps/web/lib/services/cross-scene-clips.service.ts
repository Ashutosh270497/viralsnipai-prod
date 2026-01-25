/**
 * Cross-Scene Clip Combination Service
 *
 * @status IMPLEMENTED - Phase 2 Backend Feature
 * @frontend Phase 2 UI component: /components/repurpose/composite-clip-builder.tsx
 * @see docs/REPURPOSE_OS_ENHANCEMENT_SUMMARY.md - Phase 2.3
 * @see docs/PHASE_2_UI_IMPLEMENTATION_GUIDE.md
 *
 * Creates composite clips by combining multiple "gold nugget" moments
 * from different parts of a video with smooth transitions.
 *
 * **Composition Strategies:**
 * - Problem-Solution: Combines a problem statement with its solution
 * - Setup-Payoff: Links a setup moment with its punchline/reveal
 * - Multi-Example: Stitches multiple examples into one comprehensive clip
 * - Before-After: Creates transformation narratives
 * - Q&A: Pairs questions with their answers
 * - Sequential: Combines chronological steps/tips
 *
 * @example
 * ```typescript
 * const composite = await crossSceneClipsService.findCompositeClips({
 *   transcript: videoTranscript,
 *   segments: transcriptionSegments,
 *   strategy: 'problem-solution',
 *   maxResults: 5
 * });
 * ```
 */

import { logger } from '../logger';
import type { TranscriptionSegment } from '../transcript';
import { semanticSearchService, type SearchIntent } from './semantic-search.service';
import { viralityService } from './virality.service';

export type ClipSegment = {
  id: string;
  startMs: number;
  endMs: number;
  transcript: string;
  viralityScore?: number;
  keywords?: string[];
  purpose?: 'hook' | 'context' | 'payoff' | 'example' | 'transition' | 'cta';
};

export type Transition = {
  type: 'cut' | 'fade' | 'dissolve' | 'wipe';
  durationMs: number; // Transition duration (0 for cut, 300-500 for fade/dissolve)
  position: number; // Position in final timeline where transition occurs
};

export type CompositeClip = {
  segments: ClipSegment[];
  transitions: Transition[];
  totalDurationMs: number;
  timeline: Array<{
    segmentId: string;
    startInFinal: number; // Position in final composite clip
    endInFinal: number;
    originalStart: number; // Original position in source video
    originalEnd: number;
  }>;
  title: string;
  summary: string;
  viralityScore: number;
  compositionReason: string; // Why these segments were combined
};

export type CompositionStrategy =
  | 'problem-solution'      // Problem statement → Solution
  | 'setup-payoff'          // Setup/context → Punchline/payoff
  | 'before-after'          // Before state → After state
  | 'multi-example'         // Multiple examples/tips stitched together
  | 'story-arc'             // Introduction → Conflict → Resolution
  | 'question-answer'       // Question posed → Answer delivered
  | 'contrast'              // Contrasting viewpoints/approaches
  | 'sequential'            // Sequential steps/process

class CrossSceneClipsService {
  /**
   * Analyze transcript and identify opportunities for cross-scene clips
   */
  async findCompositionOpportunities(params: {
    transcript: string;
    segments: TranscriptionSegment[];
    durationMs: number;
    strategy?: CompositionStrategy;
  }): Promise<CompositeClip[]> {
    const { transcript, segments, durationMs, strategy } = params;

    if (!segments || segments.length < 2) {
      logger.warn('Not enough segments for cross-scene composition');
      return [];
    }

    const opportunities: CompositeClip[] = [];

    // Try different composition strategies
    if (!strategy || strategy === 'problem-solution') {
      const problemSolution = await this.findProblemSolutionPairs(transcript, segments, durationMs);
      opportunities.push(...problemSolution);
    }

    if (!strategy || strategy === 'setup-payoff') {
      const setupPayoff = await this.findSetupPayoffPairs(transcript, segments, durationMs);
      opportunities.push(...setupPayoff);
    }

    if (!strategy || strategy === 'multi-example') {
      const multiExample = await this.findMultiExampleClips(transcript, segments, durationMs);
      opportunities.push(...multiExample);
    }

    if (!strategy || strategy === 'question-answer') {
      const qaClips = await this.findQuestionAnswerPairs(transcript, segments, durationMs);
      opportunities.push(...qaClips);
    }

    // Sort by virality score
    return opportunities.sort((a, b) => b.viralityScore - a.viralityScore);
  }

  /**
   * Find problem-solution pairs across the video
   */
  private async findProblemSolutionPairs(
    transcript: string,
    segments: TranscriptionSegment[],
    durationMs: number
  ): Promise<CompositeClip[]> {
    const composites: CompositeClip[] = [];

    // Search for problem statements
    const problemIntent = semanticSearchService.parsePrompt(
      'find challenges problems issues struggles pain points difficulties'
    );
    const problemMatches = semanticSearchService.searchTranscript({
      transcript,
      segments,
      intent: problemIntent,
      durationMs
    });

    // Search for solutions
    const solutionIntent = semanticSearchService.parsePrompt(
      'find solutions answers fixes tactics strategies methods how to resolve'
    );
    const solutionMatches = semanticSearchService.searchTranscript({
      transcript,
      segments,
      intent: solutionIntent,
      durationMs
    });

    // Pair problems with solutions that occur later in timeline
    for (const problem of problemMatches.slice(0, 3)) {
      for (const solution of solutionMatches) {
        // Solution should come after problem in the video
        if (solution.startMs > problem.endMs + 5000) { // At least 5s gap

          // Check semantic relevance between problem and solution
          const relevance = this.calculateSemanticSimilarity(
            problem.matchedKeywords,
            solution.matchedKeywords
          );

          if (relevance > 0.2) {
            const composite = await this.createComposite({
              segments: [
                {
                  id: `problem-${problem.startMs}`,
                  startMs: problem.startMs,
                  endMs: problem.endMs,
                  transcript: problem.segment,
                  purpose: 'context'
                },
                {
                  id: `solution-${solution.startMs}`,
                  startMs: solution.startMs,
                  endMs: solution.endMs,
                  transcript: solution.segment,
                  purpose: 'payoff'
                }
              ],
              strategy: 'problem-solution',
              title: 'Problem & Solution'
            });

            composites.push(composite);
          }
        }
      }
    }

    return composites.slice(0, 2); // Return top 2 problem-solution clips
  }

  /**
   * Find setup-payoff pairs (e.g., joke setup → punchline)
   */
  private async findSetupPayoffPairs(
    transcript: string,
    segments: TranscriptionSegment[],
    durationMs: number
  ): Promise<CompositeClip[]> {
    const composites: CompositeClip[] = [];

    // Search for emotional peaks (likely payoffs)
    const payoffIntent = semanticSearchService.parsePrompt(
      'find exciting surprising shocking funny dramatic powerful moments'
    );
    const payoffMatches = semanticSearchService.searchTranscript({
      transcript,
      segments,
      intent: payoffIntent,
      durationMs
    });

    // For each payoff, look for setup context 10-60 seconds before
    for (const payoff of payoffMatches.slice(0, 3)) {
      const setupStartMs = Math.max(0, payoff.startMs - 60000); // Look 60s back
      const setupEndMs = Math.max(0, payoff.startMs - 5000); // At least 5s before payoff

      // Find segments in setup window
      const setupSegments = segments.filter(seg =>
        seg.start * 1000 >= setupStartMs &&
        seg.end * 1000 <= setupEndMs
      );

      if (setupSegments.length > 0) {
        // Use the last 10-20 seconds before payoff as setup
        const setupDuration = 15000; // 15 seconds
        const setupStart = Math.max(0, payoff.startMs - setupDuration - 2000);
        const setupEnd = payoff.startMs - 2000;

        const setupText = setupSegments
          .filter(seg => seg.start * 1000 >= setupStart && seg.end * 1000 <= setupEnd)
          .map(seg => seg.text)
          .join(' ');

        if (setupText.length > 20) {
          const composite = await this.createComposite({
            segments: [
              {
                id: `setup-${setupStart}`,
                startMs: setupStart,
                endMs: setupEnd,
                transcript: setupText,
                purpose: 'context'
              },
              {
                id: `payoff-${payoff.startMs}`,
                startMs: payoff.startMs,
                endMs: payoff.endMs,
                transcript: payoff.segment,
                purpose: 'payoff'
              }
            ],
            strategy: 'setup-payoff',
            title: 'Story with Payoff'
          });

          composites.push(composite);
        }
      }
    }

    return composites.slice(0, 2);
  }

  /**
   * Find multiple examples/tips to stitch together
   */
  private async findMultiExampleClips(
    transcript: string,
    segments: TranscriptionSegment[],
    durationMs: number
  ): Promise<CompositeClip[]> {
    const composites: CompositeClip[] = [];

    // Search for examples/tips
    const exampleIntent = semanticSearchService.parsePrompt(
      'find examples tips tactics strategies methods techniques'
    );
    const exampleMatches = semanticSearchService.searchTranscript({
      transcript,
      segments,
      intent: exampleIntent,
      durationMs
    });

    // Group examples by topic similarity
    const exampleGroups = this.groupByTopicSimilarity(exampleMatches, 3);

    for (const group of exampleGroups) {
      if (group.length >= 2) {
        // Create composite from 2-3 examples
        const exampleSegments = group.slice(0, 3).map((match, index) => ({
          id: `example-${index}-${match.startMs}`,
          startMs: match.startMs,
          endMs: match.endMs,
          transcript: match.segment,
          purpose: 'example' as const,
          keywords: match.matchedKeywords
        }));

        const composite = await this.createComposite({
          segments: exampleSegments,
          strategy: 'multi-example',
          title: `${group.length} Powerful Tips`
        });

        composites.push(composite);
      }
    }

    return composites.slice(0, 2);
  }

  /**
   * Find question-answer pairs
   */
  private async findQuestionAnswerPairs(
    transcript: string,
    segments: TranscriptionSegment[],
    durationMs: number
  ): Promise<CompositeClip[]> {
    const composites: CompositeClip[] = [];

    // Find questions
    const questionIntent = semanticSearchService.parsePrompt(
      'find questions asks what how why when where'
    );
    questionIntent.includeQuestions = true;

    const questionMatches = semanticSearchService.searchTranscript({
      transcript,
      segments,
      intent: questionIntent,
      durationMs
    });

    // For each question, look for answer in next 30 seconds
    for (const question of questionMatches.slice(0, 3)) {
      const answerStartMs = question.endMs;
      const answerEndMs = Math.min(durationMs, question.endMs + 30000); // Look 30s ahead

      const answerSegments = segments.filter(seg =>
        seg.start * 1000 >= answerStartMs &&
        seg.end * 1000 <= answerEndMs
      );

      if (answerSegments.length > 0) {
        const answerText = answerSegments.map(seg => seg.text).join(' ');

        const composite = await this.createComposite({
          segments: [
            {
              id: `question-${question.startMs}`,
              startMs: question.startMs,
              endMs: question.endMs,
              transcript: question.segment,
              purpose: 'hook'
            },
            {
              id: `answer-${answerStartMs}`,
              startMs: answerStartMs,
              endMs: answerEndMs,
              transcript: answerText,
              purpose: 'payoff'
            }
          ],
          strategy: 'question-answer',
          title: 'Q&A Moment'
        });

        composites.push(composite);
      }
    }

    return composites.slice(0, 2);
  }

  /**
   * Create composite clip from segments
   */
  private async createComposite(params: {
    segments: ClipSegment[];
    strategy: CompositionStrategy;
    title: string;
  }): Promise<CompositeClip> {
    const { segments, strategy, title } = params;

    // Generate timeline
    let currentPosition = 0;
    const timeline: CompositeClip['timeline'] = [];
    const transitions: Transition[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentDuration = segment.endMs - segment.startMs;

      timeline.push({
        segmentId: segment.id,
        startInFinal: currentPosition,
        endInFinal: currentPosition + segmentDuration,
        originalStart: segment.startMs,
        originalEnd: segment.endMs
      });

      // Add transition between segments (except after last segment)
      if (i < segments.length - 1) {
        const transitionType = this.getTransitionType(strategy, i);
        const transitionDuration = transitionType === 'cut' ? 0 : 400;

        transitions.push({
          type: transitionType,
          durationMs: transitionDuration,
          position: currentPosition + segmentDuration
        });

        currentPosition += segmentDuration + transitionDuration;
      } else {
        currentPosition += segmentDuration;
      }
    }

    const totalDurationMs = currentPosition;

    // Combine transcripts for virality analysis
    const combinedTranscript = segments.map(s => s.transcript).join(' ');

    // Analyze virality of composite
    let viralityScore = 50;
    try {
      const analysis = await viralityService.analyzeClip({
        transcript: combinedTranscript,
        startSec: 0,
        endSec: totalDurationMs / 1000
      });
      viralityScore = analysis.score;
    } catch (error) {
      logger.warn('Failed to analyze composite virality', error);
    }

    // Generate summary
    const summary = this.generateCompositeSummary(segments, strategy);

    return {
      segments,
      transitions,
      totalDurationMs,
      timeline,
      title,
      summary,
      viralityScore,
      compositionReason: this.getCompositionReason(strategy, segments.length)
    };
  }

  /**
   * Get appropriate transition type for strategy
   */
  private getTransitionType(strategy: CompositionStrategy, segmentIndex: number): Transition['type'] {
    switch (strategy) {
      case 'problem-solution':
      case 'before-after':
        return 'dissolve'; // Smooth transition for narrative flow

      case 'setup-payoff':
      case 'question-answer':
        return 'cut'; // Quick cut for comedic/dramatic timing

      case 'multi-example':
      case 'sequential':
        return segmentIndex % 2 === 0 ? 'fade' : 'cut'; // Alternate for visual variety

      default:
        return 'cut';
    }
  }

  /**
   * Generate summary for composite clip
   */
  private generateCompositeSummary(segments: ClipSegment[], strategy: CompositionStrategy): string {
    const segmentCount = segments.length;

    switch (strategy) {
      case 'problem-solution':
        return `Identifies a key problem and delivers the solution. ${segmentCount}-part narrative.`;

      case 'setup-payoff':
        return `Story with powerful payoff. ${segmentCount}-part arc with emotional peak.`;

      case 'multi-example':
        return `${segmentCount} actionable examples stitched together for maximum value.`;

      case 'question-answer':
        return `Engaging Q&A moment with clear question and answer.`;

      case 'before-after':
        return `Transformation story showing before and after states.`;

      default:
        return `Composite clip combining ${segmentCount} key moments.`;
    }
  }

  /**
   * Get reason for composition
   */
  private getCompositionReason(strategy: CompositionStrategy, segmentCount: number): string {
    return `Combined ${segmentCount} segments using ${strategy} strategy to create cohesive narrative`;
  }

  /**
   * Calculate semantic similarity between two keyword sets
   */
  private calculateSemanticSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;

    const set1 = new Set(keywords1.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2.map(k => k.toLowerCase()));

    // Count overlapping keywords
    let overlap = 0;
    for (const keyword of set1) {
      if (set2.has(keyword)) overlap++;
    }

    // Jaccard similarity
    const union = new Set([...set1, ...set2]).size;
    return overlap / union;
  }

  /**
   * Group matches by topic similarity
   */
  private groupByTopicSimilarity(
    matches: Array<{ matchedKeywords: string[]; startMs: number; endMs: number; segment: string }>,
    minGroupSize: number = 2
  ): Array<typeof matches> {
    const groups: Array<typeof matches> = [];
    const used = new Set<number>();

    for (let i = 0; i < matches.length; i++) {
      if (used.has(i)) continue;

      const group = [matches[i]];
      used.add(i);

      // Find similar matches
      for (let j = i + 1; j < matches.length; j++) {
        if (used.has(j)) continue;

        const similarity = this.calculateSemanticSimilarity(
          matches[i].matchedKeywords,
          matches[j].matchedKeywords
        );

        if (similarity > 0.3) {
          group.push(matches[j]);
          used.add(j);
        }
      }

      if (group.length >= minGroupSize) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Export composite clip data for video editor
   */
  exportForEditor(composite: CompositeClip): {
    segments: Array<{
      sourceStart: number;
      sourceEnd: number;
      destStart: number;
      destEnd: number;
    }>;
    transitions: Array<{
      type: string;
      position: number;
      duration: number;
    }>;
    metadata: {
      totalDuration: number;
      title: string;
      summary: string;
    };
  } {
    return {
      segments: composite.timeline.map(t => ({
        sourceStart: t.originalStart,
        sourceEnd: t.originalEnd,
        destStart: t.startInFinal,
        destEnd: t.endInFinal
      })),
      transitions: composite.transitions.map(t => ({
        type: t.type,
        position: t.position,
        duration: t.durationMs
      })),
      metadata: {
        totalDuration: composite.totalDurationMs,
        title: composite.title,
        summary: composite.summary
      }
    };
  }
}

/**
 * Singleton instance
 */
export const crossSceneClipsService = new CrossSceneClipsService();
