/**
 * Clip Repository Interface
 *
 * Defines the contract for clip data access operations.
 *
 * @module IClipRepository
 */

import type { Clip, CreateClipData, UpdateClipData } from '@/lib/types';

export interface FindClipsOptions {
  projectId?: string;
  assetId?: string;
  minViralityScore?: number;
  sortBy?: 'viralityScore' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PaginatedClips {
  clips: Clip[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IClipRepository {
  /**
   * Find a clip by its ID
   * @param id - Clip ID
   * @returns Clip or null if not found
   */
  findById(id: string): Promise<Clip | null>;

  /**
   * Find all clips for a project
   * @param projectId - Project ID
   * @returns Array of clips
   */
  findByProjectId(projectId: string): Promise<Clip[]>;

  /**
   * Find clips with pagination and filtering
   * @param options - Query options
   * @returns Paginated clips
   */
  findMany(options: FindClipsOptions): Promise<PaginatedClips>;

  /**
   * Find top clips by virality score
   * @param projectId - Project ID
   * @param limit - Number of clips to return
   * @returns Array of top clips
   */
  findTopByViralityScore(projectId: string, limit: number): Promise<Clip[]>;

  /**
   * Create a new clip
   * @param data - Clip creation data
   * @returns Created clip
   */
  create(data: CreateClipData & { projectId: string; assetId: string }): Promise<Clip>;

  /**
   * Create multiple clips in a batch
   * @param clips - Array of clip data
   * @returns Array of created clips
   */
  createMany(clips: Array<CreateClipData & { projectId: string; assetId: string }>): Promise<Clip[]>;

  /**
   * Update an existing clip
   * @param id - Clip ID
   * @param data - Updated fields
   * @returns Updated clip
   */
  update(id: string, data: UpdateClipData): Promise<Clip>;

  /**
   * Delete a clip
   * @param id - Clip ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all clips for a project
   * @param projectId - Project ID
   * @returns Number of deleted clips
   */
  deleteByProjectId(projectId: string): Promise<number>;

  /**
   * Count clips for a project
   * @param projectId - Project ID
   * @returns Number of clips
   */
  countByProjectId(projectId: string): Promise<number>;
}
