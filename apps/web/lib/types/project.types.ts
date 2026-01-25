/**
 * Project Type Definitions
 *
 * Centralized type definitions for projects and assets.
 *
 * @module project-types
 */

import type { Clip } from './clip.types';

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
  clipId?: string | null;
  preset: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string | null;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
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
