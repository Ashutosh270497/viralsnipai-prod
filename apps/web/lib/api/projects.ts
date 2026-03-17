/**
 * Projects API
 *
 * Centralized API functions for project-related operations.
 *
 * @module api-projects
 */

import { apiClient } from './client';
import type { ClipCaptionStyleConfig } from "@/lib/repurpose/caption-style-config";

// Types for API responses
export interface Project {
  id: string;
  title: string;
  topic?: string | null;
  createdAt: string;
  clips?: Clip[];
  exports?: ExportRecord[];
  assets?: Asset[];
}

export interface Clip {
  id: string;
  startMs: number;
  endMs: number;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
  previewPath?: string | null;
  viralityScore?: number | null;
}

export interface ExportRecord {
  id: string;
  projectId: string;
  clipIds: string[];
  preset: string;
  status: string;
  outputPath?: string;
  storagePath?: string;
  error?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Asset {
  id: string;
  path: string;
  type: "audio" | "video" | string;
  durationSec?: number | null;
  durationSeconds?: number | null;
  transcript?: string | null;
  sourceLanguage?: string;
  createdAt: string;
}

export interface CreateClipData {
  startMs: number;
  endMs: number;
  title?: string;
  summary?: string;
  callToAction?: string;
}

export interface UpdateClipData {
  title?: string;
  summary?: string;
  callToAction?: string;
  captionSrt?: string;
  captionStyle?: ClipCaptionStyleConfig | null;
}

export interface CreateProjectData {
  userId: string;
  title: string;
  topic?: string;
}

export interface UpdateProjectData {
  title?: string;
  topic?: string;
}

/**
 * Projects API functions
 */
export const projectsApi = {
  /**
   * Get all projects for a user
   */
  getProjects: (userId: string) =>
    apiClient.get<{ projects: Project[] }>(`/api/projects?userId=${userId}`),

  /**
   * Get a single project by ID
   */
  getProject: (id: string) =>
    apiClient.get<{ project: Project }>(`/api/projects/${id}`),

  /**
   * Create a new project
   */
  createProject: (data: CreateProjectData) =>
    apiClient.post<{ project: Project }>(`/api/projects`, data),

  /**
   * Update a project
   */
  updateProject: (id: string, data: UpdateProjectData) =>
    apiClient.patch<{ project: Project }>(`/api/projects/${id}`, data),

  /**
   * Delete a project
   */
  deleteProject: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/api/projects/${id}`),

  /**
   * Get all clips for a project
   */
  getClips: (projectId: string) =>
    apiClient.get<{ clips: Clip[] }>(`/api/projects/${projectId}/clips`),

  /**
   * Create a new clip
   */
  createClip: (projectId: string, data: CreateClipData) =>
    apiClient.post<{ clip: Clip }>(`/api/projects/${projectId}/clips`, data),

  /**
   * Update an existing clip
   */
  updateClip: (projectId: string, clipId: string, data: UpdateClipData) =>
    apiClient.patch<{ clip: Clip }>(`/api/clips/${clipId}`, data),

  /**
   * Delete a clip
   */
  deleteClip: (projectId: string, clipId: string) =>
    apiClient.delete<{ success: boolean }>(`/api/clips/${clipId}`),

  /**
   * Get all exports for a project
   */
  getExports: (projectId: string) =>
    apiClient.get<{ exports: ExportRecord[] }>(`/api/projects/${projectId}/exports`),

  /**
   * Create a new export
   */
  createExport: (projectId: string, data: { clipIds: string[]; preset: string; includeCaptions?: boolean }) =>
    apiClient.post<{ export: ExportRecord }>(`/api/exports`, {
      projectId,
      ...data
    }),

  /**
   * Get export status
   */
  getExportStatus: (exportId: string) =>
    apiClient.get<{ export: ExportRecord }>(`/api/exports/${exportId}`)
};
