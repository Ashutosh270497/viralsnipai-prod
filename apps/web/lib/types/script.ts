/**
 * Script Generator Types
 *
 * Type definitions for the AI-powered script generation feature
 */

export type ScriptStyle = 'educational' | 'entertaining' | 'storytelling' | 'review' | 'tutorial';
export type ScriptTone = 'casual' | 'professional' | 'energetic' | 'calm';
export type ScriptTemplate = 'how-to' | 'review' | 'top-10' | 'storytelling' | 'educational' | 'custom';

export interface ScriptGeneratorForm {
  contentIdeaId?: string; // If coming from calendar
  videoTitle: string;
  targetDuration: number; // in minutes: 0.5, 1, 3, 5, 8, 10, 15
  scriptStyle: ScriptStyle;
  tone: ScriptTone;
  includeHook: boolean;
  includeCTA: boolean;
  keywords?: string[];
  additionalContext?: string;
  niche?: string;
  videoDescription?: string;
}

export interface ScriptSegment {
  timestamp: string; // "0:45"
  segment: string; // "Problem Introduction"
  content: string;
  visualCue?: string; // "SHOW: graph animation"
}

export interface GeneratedScript {
  id: string;
  userId: string;
  contentIdeaId?: string;
  title: string;
  hook?: string; // First 15 seconds
  intro?: string; // Setup (15-45s)
  mainContent?: string; // Main body as JSON string
  conclusion?: string;
  cta?: string;
  fullScript?: string; // Complete script as one text
  durationEstimate?: number; // seconds
  retentionTips?: string[]; // JSON
  keywords?: string[]; // JSON
  scriptStyle?: ScriptStyle;
  tone?: ScriptTone;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScriptSegmentStructured {
  timestamp: string;
  segment: string;
  content: string;
  visualCue?: string;
}

export interface GenerateScriptRequest {
  contentIdeaId?: string;
  videoTitle: string;
  videoDescription?: string;
  targetDuration: number;
  scriptStyle: ScriptStyle;
  tone: ScriptTone;
  includeHook: boolean;
  includeCTA: boolean;
  keywords?: string[];
  additionalContext?: string;
  niche?: string;
}

export interface GenerateScriptResponse {
  scriptId: string;
  hook: string;
  intro: string;
  mainContent: ScriptSegmentStructured[];
  conclusion: string;
  cta: string;
  fullScript: string;
  durationEstimate: number;
  retentionTips: string[];
  visualCues: string[];
  keywords: string[];
}

export interface ReviseScriptRequest {
  scriptId: string;
  revision: 'more-engaging' | 'shorten' | 'lengthen' | 'change-tone' | 'add-examples' | 'simplify' | 'custom';
  customInstructions?: string;
  targetDuration?: number;
  newTone?: ScriptTone;
}

export interface HookExample {
  id: string;
  category: 'curiosity' | 'bold-statement' | 'question' | 'pattern-interrupt' | 'statistic';
  text: string;
  niche?: string;
  performance?: 'high' | 'medium' | 'low';
}

export interface RetentionAnalysis {
  overallScore: number; // 0-100
  suggestions: Array<{
    timestamp: string;
    issue: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  pacing: 'too-fast' | 'good' | 'too-slow';
  hookStrength: number; // 0-100
  engagementPoints: number;
}

export const SCRIPT_TEMPLATES = {
  'how-to': {
    name: 'How-To Tutorial',
    structure: 'Problem → Solution → Steps → Result',
    bestFor: 'Educational content, tutorials',
  },
  'review': {
    name: 'Product Review',
    structure: 'Intro → Features → Pros/Cons → Verdict',
    bestFor: 'Reviews, comparisons',
  },
  'top-10': {
    name: 'Top 10 List',
    structure: 'Intro → #10 → ... → #1 → Recap',
    bestFor: 'Listicles, rankings',
  },
  'storytelling': {
    name: 'Storytelling',
    structure: 'Hook → Build → Climax → Resolution',
    bestFor: 'Personal stories, case studies',
  },
  'educational': {
    name: 'Educational Explainer',
    structure: 'What → Why → How → Recap',
    bestFor: 'Explainers, deep dives',
  },
  'custom': {
    name: 'Custom Structure',
    structure: 'Your own format',
    bestFor: 'Unique content styles',
  },
} as const;
