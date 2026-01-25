/**
 * Centralized Type Definitions
 *
 * Single source of truth for all type definitions used across the application.
 * Import from this module instead of defining types locally.
 *
 * @module types
 *
 * @example
 * ```typescript
 * import { Clip, Project, ViralityFactors } from '@/lib/types';
 * ```
 */

// Clip types
export type {
  Clip,
  ViralityFactors,
  EnhancementData,
  ClipSegment,
  CompositeClip,
  CompositionStrategy,
  TransitionType,
  CreateClipData,
  UpdateClipData
} from './clip.types';

// Project types
export type {
  Project,
  Asset,
  ExportRecord,
  ProjectSummary
} from './project.types';

// Re-export for convenience
export * from './clip.types';
export * from './project.types';
