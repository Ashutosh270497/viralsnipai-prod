/**
 * Project Repository Interface
 *
 * Defines the contract for project data access operations.
 * Abstracts database implementation details from business logic.
 *
 * @module IProjectRepository
 */

import type { Project, ProjectSummary } from '@/lib/types';

export interface CreateProjectData {
  userId: string;
  title: string;
  topic?: string | null;
}

export interface UpdateProjectData {
  title?: string;
  topic?: string | null;
  sourceUrl?: string | null;
  updatedAt?: string | Date;
}

export interface IProjectRepository {
  /**
   * Find a project by its ID
   * @param id - Project ID
   * @returns Project with all relations or null if not found
   */
  findById(id: string): Promise<Project | null>;

  /**
   * Find all projects for a user
   * @param userId - User ID
   * @returns Array of projects
   */
  findByUserId(userId: string): Promise<Project[]>;

  /**
   * Get project summaries for a user (lightweight, for lists)
   * @param userId - User ID
   * @returns Array of project summaries
   */
  findSummariesByUserId(userId: string): Promise<ProjectSummary[]>;

  /**
   * Create a new project
   * @param data - Project creation data
   * @returns Created project
   */
  create(data: CreateProjectData): Promise<Project>;

  /**
   * Update an existing project
   * @param id - Project ID
   * @param data - Updated fields
   * @returns Updated project
   */
  update(id: string, data: UpdateProjectData): Promise<Project>;

  /**
   * Delete a project and all its related data
   * @param id - Project ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a project exists
   * @param id - Project ID
   * @returns True if project exists
   */
  exists(id: string): Promise<boolean>;
}
