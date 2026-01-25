/**
 * Caption Enhancement Service
 *
 * @status IMPLEMENTED - Phase 2 Backend Feature
 * @frontend Phase 2 UI component: /components/repurpose/caption-style-selector.tsx
 * @see docs/REPURPOSE_OS_ENHANCEMENT_SUMMARY.md - Phase 2.4
 * @see docs/PHASE_2_UI_IMPLEMENTATION_GUIDE.md
 *
 * Provides dynamic keyword highlighting and emphasis for captions:
 * - Auto-detects power words, numbers, emotions, actions
 * - Tags words for special styling (color, size, animation)
 * - Supports multiple caption styles: Modern, Viral, Minimal, Gaming, Business
 * - Exports to SRT, VTT, and JSON formats
 * - 3 aggressiveness levels: Subtle, Moderate, Aggressive
 *
 * @example
 * ```typescript
 * const enhanced = await captionEnhancementService.enhanceCaptions({
 *   segments: captionSegments,
 *   style: 'viral',
 *   aggressiveness: 'aggressive'
 * });
 * const srt = captionEnhancementService.exportToSRT(enhanced);
 * ```
 */

import type { TranscriptionSegment } from '../transcript';
import { srtUtils } from '../srt-utils';

// Power words that should be emphasized
const POWER_WORDS = new Set([
  // Action verbs
  'boost', 'skyrocket', 'transform', 'dominate', 'crush', 'explode',
  'master', 'unlock', 'unleash', 'discover', 'reveal', 'secret',

  // Urgency words
  'now', 'today', 'immediately', 'instantly', 'urgent', 'limited',
  'exclusive', 'only', 'never', 'always', 'forever',

  // Emotional words
  'amazing', 'incredible', 'unbelievable', 'shocking', 'mindblowing',
  'powerful', 'epic', 'legendary', 'insane', 'crazy', 'wild',

  // Authority words
  'proven', 'guaranteed', 'certified', 'expert', 'professional',
  'authentic', 'real', 'truth', 'fact', 'science',

  // Value words
  'free', 'bonus', 'gift', 'save', 'win', 'gain', 'profit',
  'success', 'wealth', 'rich', 'million', 'billion'
]);

// Emotion words for highlighting
const EMOTION_WORDS = new Set([
  'love', 'hate', 'fear', 'angry', 'happy', 'sad', 'excited',
  'surprised', 'shocked', 'amazed', 'disgusted', 'jealous',
  'proud', 'ashamed', 'confident', 'nervous', 'worried'
]);

// Action verbs for emphasis
const ACTION_VERBS = new Set([
  'learn', 'build', 'create', 'make', 'start', 'stop', 'grow',
  'scale', 'achieve', 'reach', 'hit', 'launch', 'ship', 'deliver',
  'implement', 'execute', 'optimize', 'improve', 'fix', 'solve'
]);

export type WordHighlight = {
  word: string;
  startMs: number;
  endMs: number;
  highlightType:
    | 'power'      // Power words (yellow/gold)
    | 'number'     // Numbers and metrics (green)
    | 'emotion'    // Emotional words (red/pink)
    | 'action'     // Action verbs (blue)
    | 'question'   // Question words (purple)
    | 'none';      // No highlight
  emphasis: 'none' | 'medium' | 'strong'; // Visual emphasis level
  animation?: 'none' | 'pop' | 'slide' | 'bounce' | 'pulse'; // Animation type
};

export type CaptionStyle = {
  name: string;
  description: string;
  highlights: {
    power: { color: string; fontSize: string; fontWeight: string };
    number: { color: string; fontSize: string; fontWeight: string };
    emotion: { color: string; fontSize: string; fontWeight: string };
    action: { color: string; fontSize: string; fontWeight: string };
    question: { color: string; fontSize: string; fontWeight: string };
  };
  defaultAnimation: 'none' | 'pop' | 'slide' | 'bounce' | 'pulse';
};

