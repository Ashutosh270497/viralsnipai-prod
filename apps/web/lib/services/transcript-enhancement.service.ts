/**
 * Transcript Enhancement Service
 *
 * Provides advanced transcript processing features:
 * - Filler word detection and removal
 * - Pause detection and analysis
 * - Pacing analysis (words per second)
 * - Energy profile detection
 *
 * Optimized for Indian English content creators
 */

import type { TranscriptionSegment } from "@/lib/transcript";

// Common filler words in English (including Indian English patterns)
const FILLER_WORDS = new Set([
  // Standard English fillers
  'um', 'uh', 'er', 'ah', 'eh', 'hmm', 'mhm',

  // Discourse markers often used as fillers
  'like', 'you know', 'i mean', 'sort of', 'kind of',
  'basically', 'actually', 'literally', 'obviously',
  'so', 'well', 'right', 'okay', 'alright',

  // Indian English specific patterns
  'na', 'yaar', 'hai na', 'no', 'yes yes',
  'acha', 'theek hai', 'haan', 'nahi'
]);

// Extended filler patterns for phrase detection
const FILLER_PATTERNS = [
  /\byou know\b/gi,
  /\bi mean\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
  /\byou see\b/gi,
  /\bhai na\b/gi,
  /\btheek hai\b/gi
];

export type FillerAnalysis = {
  totalFillers: number;
  fillerPercentage: number;
  fillersByType: Record<string, number>;
  cleanedSegments: TranscriptionSegment[];
  removedWords: Array<{
    word: string;
    startMs: number;
    endMs: number;
  }>;
};

export type PauseAnalysis = {
  totalPauses: number;
  longPauses: Array<{
    startMs: number;
    endMs: number;
    durationMs: number;
    type: 'short' | 'medium' | 'long' | 'excessive';
  }>;
  averagePauseDuration: number;
  hasExcessiveDeadAir: boolean;
};

export type PacingAnalysis = {
  wordsPerSecond: number;
  energyProfile: 'consistent' | 'rising' | 'falling' | 'varied';
  hasGoodPacing: boolean;
  pacingScore: number; // 0-100
  segmentPacing: Array<{
    startMs: number;
    endMs: number;
    wps: number;
    energy: 'low' | 'medium' | 'high';
  }>;
};

export type TranscriptEnhancement = {
  fillerAnalysis: FillerAnalysis;
  pauseAnalysis: PauseAnalysis;
  pacingAnalysis: PacingAnalysis;
  overallQuality: {
    score: number; // 0-100
    issues: string[];
    strengths: string[];
  };
};

class TranscriptEnhancementService {
  /**
   * Analyze and remove filler words from transcript segments
   */
  detectFillers(segments: TranscriptionSegment[]): FillerAnalysis {
    if (!segments || segments.length === 0) {
      return this.getEmptyFillerAnalysis();
    }

    let totalWords = 0;
    let totalFillers = 0;
    const fillersByType: Record<string, number> = {};
    const removedWords: Array<{ word: string; startMs: number; endMs: number }> = [];

    const cleanedSegments: TranscriptionSegment[] = segments.map(segment => {
      if (!segment.words || segment.words.length === 0) {
        return segment;
      }

      const cleanedWords = segment.words.filter(word => {
        totalWords++;
        const normalized = word.word.toLowerCase().trim().replace(/[.,!?;]/g, '');

        if (FILLER_WORDS.has(normalized)) {
          totalFillers++;
          fillersByType[normalized] = (fillersByType[normalized] || 0) + 1;
          removedWords.push({
            word: word.word,
            startMs: word.start * 1000,
            endMs: word.end * 1000
          });
          return false;
        }

        return true;
      });

      // Reconstruct segment text from cleaned words
      const cleanedText = cleanedWords.map(w => w.word).join(' ');

      return {
        ...segment,
        words: cleanedWords,
        text: cleanedText
      };
    });

    const fillerPercentage = totalWords > 0 ? (totalFillers / totalWords) * 100 : 0;

    return {
      totalFillers,
      fillerPercentage,
      fillersByType,
      cleanedSegments,
      removedWords
    };
  }

