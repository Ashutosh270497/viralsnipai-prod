/**
 * Asset Repository Interface
 *
 * Defines the contract for asset data access operations.
 *
 * @module IAssetRepository
 */

import type { Asset } from '@/lib/types';

export interface CreateAssetData {
  projectId: string;
  path: string;
  storagePath: string;
  type: 'video' | 'audio';
  durationSec?: number | null;
  transcript?: string | null;
}

export interface UpdateAssetData {
  path?: string;
  durationSec?: number | null;
  transcript?: string | null;
}

export interface IAssetRepository {
  /**
   * Find an asset by its ID
   * @param id - Asset ID
   * @returns Asset or null if not found
   */
  findById(id: string): Promise<Asset | null>;

  /**
   * Find all assets for a project
   * @param projectId - Project ID
   * @returns Array of assets
   */
  findByProjectId(projectId: string): Promise<Asset[]>;

  /**
   * Find assets by type
   * @param projectId - Project ID
   * @param type - Asset type ('video' or 'audio')
   * @returns Array of assets
   */
  findByType(projectId: string, type: 'video' | 'audio'): Promise<Asset[]>;

  /**
   * Create a new asset
   * @param data - Asset creation data
   * @returns Created asset
   */
  create(data: CreateAssetData): Promise<Asset>;

  /**
   * Update an existing asset
   * @param id - Asset ID
   * @param data - Updated fields
   * @returns Updated asset
   */
  update(id: string, data: UpdateAssetData): Promise<Asset>;

  /**
   * Delete an asset
   * @param id - Asset ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all assets for a project
   * @param projectId - Project ID
   * @returns Number of deleted assets
   */
  deleteByProjectId(projectId: string): Promise<number>;

  /**
   * Count assets for a project
   * @param projectId - Project ID
   * @returns Number of assets
   */
  countByProjectId(projectId: string): Promise<number>;

  /**
   * Check if an asset exists
   * @param id - Asset ID
   * @returns True if asset exists
   */
  exists(id: string): Promise<boolean>;
}
