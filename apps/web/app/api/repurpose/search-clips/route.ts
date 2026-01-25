export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import { SearchClipsUseCase } from '@/lib/application/use-cases/SearchClipsUseCase';
import { withErrorHandling } from '@/lib/utils/error-handler';
import { ApiResponseBuilder } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const schema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  query: z.string().min(1, 'Search query is required'),
  includeTranscripts: z.boolean().optional().default(true),
  limit: z.number().int().positive().optional(),
});

/**
 * POST /api/repurpose/search-clips
 *
 * Natural language search for clips within a project.
 * Uses AI to analyze the query and rank clips by relevance.
 *
 * Features:
 * - Keyword extraction
 * - Emotion/sentiment detection
 * - Action/intent recognition
 * - Transcript-based matching
 * - Relevance scoring
 *
 * Clean Architecture:
 * - Route validates request and handles auth
 * - Use Case orchestrates business logic
 * - Domain service handles AI analysis and scoring
 * - Repositories handle data access
 */
export const POST = withErrorHandling(async (request: Request) => {
  // Step 1: Validate authentication
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized('Authentication required');
  }

  // Step 2: Validate request body
  const json = await request.json();
  const result = schema.safeParse(json);

  if (!result.success) {
    return ApiResponseBuilder.badRequest('Invalid request body', {
      errors: result.error.flatten(),
    });
  }

  const { projectId, query, includeTranscripts, limit } = result.data;

  logger.info('Natural language search API called', {
    projectId,
    query,
    includeTranscripts,
    limit,
    userId: user.id,
  });

  // Step 3: Execute use case via DI container
  const useCase = container.get<SearchClipsUseCase>(TYPES.SearchClipsUseCase);

  const output = await useCase.execute({
    projectId,
    query,
    userId: user.id,
    includeTranscripts,
    limit,
  });

  // Step 4: Return search results
  return ApiResponseBuilder.success(
    {
      analysis: {
        keywords: output.analysis.keywords,
        emotions: output.analysis.emotions,
        actions: output.analysis.actions,
        intent: output.analysis.intent,
        targetDuration: output.analysis.targetDuration,
      },
      results: output.results.map((result) => ({
        clip: result.clip,
        relevanceScore: result.relevanceScore,
        matchReasons: result.matchReasons,
      })),
      totalMatches: output.totalMatches,
      resultCount: output.results.length,
    },
    `Found ${output.totalMatches} matching clips`
  );
});