  /**
   * Detect pauses between words and segments
   */
  detectPauses(
    segments: TranscriptionSegment[],
    thresholds = {
      short: 500,      // 0.5s - natural pause
      medium: 1500,    // 1.5s - noticeable pause
      long: 2500,      // 2.5s - awkward silence
      excessive: 4000  // 4s+ - dead air
    }
  ): PauseAnalysis {
    if (!segments || segments.length === 0) {
      return this.getEmptyPauseAnalysis();
    }

    const longPauses: PauseAnalysis['longPauses'] = [];
    let totalPauseDuration = 0;
    let pauseCount = 0;

    // Detect pauses between segments
    for (let i = 0; i < segments.length - 1; i++) {
      const currentEnd = segments[i].end * 1000;
      const nextStart = segments[i + 1].start * 1000;
      const pauseDuration = nextStart - currentEnd;

      if (pauseDuration > thresholds.short) {
        pauseCount++;
        totalPauseDuration += pauseDuration;

        let type: 'short' | 'medium' | 'long' | 'excessive';
        if (pauseDuration > thresholds.excessive) {
          type = 'excessive';
        } else if (pauseDuration > thresholds.long) {
          type = 'long';
        } else if (pauseDuration > thresholds.medium) {
          type = 'medium';
        } else {
          type = 'short';
        }

        longPauses.push({
          startMs: currentEnd,
          endMs: nextStart,
          durationMs: pauseDuration,
          type
        });
      }
    }

    // Also check pauses within segments (between words)
    for (const segment of segments) {
      if (!segment.words || segment.words.length < 2) continue;

      for (let i = 0; i < segment.words.length - 1; i++) {
        const currentEnd = segment.words[i].end * 1000;
        const nextStart = segment.words[i + 1].start * 1000;
        const pauseDuration = nextStart - currentEnd;

        if (pauseDuration > thresholds.medium) {
          pauseCount++;
          totalPauseDuration += pauseDuration;

          let type: 'short' | 'medium' | 'long' | 'excessive';
          if (pauseDuration > thresholds.excessive) {
            type = 'excessive';
          } else if (pauseDuration > thresholds.long) {
            type = 'long';
          } else {
            type = 'medium';
          }

          longPauses.push({
            startMs: currentEnd,
            endMs: nextStart,
            durationMs: pauseDuration,
            type
          });
        }
      }
    }

    const averagePauseDuration = pauseCount > 0 ? totalPauseDuration / pauseCount : 0;
    const hasExcessiveDeadAir = longPauses.some(p => p.type === 'excessive');

    return {
      totalPauses: pauseCount,
      longPauses: longPauses.sort((a, b) => a.startMs - b.startMs),
      averagePauseDuration,
      hasExcessiveDeadAir
    };
  }

  /**
   * Analyze pacing (words per second) and energy profile
   */
  analyzePacing(
    segments: TranscriptionSegment[],
    durationMs: number
  ): PacingAnalysis {
    if (!segments || segments.length === 0 || durationMs <= 0) {
      return this.getEmptyPacingAnalysis();
    }

    // Count total words
    const totalWords = segments.reduce((sum, seg) => {
      return sum + (seg.words?.length || seg.text.split(/\s+/).length);
    }, 0);

    const durationSec = durationMs / 1000;
    const wordsPerSecond = totalWords / durationSec;

    // Analyze pacing per segment (for energy profile)
    const segmentPacing = segments.map(segment => {
      const segDuration = (segment.end - segment.start);
      const wordCount = segment.words?.length || segment.text.split(/\s+/).length;
      const wps = segDuration > 0 ? wordCount / segDuration : 0;

      let energy: 'low' | 'medium' | 'high';
      if (wps < 1.5) energy = 'low';
      else if (wps < 2.5) energy = 'medium';
      else energy = 'high';

      return {
        startMs: segment.start * 1000,
        endMs: segment.end * 1000,
        wps,
        energy
      };
    });

    // Determine energy profile trend
    const energyProfile = this.determineEnergyProfile(segmentPacing);

    // Calculate pacing score (optimal is 2-3 WPS)
    let pacingScore: number;
    if (wordsPerSecond >= 2.0 && wordsPerSecond <= 3.5) {
      pacingScore = 100; // Optimal
    } else if (wordsPerSecond >= 1.5 && wordsPerSecond <= 4.0) {
      pacingScore = 80; // Good
    } else if (wordsPerSecond >= 1.0 && wordsPerSecond <= 4.5) {
      pacingScore = 60; // Acceptable
    } else if (wordsPerSecond < 1.0) {
      pacingScore = Math.max(0, 40 - (1.0 - wordsPerSecond) * 50); // Too slow
    } else {
      pacingScore = Math.max(0, 40 - (wordsPerSecond - 4.5) * 20); // Too fast
    }

    const hasGoodPacing = pacingScore >= 70;

    return {
      wordsPerSecond,
      energyProfile,
      hasGoodPacing,
      pacingScore,
      segmentPacing
    };
  }

