/**
 * Clip Type Definitions
 *
 * Centralized type definitions for clips and clip-related data structures.
 * Used across components, services, and API routes.
 *
 * @module clip-types
 */

/**
 * Base clip interface
 */
export interface Clip {
  id: string;
  projectId: string;
  assetId: string;
  startMs: number;
  endMs: number;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  previewPath?: string | null;
  thumbnail?: string | null;
  viralityScore?: number | null;
  viralityFactors?: ViralityFactors;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Virality analysis factors
 */
export interface ViralityFactors {
  hookStrength: number;        // 0-100
  emotionalPeak: number;        // 0-100
  storyArc: number;             // 0-100
  pacing: number;               // 0-100
  transcriptQuality: number;    // 0-100
  reasoning?: string;
  improvements?: string[];
  enhancement?: EnhancementData;
}

/**
 * Phase 1 Enhancement data (transcript quality analysis)
 */
export interface EnhancementData {
  fillerPercentage: number;
  wordsPerSecond: number;
  energyProfile: 'rising' | 'consistent' | 'declining';
  qualityScore: number;         // 0-100
  hasDeadAir: boolean;
  pauseCount: number;
  issues: string[];
  strengths: string[];
}

/**
 * Clip segment (for composite clips)
 */
export interface ClipSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  relevanceScore?: number;
  viralityScore?: number;
}

/**
 * Composite clip (multi-segment)
 */
export interface CompositeClip {
  id: string;
  segments: ClipSegment[];
  strategy: CompositionStrategy;
  totalDurationMs: number;
  transitions: TransitionType[];
  estimatedViralityScore: number;
  reasoning: string;
}

/**
 * Composition strategies for multi-segment clips
 */
export type CompositionStrategy =
  | 'problem-solution'
  | 'setup-payoff'
  | 'multi-example'
  | 'qa'
  | 'before-after'
  | 'sequential';

/**
 * Transition types for composite clips
 */
export type TransitionType = 'cut' | 'fade' | 'dissolve' | 'wipe';

/**
 * Create clip data (for API requests)
 */
export interface CreateClipData {
  startMs: number;
  endMs: number;
  title?: string;
  summary?: string;
  callToAction?: string;
  viralityScore?: number | null;
  viralityFactors?: ViralityFactors;
}

/**
 * Update clip data (for API requests)
 */
export interface UpdateClipData {
  title?: string;
  summary?: string;
  callToAction?: string;
  captionSrt?: string;
  thumbnail?: string;
  previewPath?: string;
}
