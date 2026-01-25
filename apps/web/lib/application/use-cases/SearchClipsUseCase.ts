/**
 * Search Clips Use Case
 *
 * Orchestrates natural language search for clips:
 * 1. Validate project and user permissions
 * 2. Get all clips for the project
 * 3. Optionally fetch transcripts for better matching
 * 4. Use NaturalLanguageSearchService to analyze query and score clips
 * 5. Return ranked search results
 *
 * @module SearchClipsUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import { NaturalLanguageSearchService, type SearchResults, type QueryAnalysis } from '@/lib/domain/services/NaturalLanguageSearchService';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';

export interface SearchClipsInput {
  projectId: string;
  query: string;
  userId: string;
  includeTranscripts?: boolean;
  limit?: number;
}

export interface SearchClipsOutput {
  analysis: QueryAnalysis;
  results: Array<{
    clip: Clip;
    relevanceScore: number;
    matchReasons: string[];
  }>;
  totalMatches: number;
}

@injectable()
export class SearchClipsUseCase {
  constructor(
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.NaturalLanguageSearchService) private searchService: NaturalLanguageSearchService
  ) {}

  async execute(input: SearchClipsInput): Promise<SearchClipsOutput> {
    const { projectId, query, userId, includeTranscripts = true, limit } = input;

    logger.info('Searching clips with natural language', {
      projectId,
      query,
      userId,
      includeTranscripts,
    });

    // Step 1: Validate project and user permissions
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    if (project.userId !== userId) {
      throw AppError.forbidden('Access denied to this project');
    }

    // Step 2: Get all clips for the project
    const clips = await this.clipRepo.findByProjectId(projectId);

    if (clips.length === 0) {
      logger.info('No clips found in project', { projectId });
      return {
        analysis: {
          keywords: [],
          emotions: [],
          actions: [],
          intent: query,
        },
        results: [],
        totalMatches: 0,
      };
    }

    logger.info('Retrieved clips for search', {
      projectId,
      clipCount: clips.length,
    });

    // Step 3: Optionally fetch transcripts for better matching
    let transcripts: Map<string, string> | undefined;
    if (includeTranscripts) {
      transcripts = await this.fetchTranscripts(clips);
      logger.info('Fetched transcripts for search', {
        transcriptCount: transcripts.size,
      });
    }

    // Step 4: Execute natural language search
    const searchResults = await this.searchService.searchClips(
      { query, projectId },
      clips,
      transcripts
    );

    // Step 5: Apply limit if specified
    let results = searchResults.results;
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    logger.info('Search completed', {
      projectId,
      query,
      totalMatches: searchResults.totalMatches,
      returnedResults: results.length,
    });

    return {
      analysis: searchResults.analysis,
      results,
      totalMatches: searchResults.totalMatches,
    };
  }

  /**
   * Fetch transcripts for all unique assets
   */
  private async fetchTranscripts(clips: Clip[]): Promise<Map<string, string>> {
    const transcripts = new Map<string, string>();

    // Get unique asset IDs
    const assetIds = [...new Set(clips.map((clip) => clip.assetId))];

    // Fetch assets with transcripts
    const assets = await Promise.all(
      assetIds.map((assetId) => this.assetRepo.findById(assetId))
    );

    // Build transcript map
    for (const asset of assets) {
      if (asset && asset.transcript) {
        transcripts.set(asset.id, asset.transcript);
      }
    }

    return transcripts;
  }
}
