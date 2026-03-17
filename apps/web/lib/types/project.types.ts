/**
 * Project Type Definitions
 *
 * Centralized type definitions for projects and assets.
 *
 * @module project-types
 */

import type { Clip } from './clip.types';

export type ExportStatus = 'queued' | 'processing' | 'done' | 'failed';

/**
 * Project interface
 */
export interface Project {
  id: string;
  userId: string;
  title: string;
  topic?: string | null;
  createdAt: string;
  updatedAt?: string;
  clips?: Clip[];
  exports?: ExportRecord[];
  assets?: Asset[];
}

/**
 * Asset interface
 */
export interface Asset {
  id: string;
  projectId: string;
  path: string;
  storagePath?: string;
  type: 'video' | 'audio';
  durationSec?: number | null;
  durationSeconds?: number | null;  // Alias for compatibility
  transcript?: string | null;
  transcription?: string | null;     // Alias for compatibility
  sourceLanguage?: string;           // Language of the original transcript (ISO 639-1 code)
  createdAt: string;
}

/**
 * Export record interface
 */
export interface ExportRecord {
  id: string;
  projectId: string;
  clipIds: string[];
  preset: string;
  includeCaptions?: boolean;
  status: ExportStatus | string;
  outputPath?: string;
  storagePath?: string;
  error?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Project summary (for lists)
 */
export interface ProjectSummary {
  id: string;
  title: string;
  topic?: string | null;
  clipCount: number;
  assetCount: number;
  createdAt: string;
}