export type EnhancedCaption = {
  segments: Array<{
    startMs: number;
    endMs: number;
    words: WordHighlight[];
    text: string;
  }>;
  style: CaptionStyle;
  metadata: {
    totalWords: number;
    highlightedWords: number;
    highlightPercentage: number;
    highlightBreakdown: Record<string, number>;
  };
};

class CaptionEnhancementService {
  /**
   * Analyze and enhance captions with keyword highlighting
   */
  enhanceCaptions(params: {
    segments: TranscriptionSegment[];
    style?: string; // Style preset name
    aggressiveness?: 'subtle' | 'moderate' | 'aggressive'; // How much to highlight
  }): EnhancedCaption {
    const { segments, style = 'modern', aggressiveness = 'moderate' } = params;

    const captionStyle = this.getStyle(style);
    const highlightedSegments: EnhancedCaption['segments'] = [];

    let totalWords = 0;
    let highlightedWords = 0;
    const highlightBreakdown: Record<string, number> = {
      power: 0,
      number: 0,
      emotion: 0,
      action: 0,
      question: 0
    };

    for (const segment of segments) {
      if (!segment.words || segment.words.length === 0) {
        // Fallback: split text into words (no timestamps)
        const words = segment.text.split(/\s+/);
        const wordDuration = ((segment.end - segment.start) * 1000) / words.length;

        const wordHighlights = words.map((word, index) => {
          totalWords++;
          const highlight = this.analyzeWord(word, aggressiveness);

          if (highlight.highlightType !== 'none') {
            highlightedWords++;
            highlightBreakdown[highlight.highlightType]++;
          }

          return {
            ...highlight,
            word,
            startMs: segment.start * 1000 + index * wordDuration,
            endMs: segment.start * 1000 + (index + 1) * wordDuration
          };
        });

        highlightedSegments.push({
          startMs: segment.start * 1000,
          endMs: segment.end * 1000,
          words: wordHighlights,
          text: segment.text
        });
      } else {
        // Use word-level timestamps
        const wordHighlights = segment.words.map(wordObj => {
          totalWords++;
          const highlight = this.analyzeWord(wordObj.word, aggressiveness);

          if (highlight.highlightType !== 'none') {
            highlightedWords++;
            highlightBreakdown[highlight.highlightType]++;
          }

          return {
            ...highlight,
            word: wordObj.word,
            startMs: wordObj.start * 1000,
            endMs: wordObj.end * 1000
          };
        });

        highlightedSegments.push({
          startMs: segment.start * 1000,
          endMs: segment.end * 1000,
          words: wordHighlights,
          text: segment.text
        });
      }
    }

    const highlightPercentage = totalWords > 0 ? (highlightedWords / totalWords) * 100 : 0;

    return {
      segments: highlightedSegments,
      style: captionStyle,
      metadata: {
        totalWords,
        highlightedWords,
        highlightPercentage,
        highlightBreakdown
      }
    };
  }

  /**
   * Analyze a single word for highlighting
   */
  private analyzeWord(
    word: string,
    aggressiveness: 'subtle' | 'moderate' | 'aggressive'
  ): Omit<WordHighlight, 'word' | 'startMs' | 'endMs'> {
    const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check for numbers (including currency)
    if (/\d/.test(word)) {
      return {
        highlightType: 'number',
        emphasis: aggressiveness === 'aggressive' ? 'strong' : 'medium',
        animation: aggressiveness === 'aggressive' ? 'pop' : 'none'
      };
    }

    // Check for power words
    if (POWER_WORDS.has(normalized)) {
      return {
        highlightType: 'power',
        emphasis: aggressiveness === 'subtle' ? 'medium' : 'strong',
        animation: aggressiveness === 'aggressive' ? 'pulse' : 'none'
      };
    }

    // Check for emotion words
    if (EMOTION_WORDS.has(normalized)) {
      return {
        highlightType: 'emotion',
        emphasis: 'medium',
        animation: aggressiveness === 'aggressive' ? 'bounce' : 'none'
      };
    }

    // Check for action verbs
    if (ACTION_VERBS.has(normalized)) {
      return {
        highlightType: 'action',
        emphasis: aggressiveness === 'moderate' ? 'medium' : 'none',
        animation: 'none'
      };
    }

    // Check for question words
    if (['what', 'why', 'how', 'when', 'where', 'who'].includes(normalized)) {
      return {
        highlightType: 'question',
        emphasis: 'medium',
        animation: 'none'
      };
    }

    return {
      highlightType: 'none',
      emphasis: 'none',
      animation: 'none'
    };
  }

