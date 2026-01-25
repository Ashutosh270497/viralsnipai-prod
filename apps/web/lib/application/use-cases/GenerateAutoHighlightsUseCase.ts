/**
 * Generate Auto-Highlights Use Case
 *
 * Orchestrates the entire auto-highlights generation workflow:
 * 1. Validate asset and permissions
 * 2. Transcribe video (if needed)
 * 3. Generate AI highlight suggestions
 * 4. Extract and normalize clips
 * 5. Analyze virality
 * 6. Save clips to database
 *
 * @module GenerateAutoHighlightsUseCase
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import { TranscriptionService } from '@/lib/domain/services/TranscriptionService';
import { AIAnalysisService } from '@/lib/domain/services/AIAnalysisService';
import { ClipExtractionService } from '@/lib/domain/services/ClipExtractionService';
import { ThumbnailGenerationService } from '@/lib/domain/services/ThumbnailGenerationService';
import { VideoExtractionService } from '@/lib/domain/services/VideoExtractionService';
import { viralityService } from '@/lib/services/virality.service';
import { transcriptEnhancementService } from '@/lib/services/transcript-enhancement.service';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip } from '@/lib/types';
import path from 'path';
import fs from 'fs/promises';
import { nanoid } from 'nanoid';

export interface GenerateAutoHighlightsInput {
  assetId: string;
  userId: string;
  options?: {
    targetClipCount?: number;
    model?: string;
    audience?: string;
    tone?: string;
    brief?: string;
    callToAction?: string;
  };
}

export interface GenerateAutoHighlightsOutput {
  assetId: string;
  clips: Clip[];
  analytics: {
    transcriptionGenerated: boolean;
    suggestionsReceived: number;
    clipsCreated: number;
    averageViralityScore: number | null;
  };
}

@injectable()
export class GenerateAutoHighlightsUseCase {
  constructor(
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.IAssetRepository) private assetRepo: IAssetRepository,
    @inject(TYPES.IClipRepository) private clipRepo: IClipRepository,
    @inject(TYPES.TranscriptionService) private transcriptionService: TranscriptionService,
    @inject(TYPES.AIAnalysisService) private aiAnalysisService: AIAnalysisService,
    @inject(TYPES.ClipExtractionService) private clipExtractionService: ClipExtractionService,
    @inject(TYPES.ThumbnailGenerationService) private thumbnailService: ThumbnailGenerationService,
    @inject(TYPES.VideoExtractionService) private videoExtractionService: VideoExtractionService
  ) {}

  async execute(input: GenerateAutoHighlightsInput): Promise<GenerateAutoHighlightsOutput> {
    const { assetId, userId, options = {} } = input;

    logger.info('Starting auto-highlights generation', {
      assetId,
      userId,
      options,
    });

    // Step 1: Validate asset and user permissions
    const asset = await this.assetRepo.findById(assetId);
    if (!asset) {
      throw AppError.notFound('Asset not found');
    }

    const project = await this.projectRepo.findById(asset.projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied to this asset');
    }

    // Step 2: Get or create transcription
    let transcriptionGenerated = false;
    let durationSec = asset.durationSec;

    // Probe duration if not available
    if (!durationSec || durationSec <= 0) {
      const probedDuration = await this.transcriptionService.probeDuration(asset.path);
      durationSec = probedDuration || 180; // Default to 3 minutes if probe fails

      if (probedDuration) {
        await this.assetRepo.update(assetId, { durationSec });
      }
    }

    const transcriptionResult = await this.transcriptionService.getOrCreateTranscription(
      asset.path,
      asset.transcript
    );

    // Save transcription if newly generated
    if (!asset.transcript) {
      transcriptionGenerated = true;
      await this.assetRepo.update(assetId, {
        transcript: this.transcriptionService.serializeTranscription(transcriptionResult),
        durationSec,
      });
    }

    // Step 3: Generate AI highlight suggestions
    const targetCount =
      options.targetClipCount || this.aiAnalysisService.determineOptimalClipCount(durationSec);

    const analysisResult = await this.aiAnalysisService.generateHighlights({
      transcript: transcriptionResult.text,
      durationSec,
      targetCount,
      model: options.model,
      audience: options.audience,
      tone: options.tone,
      brief: options.brief,
      callToAction: options.callToAction,
    });

    if (analysisResult.suggestions.length === 0) {
      throw AppError.internal('AI failed to generate any highlight suggestions');
    }

    // Step 4: Extract and normalize clips
    const extractedClips = this.clipExtractionService.extractClips(
      analysisResult.suggestions,
      durationSec * 1000, // Convert to milliseconds
      transcriptionResult,
      {
        targetClipCount: targetCount,
        minClipCount: Math.min(targetCount, 3),
      }
    );

    if (extractedClips.length === 0) {
      throw AppError.internal('Failed to extract any valid clips');
    }

    // Step 5: Delete existing clips for this asset (clean slate)
    await this.clipRepo.deleteByProjectId(asset.projectId);

    // Step 6: Analyze virality for each clip
    logger.info('Analyzing virality for clips', {
      clipCount: extractedClips.length,
    });

    const viralityAnalyses = await viralityService.analyzeClips(
      extractedClips.map((clip, index) => ({
        id: `segment-${index}`,
        transcript: this.clipExtractionService.getTranscriptSegment(
          transcriptionResult,
          clip.startMs,
          clip.endMs
        ),
        startSec: clip.startMs / 1000,
        endSec: clip.endMs / 1000,
        metadata: {
          title: clip.title,
          summary: clip.hook,
          tone: options.tone,
        },
      }))
    );

    // Step 7: Analyze transcript quality (Phase 1 enhancement)
    const enhancementAnalyses = new Map<string, any>();
    if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
      logger.info('Analyzing transcript quality (Phase 1 enhancement)', {
        segmentCount: transcriptionResult.segments.length,
      });

      for (let i = 0; i < extractedClips.length; i++) {
        const clip = extractedClips[i];
        const segments = transcriptionResult.segments.filter((seg) => {
          const segStartMs = seg.start * 1000;
          const segEndMs = seg.end * 1000;
          return segEndMs > clip.startMs && segStartMs < clip.endMs;
        });

        if (segments.length > 0) {
          try {
            const enhancement = await transcriptEnhancementService.analyzeTranscript(
              segments,
              clip.startMs / 1000,
              clip.endMs / 1000
            );
            enhancementAnalyses.set(`segment-${i}`, enhancement);
          } catch (error) {
            logger.warn('Failed to analyze transcript quality for clip', {
              clipIndex: i,
              error,
            });
          }
        }
      }
    }

    // Step 8: Create clips in database
    const createdClips: Clip[] = [];

    for (let i = 0; i < extractedClips.length; i++) {
      const extractedClip = extractedClips[i];
      const viralityAnalysis = viralityAnalyses[i];
      const enhancement = enhancementAnalyses.get(`segment-${i}`);

      const viralityFactors = {
        hookStrength: viralityAnalysis?.hookStrength ?? 0,
        emotionalPeak: viralityAnalysis?.emotionalPeak ?? 0,
        storyArc: viralityAnalysis?.storyArc ?? 0,
        pacing: viralityAnalysis?.pacing ?? 0,
        transcriptQuality: viralityAnalysis?.transcriptQuality ?? 0,
        reasoning: viralityAnalysis?.reasoning,
        improvements: viralityAnalysis?.improvements || [],
        enhancement: enhancement || undefined,
      };

      const clip = await this.clipRepo.create({
        projectId: asset.projectId,
        assetId: asset.id,
        startMs: extractedClip.startMs,
        endMs: extractedClip.endMs,
        title: extractedClip.title,
        summary: extractedClip.hook,
        callToAction: extractedClip.callToAction,
        viralityScore: viralityAnalysis?.viralityScore ?? null,
        viralityFactors: viralityFactors as any,
      } as any);

      createdClips.push(clip);
    }

    // Step 8.5: Generate preview videos and thumbnails for all clips
    logger.info('Generating preview videos and thumbnails for clips', {
      clipCount: createdClips.length,
    });

    // Ensure output directories exist
    const previewsDir = path.join(process.cwd(), 'public', 'uploads', 'previews', asset.projectId);
    await fs.mkdir(previewsDir, { recursive: true });

    // Get absolute path to source video
    let sourceVideoPath: string;
    const assetPath = asset.storagePath || asset.path;

    if (path.isAbsolute(assetPath)) {
      // Already absolute path (e.g., /Users/.../file.mp4)
      sourceVideoPath = assetPath;
    } else if (assetPath.startsWith('/uploads')) {
      // Public URL path - convert to absolute file system path
      sourceVideoPath = path.join(process.cwd(), 'public', assetPath);
    } else {
      // Relative path - prepend public directory
      sourceVideoPath = path.join(process.cwd(), 'public', assetPath);
    }

    logger.info('Source video path resolved', {
      assetPath,
      resolvedPath: sourceVideoPath,
      projectId: asset.projectId,
    });

    // Generate preview videos and thumbnails in parallel
    const previewPromises = createdClips.map(async (clip) => {
      try {
        // Generate preview video filename
        const previewFilename = `clip-${clip.id}-${nanoid(8)}.mp4`;
        const previewOutputPath = path.join(previewsDir, previewFilename);
        const previewPublicUrl = `/uploads/previews/${asset.projectId}/${previewFilename}`;

        // Extract video clip
        await this.videoExtractionService.extractClip({
          inputPath: sourceVideoPath,
          startMs: clip.startMs,
          endMs: clip.endMs,
          outputPath: previewOutputPath,
        });

        logger.info('Preview video generated for clip', {
          clipId: clip.id,
          previewPath: previewPublicUrl,
        });

        // Generate thumbnail
        let thumbnailUrl: string | undefined;
        try {
          const thumbnailResult = await this.thumbnailService.generateClipThumbnail(
            sourceVideoPath,
            clip.startMs,
            clip.endMs,
            asset.projectId,
            clip.id
          );

          if (thumbnailResult) {
            thumbnailUrl = thumbnailResult.publicUrl;
            logger.info('Thumbnail generated for clip', {
              clipId: clip.id,
              thumbnailUrl,
            });
          }
        } catch (thumbnailError) {
          logger.warn('Failed to generate thumbnail for clip', {
            clipId: clip.id,
            error: thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError),
          });
        }

        // Update clip with preview path and thumbnail
        await this.clipRepo.update(clip.id, {
          previewPath: previewPublicUrl,
          ...(thumbnailUrl && { thumbnail: thumbnailUrl }),
        });
      } catch (error) {
        logger.error('Failed to generate preview for clip', {
          clipId: clip.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue without preview - log error but don't fail the entire process
      }
    });

    // Wait for all previews to complete
    await Promise.allSettled(previewPromises);

    // Reload clips with previews and thumbnails
    const updatedClips = await this.clipRepo.findByProjectId(asset.projectId);

    // Step 9: Calculate analytics
    const viralityScores = createdClips
      .map((c) => c.viralityScore)
      .filter((score): score is number => score !== null && score !== undefined);

    const averageViralityScore =
      viralityScores.length > 0
        ? viralityScores.reduce((sum, score) => sum + score, 0) / viralityScores.length
        : null;

    logger.info('Auto-highlights generation completed', {
      assetId,
      clipsCreated: createdClips.length,
      averageViralityScore,
    });

    return {
      assetId,
      clips: updatedClips,
      analytics: {
        transcriptionGenerated,
        suggestionsReceived: analysisResult.suggestions.length,
        clipsCreated: updatedClips.length,
        averageViralityScore,
      },
    };
  }
}
