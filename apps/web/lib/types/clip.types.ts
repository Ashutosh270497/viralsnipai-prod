import type { ClipCaptionStyleConfig } from "@/lib/repurpose/caption-style-config";

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
  order?: number;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
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
  qualitySignals?: ClipQualitySignals;
  reframePlans?: ClipReframePlan[];
  metadata?: Record<string, unknown>;
}

export type ClipOutputRatio = '9:16' | '1:1' | '16:9';

export type ReframeMode = 'native' | 'center_crop' | 'speaker_focus' | 'letterbox';

export interface VideoGeometry {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  sourceRatioLabel: ClipOutputRatio | 'custom';
}

export interface ClipQualitySignals {
  overallScore: number;         // 0-100 deterministic clip quality
  durationFit: number;          // 0-100
  transcriptDensity: number;    // 0-100
  sceneAlignment: number;       // 0-100
  cutCleanliness: number;       // 0-100
  pacingConsistency: number;    // 0-100
  hardCutRisk: 'low' | 'medium' | 'high';
  contentDensity: 'sparse' | 'balanced' | 'dense';
  wordsPerMinute: number;
  transcriptSegmentCount: number;
  sceneCutsInside: number;
  boundaryDistanceMs: number;
  reasons: string[];
}

export interface ClipReframeTracking {
  axis: 'horizontal' | 'vertical' | 'static';
  travel: number;              // normalized 0-1 travel around anchor center
  lockStrength: number;        // normalized 0-1 anchor confidence
  easing: 'linear' | 'ease_in_out';
}

export interface ClipReframePlan {
  ratio: ClipOutputRatio;
  mode: ReframeMode;
  anchor: 'center' | 'speaker' | 'safe_area';
  confidence: 'high' | 'medium' | 'low';
  safeZone: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tracking?: ClipReframeTracking;
  reasoning: string;
}

/**
 * Phase 1 Enhancement data (transcript quality analysis)
 */
export interface EnhancementData {
  fillerPercentage: number;
  wordsPerSecond: number;
  energyProfile: 'rising' | 'consistent' | 'declining' | 'falling' | 'varied';
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
  order?: number;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
  previewPath?: string | null;
  thumbnail?: string | null;
  viralityScore?: number | null;
  viralityFactors?: ViralityFactors;
}

/**
 * Update clip data (for API requests)
 */
export interface UpdateClipData {
  startMs?: number;
  endMs?: number;
  order?: number;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
  thumbnail?: string | null;
  previewPath?: string | null;
  viralityScore?: number | null;
  viralityFactors?: ViralityFactors;
}