  /**
   * Get predefined caption style
   */
  private getStyle(styleName: string): CaptionStyle {
    const styles: Record<string, CaptionStyle> = {
      modern: {
        name: 'Modern',
        description: 'Clean, professional look with subtle highlights',
        highlights: {
          power: { color: '#FFD700', fontSize: '110%', fontWeight: '700' },
          number: { color: '#00FF88', fontSize: '110%', fontWeight: '700' },
          emotion: { color: '#FF6B9D', fontSize: '105%', fontWeight: '600' },
          action: { color: '#5BA3FF', fontSize: '105%', fontWeight: '600' },
          question: { color: '#B388FF', fontSize: '105%', fontWeight: '600' }
        },
        defaultAnimation: 'none'
      },

      viral: {
        name: 'Viral',
        description: 'Aggressive highlights with animations for maximum attention',
        highlights: {
          power: { color: '#FFD700', fontSize: '130%', fontWeight: '900' },
          number: { color: '#00FF88', fontSize: '130%', fontWeight: '900' },
          emotion: { color: '#FF3366', fontSize: '120%', fontWeight: '800' },
          action: { color: '#33CCFF', fontSize: '115%', fontWeight: '700' },
          question: { color: '#CC66FF', fontSize: '115%', fontWeight: '700' }
        },
        defaultAnimation: 'pop'
      },

      minimal: {
        name: 'Minimal',
        description: 'Subtle emphasis without colors, focus on typography',
        highlights: {
          power: { color: '#FFFFFF', fontSize: '110%', fontWeight: '700' },
          number: { color: '#FFFFFF', fontSize: '110%', fontWeight: '700' },
          emotion: { color: '#FFFFFF', fontSize: '105%', fontWeight: '600' },
          action: { color: '#FFFFFF', fontSize: '100%', fontWeight: '600' },
          question: { color: '#FFFFFF', fontSize: '100%', fontWeight: '600' }
        },
        defaultAnimation: 'none'
      },

      gaming: {
        name: 'Gaming',
        description: 'Bold, energetic style with strong highlights',
        highlights: {
          power: { color: '#FF0000', fontSize: '140%', fontWeight: '900' },
          number: { color: '#00FF00', fontSize: '130%', fontWeight: '900' },
          emotion: { color: '#FF00FF', fontSize: '120%', fontWeight: '800' },
          action: { color: '#00FFFF', fontSize: '115%', fontWeight: '700' },
          question: { color: '#FFFF00', fontSize: '115%', fontWeight: '700' }
        },
        defaultAnimation: 'bounce'
      },

      business: {
        name: 'Business',
        description: 'Professional look with conservative highlights',
        highlights: {
          power: { color: '#4A90E2', fontSize: '105%', fontWeight: '600' },
          number: { color: '#50C878', fontSize: '110%', fontWeight: '700' },
          emotion: { color: '#E94B3C', fontSize: '100%', fontWeight: '600' },
          action: { color: '#4A90E2', fontSize: '100%', fontWeight: '600' },
          question: { color: '#7B68EE', fontSize: '100%', fontWeight: '600' }
        },
        defaultAnimation: 'none'
      }
    };

    return styles[styleName] || styles.modern;
  }

  /**
   * Get all available caption styles
   */
  getAvailableStyles(): CaptionStyle[] {
    return [
      this.getStyle('modern'),
      this.getStyle('viral'),
      this.getStyle('minimal'),
      this.getStyle('gaming'),
      this.getStyle('business')
    ];
  }

