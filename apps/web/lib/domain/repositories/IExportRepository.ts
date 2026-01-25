/**
 * Export Repository Interface
 *
 * Defines the contract for export data access operations.
 *
 * @module IExportRepository
 */

import type { ExportRecord } from '@/lib/types';

export interface CreateExportData {
  projectId: string;
  clipId?: string | null;
  preset: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface UpdateExportData {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string | null;
  error?: string | null;
  completedAt?: string | null;
}

export interface IExportRepository {
  /**
   * Find an export by its ID
   * @param id - Export ID
   * @returns Export record or null if not found
   */
  findById(id: string): Promise<ExportRecord | null>;

  /**
   * Find all exports for a project
   * @param projectId - Project ID
   * @returns Array of export records
   */
  findByProjectId(projectId: string): Promise<ExportRecord[]>;

  /**
   * Find exports by status
   * @param status - Export status
   * @returns Array of export records
   */
  findByStatus(status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<ExportRecord[]>;

  /**
   * Find pending or processing exports (for polling)
   * @returns Array of export records
   */
  findActive(): Promise<ExportRecord[]>;

  /**
   * Create a new export
   * @param data - Export creation data
   * @returns Created export record
   */
  create(data: CreateExportData): Promise<ExportRecord>;

  /**
   * Update an existing export
   * @param id - Export ID
   * @param data - Updated fields
   * @returns Updated export record
   */
  update(id: string, data: UpdateExportData): Promise<ExportRecord>;

  /**
   * Delete an export
   * @param id - Export ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all exports for a project
   * @param projectId - Project ID
   * @returns Number of deleted exports
   */
  deleteByProjectId(projectId: string): Promise<number>;

  /**
   * Count exports for a project
   * @param projectId - Project ID
   * @returns Number of exports
   */
  countByProjectId(projectId: string): Promise<number>;
}
