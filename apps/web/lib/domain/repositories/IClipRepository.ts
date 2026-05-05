/**
 * Clip Repository Interface
 *
 * Defines the contract for clip data access operations.
 *
 * @module IClipRepository
 */

import type { Clip, ClipReviewStatus, CreateClipData, UpdateClipData } from "@/lib/types";

export interface FindClipsOptions {
  projectId?: string;
  assetId?: string;
  minViralityScore?: number;
  sortBy?: "viralityScore" | "createdAt";
  sortOrder?: "asc" | "desc";
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
  createMany(
    clips: Array<CreateClipData & { projectId: string; assetId: string }>,
  ): Promise<Clip[]>;

  /**
   * Update an existing clip
   * @param id - Clip ID
   * @param data - Updated fields
   * @returns Updated clip
   */
  update(id: string, data: UpdateClipData): Promise<Clip>;

  /**
   * Update an existing clip only if the caller's expected version matches.
   * Used by user-facing PATCH endpoints to avoid silent last-write-wins edits.
   *
   * @param id - Clip ID
   * @param expectedVersion - Version the caller last read
   * @param data - Updated fields
   * @returns Updated clip, or null when the version is stale or the clip is missing
   */
  updateWithVersion(
    id: string,
    expectedVersion: number,
    data: UpdateClipData,
  ): Promise<Clip | null>;

  /**
   * Update the review workflow status for a clip.
   * @param id - Clip ID
   * @param reviewStatus - New review status
   * @returns Updated clip
   */
  updateReviewStatus(id: string, reviewStatus: ClipReviewStatus): Promise<Clip>;

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
   * Atomically replace one clip with two new clips.
   * Creates the two new clips and deletes the original inside a single
   * database transaction. If any step fails the entire operation is rolled
   * back, so the caller never sees partial state (e.g. one new clip + the
   * original still present).
   *
   * @param input - the original clip id plus full data for the two new clips
   * @returns the two newly-created clips
   */
  splitClip(input: {
    originalClipId: string;
    firstClipData: CreateClipData & { projectId: string; assetId: string };
    secondClipData: CreateClipData & { projectId: string; assetId: string };
  }): Promise<{ firstClip: Clip; secondClip: Clip }>;

  /**
   * Count clips for a project
   * @param projectId - Project ID
   * @returns Number of clips
   */
  countByProjectId(projectId: string): Promise<number>;
}