  /**
   * Export enhanced captions to SRT format with styling tags
   */
  exportToSRT(enhancedCaption: EnhancedCaption): string {
    let srtContent = '';
    let captionIndex = 1;

    for (const segment of enhancedCaption.segments) {
      const startTime = srtUtils.formatSRTTime(segment.startMs);
      const endTime = srtUtils.formatSRTTime(segment.endMs);

      // Build caption text with HTML-style tags for highlighting
      const styledText = segment.words.map(word => {
        if (word.highlightType === 'none') {
          return word.word;
        }

        const style = enhancedCaption.style.highlights[word.highlightType];
        return `<font color="${style.color}">${word.word}</font>`;
      }).join(' ');

      srtContent += `${captionIndex}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${styledText}\n\n`;

      captionIndex++;
    }

    return srtContent;
  }

  /**
   * Export enhanced captions to JSON format (for custom caption renderers)
   */
  exportToJSON(enhancedCaption: EnhancedCaption): string {
    return JSON.stringify(enhancedCaption, null, 2);
  }

  /**
   * Export enhanced captions to WebVTT format with styling
   */
  exportToWebVTT(enhancedCaption: EnhancedCaption): string {
    let vttContent = 'WEBVTT\n\n';

    // Add style definitions
    vttContent += 'STYLE\n';
    vttContent += '::cue(.power) { color: #FFD700; font-weight: bold; }\n';
    vttContent += '::cue(.number) { color: #00FF88; font-weight: bold; }\n';
    vttContent += '::cue(.emotion) { color: #FF6B9D; font-weight: bold; }\n';
    vttContent += '::cue(.action) { color: #5BA3FF; font-weight: bold; }\n';
    vttContent += '::cue(.question) { color: #B388FF; font-weight: bold; }\n\n';

    for (const segment of enhancedCaption.segments) {
      const startTime = srtUtils.formatVTTTime(segment.startMs);
      const endTime = srtUtils.formatVTTTime(segment.endMs);

      // Build caption text with VTT-style tags
      const styledText = segment.words.map(word => {
        if (word.highlightType === 'none') {
          return word.word;
        }
        return `<c.${word.highlightType}>${word.word}</c>`;
      }).join(' ');

      vttContent += `${startTime} --> ${endTime}\n`;
      vttContent += `${styledText}\n\n`;
    }

    return vttContent;
  }

  /**
   * Analyze caption quality and provide recommendations
   */
  analyzeCaptionQuality(enhancedCaption: EnhancedCaption): {
    score: number; // 0-100
    recommendations: string[];
    strengths: string[];
  } {
    const { metadata } = enhancedCaption;
    let score = 100;
    const recommendations: string[] = [];
    const strengths: string[] = [];

    // Check highlight percentage
    if (metadata.highlightPercentage < 5) {
      score -= 20;
      recommendations.push('Consider using more power words and emotional language to increase engagement');
    } else if (metadata.highlightPercentage > 30) {
      score -= 15;
      recommendations.push('Too many highlights may dilute impact. Consider being more selective.');
    } else {
      strengths.push(`Good highlight balance (${metadata.highlightPercentage.toFixed(1)}%)`);
    }

    // Check for numbers
    if (metadata.highlightBreakdown.number === 0) {
      score -= 10;
      recommendations.push('Add specific numbers/metrics to increase credibility and shareability');
    } else {
      strengths.push(`Contains ${metadata.highlightBreakdown.number} specific metrics`);
    }

    // Check for power words
    if (metadata.highlightBreakdown.power < 2) {
      score -= 10;
      recommendations.push('Include more power words to boost viral potential');
    } else {
      strengths.push(`Strong use of power words (${metadata.highlightBreakdown.power})`);
    }

    // Check for emotional words
    if (metadata.highlightBreakdown.emotion === 0) {
      score -= 10;
      recommendations.push('Add emotional language to create stronger connection');
    } else {
      strengths.push('Good emotional resonance');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      recommendations,
      strengths
    };
  }
}

/**
 * Singleton instance
 */
export const captionEnhancementService = new CaptionEnhancementService();