  /**
   * Full transcript enhancement analysis
   */
  analyzeTranscript(
    segments: TranscriptionSegment[],
    durationMs: number
  ): TranscriptEnhancement {
    const fillerAnalysis = this.detectFillers(segments);
    const pauseAnalysis = this.detectPauses(segments);
    const pacingAnalysis = this.analyzePacing(segments, durationMs);

    // Calculate overall quality score
    let qualityScore = 100;
    const issues: string[] = [];
    const strengths: string[] = [];

    // Penalize for excessive fillers
    if (fillerAnalysis.fillerPercentage > 10) {
      qualityScore -= 20;
      issues.push(`High filler word usage (${fillerAnalysis.fillerPercentage.toFixed(1)}%)`);
    } else if (fillerAnalysis.fillerPercentage < 3) {
      strengths.push('Clean, professional speech');
    }

    // Penalize for excessive pauses
    if (pauseAnalysis.hasExcessiveDeadAir) {
      qualityScore -= 25;
      issues.push('Contains awkward silences or dead air');
    }
    if (pauseAnalysis.longPauses.filter(p => p.type === 'long' || p.type === 'excessive').length > 3) {
      qualityScore -= 10;
      issues.push('Multiple long pauses affect flow');
    } else if (pauseAnalysis.totalPauses === 0) {
      strengths.push('Smooth, continuous delivery');
    }

    // Factor in pacing score
    const pacingContribution = pacingAnalysis.pacingScore * 0.3;
    qualityScore = qualityScore * 0.7 + pacingContribution;

    if (pacingAnalysis.hasGoodPacing) {
      strengths.push(`Excellent pacing (${pacingAnalysis.wordsPerSecond.toFixed(1)} WPS)`);
    } else if (pacingAnalysis.wordsPerSecond < 1.5) {
      issues.push('Slow pacing may lose viewer attention');
    } else if (pacingAnalysis.wordsPerSecond > 4.0) {
      issues.push('Very fast pacing may be hard to follow');
    }

    // Energy profile assessment
    if (pacingAnalysis.energyProfile === 'rising') {
      strengths.push('Building energy throughout');
    } else if (pacingAnalysis.energyProfile === 'falling') {
      issues.push('Energy drops toward the end');
    } else if (pacingAnalysis.energyProfile === 'consistent') {
      strengths.push('Consistent energy delivery');
    }

    return {
      fillerAnalysis,
      pauseAnalysis,
      pacingAnalysis,
      overallQuality: {
        score: Math.max(0, Math.min(100, Math.round(qualityScore))),
        issues,
        strengths
      }
    };
  }

  /**
   * Get cleaned transcript segments (with fillers removed)
   */
  getCleanedSegments(segments: TranscriptionSegment[]): TranscriptionSegment[] {
    const analysis = this.detectFillers(segments);
    return analysis.cleanedSegments;
  }

  /**
   * Check if a clip contains excessive issues
   */
  hasQualityIssues(
    segments: TranscriptionSegment[],
    durationMs: number,
    thresholds = {
      maxFillerPercentage: 12,
      maxLongPauses: 3,
      minPacingScore: 50
    }
  ): { hasIssues: boolean; reasons: string[] } {
    const analysis = this.analyzeTranscript(segments, durationMs);
    const reasons: string[] = [];

    if (analysis.fillerAnalysis.fillerPercentage > thresholds.maxFillerPercentage) {
      reasons.push(`Too many filler words (${analysis.fillerAnalysis.fillerPercentage.toFixed(1)}%)`);
    }

    const criticalPauses = analysis.pauseAnalysis.longPauses.filter(
      p => p.type === 'long' || p.type === 'excessive'
    ).length;

    if (criticalPauses > thresholds.maxLongPauses) {
      reasons.push(`${criticalPauses} awkward pauses detected`);
    }

    if (analysis.pacingAnalysis.pacingScore < thresholds.minPacingScore) {
      reasons.push('Poor pacing for short-form content');
    }

    return {
      hasIssues: reasons.length > 0,
      reasons
    };
  }

  // Helper methods

  private determineEnergyProfile(
    segmentPacing: Array<{ wps: number; energy: string }>
  ): 'consistent' | 'rising' | 'falling' | 'varied' {
    if (segmentPacing.length < 3) return 'consistent';

    const firstThird = segmentPacing.slice(0, Math.floor(segmentPacing.length / 3));
    const lastThird = segmentPacing.slice(-Math.floor(segmentPacing.length / 3));

    const avgFirst = firstThird.reduce((sum, s) => sum + s.wps, 0) / firstThird.length;
    const avgLast = lastThird.reduce((sum, s) => sum + s.wps, 0) / lastThird.length;

    const difference = avgLast - avgFirst;
    const percentChange = Math.abs(difference / avgFirst) * 100;

    if (percentChange < 15) {
      return 'consistent';
    } else if (difference > 0) {
      return 'rising';
    } else {
      return 'falling';
    }
  }

  private getEmptyFillerAnalysis(): FillerAnalysis {
    return {
      totalFillers: 0,
      fillerPercentage: 0,
      fillersByType: {},
      cleanedSegments: [],
      removedWords: []
    };
  }

  private getEmptyPauseAnalysis(): PauseAnalysis {
    return {
      totalPauses: 0,
      longPauses: [],
      averagePauseDuration: 0,
      hasExcessiveDeadAir: false
    };
  }

  private getEmptyPacingAnalysis(): PacingAnalysis {
    return {
      wordsPerSecond: 0,
      energyProfile: 'consistent',
      hasGoodPacing: false,
      pacingScore: 0,
      segmentPacing: []
    };
  }
}

/**
 * Singleton instance
 */
export const transcriptEnhancementService = new TranscriptEnhancementService();
