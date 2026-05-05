/**
 * Generate Auto-Highlights Use Case
 *
 * Orchestrates the entire auto-highlights generation workflow:
 * 1. Validate asset and permissions
 * 2. Transcribe video (if needed)
 * 3. Generate timestamped candidates locally
 * 4. Rerank candidates via OpenRouter
 * 5. Refine boundaries locally
 * 6. Analyze virality, save clips, generate previews
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
import { ClipCandidateGenerationService, type ClipCandidate } from '@/lib/domain/services/ClipCandidateGenerationService';
import { ClipBoundaryRefinementService } from '@/lib/domain/services/ClipBoundaryRefinementService';
import { ClipRerankingService } from '@/lib/domain/services/ClipRerankingService';
import { ThumbnailGenerationService } from '@/lib/domain/services/ThumbnailGenerationService';
import { VideoExtractionService } from '@/lib/domain/services/VideoExtractionService';
import { materializeMediaLocally } from '@/lib/media/media-path-resolver';
import { viralityService } from '@/lib/services/virality.service';
import { transcriptEnhancementService, type TranscriptEnhancement } from '@/lib/services/transcript-enhancement.service';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import type { Clip, ViralityFactors as ClipViralityFactors, EnhancementData } from '@/lib/types';
import type { TranscriptionSegment } from '@/lib/transcript';
import type { CanonicalTranscript, TranscriptPrecision } from '@/lib/ai/providers/openai-transcription-provider';
import { buildSRT, type CaptionEntry } from '@/lib/srt-utils';
import { PRESETS, probeVideoGeometry } from '@/lib/ffmpeg';
import {
  analyzeClipQuality,
  blendViralityScore,
  buildClipReframePlans,
  selectBestReframePlan,
} from '@/lib/repurpose/clip-optimization';
import { detectRepurposeSceneCuts } from '@/lib/repurpose/scene-detection';
import { V1_CLIP_POLICY } from '@/lib/repurpose/clip-policy';
import path from 'path';
import fs from 'fs/promises';
import { nanoid } from 'nanoid';

const PREVIEW_PRESET = 'shorts_9x16_1080' as const;
const PREVIEW_TARGET_RATIO = PRESETS[PREVIEW_PRESET].width / PRESETS[PREVIEW_PRESET].height;
const PREVIEW_CONCURRENCY_LIMIT = 3;

export type AutoHighlightsMode = 'replace' | 'merge' | 'append';

export interface PreviewGenerationFailure {
  clipId: string;
  stage: 'source_resolution' | 'preview' | 'thumbnail' | 'database_update';
  reason: string;
}

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
    /**
     * Reconciliation strategy when the project already has clips.
     * - "merge" (default): keep existing clips; skip new ones whose start time is within
     *   MERGE_OVERLAP_WINDOW_MS of an existing clip's start time
     * - "replace": delete all existing clips before creating new ones
     * - "append": keep existing clips; add all new clips (no dedup)
     */
    mode?: AutoHighlightsMode;
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
    /** Mode used for this run. */
    mode: AutoHighlightsMode;
    /** Number of pre-existing clips deleted (only > 0 when mode === 'replace'). */
    existingClipsDeleted: number;
    /** Number of new clips skipped due to overlap with existing (only when mode === 'merge'). */
    skippedDueToOverlap: number;
    /** Number of pre-existing clips preserved on the project. */
    existingClipsPreserved: number;
    previewsGenerated: number;
    previewFailures: number;
    previewFailureReasons: PreviewGenerationFailure[];
    providerTranscription?: 'openai';
    providerReasoning?: 'openrouter';
    transcriptionModel?: string;
    rerankModel?: string;
    viralityModel?: string;
    transcriptPrecision?: TranscriptPrecision;
    candidatesGenerated?: number;
    candidatesReranked?: number;
    lowPrecisionWarning?: string | null;
  };
}

/**
 * Two clips whose start times are within this window are considered duplicates
 * for the purposes of merge-mode dedup. Picked to absorb minor differences
 * between AI runs while still surfacing genuinely new highlights.
 */
const MERGE_OVERLAP_WINDOW_MS = 5_000;

async function runWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      await worker(next.item, next.index);
    }
  });

  await Promise.allSettled(workers);
}

function buildFallbackTitle(candidate: ClipCandidate): string {
  const words = candidate.firstWords || candidate.text;
  const title = words
    .replace(/[^\w\s'"-]/g, "")
    .split(/\s+/)
    .slice(0, 9)
    .join(" ")
    .trim();
  return title || "Selected highlight";
}

function getLowPrecisionWarning(transcript: CanonicalTranscript): string | null {
  if (transcript.precision === "word") return null;
  if (transcript.precision === "segment" || transcript.precision === "diarized_segment") {
    return "Transcript has segment-level timing only; clip boundaries use lower-confidence segment snapping.";
  }
  return "Transcript timing precision is low; clips may need manual review.";
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

  private readonly candidateGenerationService = new ClipCandidateGenerationService();
  private readonly clipRerankingService = new ClipRerankingService();
  private readonly boundaryRefinementService = new ClipBoundaryRefinementService();

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

    // Materialize the source asset to a local path for FFmpeg/transcription/CV.
    // For local-driver assets this is a no-op probe; for S3/HTTPS-stored assets
    // this streams the file to a tempfile. We MUST clean it up before every
    // return below — see the try/finally pattern in TrimClipUseCase for the
    // simpler shape; here we use explicit cleanup since the method is large
    // and has multiple early returns.
    const materialized = await materializeMediaLocally([asset.storagePath, asset.path]);
    const sourcePath = materialized?.localPath ?? null;

    // Probe duration if not available
    if (!durationSec || durationSec <= 0) {
      if (!sourcePath) {
        throw AppError.badRequest(
          'Unable to determine source video duration because the asset file is not available on local storage or remote storage.'
        );
      }

      const probedDuration = await this.transcriptionService.probeDuration(sourcePath);
      if (!probedDuration || probedDuration <= 0) {
        await materialized?.cleanup();
        throw AppError.badRequest(
          'Unable to determine source video duration. Please re-upload or retranscode the source video.'
        );
      }

      durationSec = probedDuration;
      await this.assetRepo.update(assetId, { durationSec });
    }

    const transcriptionSourcePath = sourcePath || asset.storagePath || asset.path;

    const transcriptionResult = await this.transcriptionService.getOrCreateTranscription(
      transcriptionSourcePath,
      asset.transcript ?? null,
      { forceRetranscribeOnUntimed: true }
    );

    // Save canonical transcript JSON whenever the stored transcript is missing
    // or legacy/low precision data forced an OpenAI re-transcription.
    const serializedTranscript = this.transcriptionService.serializeTranscription(transcriptionResult);
    if (!asset.transcript || asset.transcript !== serializedTranscript) {
      transcriptionGenerated = true;
      await this.assetRepo.update(assetId, {
        transcript: serializedTranscript,
        durationSec,
      });
    }

    const canonicalTranscript = transcriptionResult as CanonicalTranscript;
    const targetCount = Math.min(
      V1_CLIP_POLICY.maxTargetClips,
      Math.max(1, options.targetClipCount ?? V1_CLIP_POLICY.defaultTargetClips)
    );

    // Step 3: Detect scene transitions (visual motion proxy) for cleaner cuts.
    let sceneCutsMs: number[] = [];
    try {
      const sceneDetection = await detectRepurposeSceneCuts({
        inputPath: transcriptionSourcePath,
        maxCuts: 350,
        // Per-project override; null/undefined → use env default → CV default.
        threshold: project.sceneCutThreshold ?? null,
      });
      sceneCutsMs = sceneDetection.cutsMs;
      logger.info('Scene detection completed for auto-highlights', {
        assetId,
        provider: sceneDetection.provider,
        cvProvider: sceneDetection.cvProvider,
        cuts: sceneCutsMs.length,
        fallbackReason: sceneDetection.fallbackReason,
        threshold: sceneDetection.thresholdUsed,
        thresholdSource: sceneDetection.thresholdSource,
      });
    } catch (error) {
      logger.warn('Scene detection failed, continuing with transcript-only alignment', {
        assetId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    let sourceGeometry =
      asset.sourceWidth && asset.sourceHeight
        ? {
            width: asset.sourceWidth,
            height: asset.sourceHeight,
            aspectRatio: asset.sourceHeight > 0 ? asset.sourceWidth / asset.sourceHeight : 1,
            orientation:
              Math.abs(asset.sourceWidth / asset.sourceHeight - 1) < 0.05
                ? ('square' as const)
                : asset.sourceWidth > asset.sourceHeight
                  ? ('landscape' as const)
                  : ('portrait' as const),
            sourceRatioLabel:
              Math.abs(asset.sourceWidth / asset.sourceHeight - 9 / 16) < 0.05
                ? ('9:16' as const)
                : Math.abs(asset.sourceWidth / asset.sourceHeight - 1) < 0.05
                  ? ('1:1' as const)
                  : Math.abs(asset.sourceWidth / asset.sourceHeight - 16 / 9) < 0.08
                    ? ('16:9' as const)
                    : ('custom' as const),
          }
        : null;
    if (!sourceGeometry) {
      try {
        sourceGeometry = await probeVideoGeometry(transcriptionSourcePath);
        await this.assetRepo.update(assetId, {
          sourceWidth: sourceGeometry.width,
          sourceHeight: sourceGeometry.height,
        });
      } catch (error) {
        logger.warn('Video geometry probe failed, continuing without reframe plans', {
          assetId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Step 5: Generate real timestamped candidates locally, rerank candidate
    // IDs with OpenRouter, then refine final boundaries locally. OpenRouter
    // never creates or controls final timestamps.
    const generatedCandidates = this.candidateGenerationService.generateCandidates({
      transcript: canonicalTranscript,
      durationMs: durationSec * 1000,
      sceneCutsMs,
      policy: V1_CLIP_POLICY,
      audience: options.audience,
      tone: options.tone,
      brief: options.brief,
    });

    if (generatedCandidates.length === 0) {
      throw AppError.internal('Failed to generate any timestamped clip candidates');
    }

    let rerankModel = options.model ?? process.env.OPENROUTER_HIGHLIGHT_RERANK_MODEL ?? 'google/gemini-2.5-pro';
    let rerankWarnings: string[] = [];
    let selectedCandidatePairs: Array<{
      candidate: ClipCandidate;
      title: string;
      hook: string;
      callToAction?: string | null;
      llmScore: number | null;
      finalScore: number;
      viralReason?: string;
      editingNotes?: string[];
      platformFit?: Record<string, number>;
    }> = [];

    try {
      const reranked = await this.clipRerankingService.rerank({
        candidates: generatedCandidates,
        targetClipCount: targetCount,
        audience: options.audience,
        tone: options.tone,
        brief: options.brief,
        callToAction: options.callToAction,
        transcriptPrecision: canonicalTranscript.precision,
        sourceDurationSec: durationSec,
        model: options.model,
      });
      rerankModel = reranked.model;
      rerankWarnings = reranked.overallWarnings;
      selectedCandidatePairs = reranked.selected
        .map((selection) => {
          const candidate = generatedCandidates.find((item) => item.id === selection.candidateId);
          if (!candidate) return null;
          return {
            candidate,
            title: selection.title,
            hook: selection.hook,
            callToAction: selection.callToAction ?? options.callToAction ?? null,
            llmScore: selection.llmScore,
            finalScore: selection.finalScore,
            viralReason: selection.viralReason,
            editingNotes: selection.editingNotes,
            platformFit: selection.platformFit,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } catch (error) {
      logger.warn('OpenRouter candidate reranking failed; falling back to deterministic candidate order', {
        assetId,
        error: error instanceof Error ? error.message : String(error),
      });
      rerankWarnings = ['OpenRouter reranking unavailable; used deterministic candidate ranking.'];
      selectedCandidatePairs = generatedCandidates.slice(0, targetCount).map((candidate) => ({
        candidate,
        title: buildFallbackTitle(candidate),
        hook: candidate.firstWords || candidate.text.slice(0, 120),
        callToAction: options.callToAction ?? null,
        llmScore: null,
        finalScore: candidate.deterministicScore,
        viralReason: 'Selected by deterministic transcript and scene-quality score.',
        editingNotes: [],
        platformFit: {},
      }));
    }

    const extractedClips = selectedCandidatePairs.map((pair) => {
      const refined = this.boundaryRefinementService.refine({
        candidate: pair.candidate,
        transcript: canonicalTranscript,
        sceneCutsMs,
        durationMs: durationSec * 1000,
        policy: V1_CLIP_POLICY,
      });
      const qualitySignals = analyzeClipQuality({
        startMs: refined.startMs,
        endMs: refined.endMs,
        transcriptionSegments: transcriptionResult.segments,
        sceneCutsMs,
        minDurationMs: V1_CLIP_POLICY.minMs,
        maxDurationMs: V1_CLIP_POLICY.maxMs,
      });

      return {
        title: pair.title,
        hook: pair.hook,
        startMs: refined.startMs,
        endMs: refined.endMs,
        callToAction: pair.callToAction ?? undefined,
        qualitySignals,
        selectionScore: pair.finalScore,
        candidate: pair.candidate,
        llmScore: pair.llmScore,
        boundary: refined,
        viralReason: pair.viralReason,
        editingNotes: pair.editingNotes ?? [],
        platformFit: pair.platformFit ?? {},
      };
    });

    if (extractedClips.length === 0) {
      throw AppError.internal('Failed to extract any valid clips');
    }

    // Step 5: Reconcile with existing clips per requested mode
    const mode: AutoHighlightsMode = options.mode ?? 'merge';
    const existingClipsBefore = await this.clipRepo.findByProjectId(asset.projectId);
    let existingClipsDeleted = 0;
    let skippedDueToOverlap = 0;
    let clipsToCreate = extractedClips;

    if (mode === 'replace') {
      if (existingClipsBefore.length > 0) {
        existingClipsDeleted = await this.clipRepo.deleteByProjectId(asset.projectId);
        logger.info('Auto-highlights replace mode: cleared existing clips', {
          assetId,
          projectId: asset.projectId,
          existingClipsDeleted,
        });
      }
    } else if (mode === 'merge') {
      const existingStartsMs = existingClipsBefore.map((c) => c.startMs);
      const filtered = extractedClips.filter((candidate) => {
        const collides = existingStartsMs.some(
          (existingStart) => Math.abs(existingStart - candidate.startMs) <= MERGE_OVERLAP_WINDOW_MS
        );
        if (collides) skippedDueToOverlap += 1;
        return !collides;
      });
      logger.info('Auto-highlights merge mode: deduplicated against existing clips', {
        assetId,
        projectId: asset.projectId,
        existingCount: existingClipsBefore.length,
        candidateCount: extractedClips.length,
        keptCount: filtered.length,
        skippedDueToOverlap,
        windowMs: MERGE_OVERLAP_WINDOW_MS,
      });
      if (filtered.length === 0) {
        logger.warn('Auto-highlights merge mode: every candidate overlapped with existing clips', {
          assetId,
          projectId: asset.projectId,
        });
        await materialized?.cleanup();
        return {
          assetId,
          clips: existingClipsBefore,
          analytics: {
            transcriptionGenerated,
            suggestionsReceived: selectedCandidatePairs.length,
            clipsCreated: 0,
            averageViralityScore: null,
            mode,
            existingClipsDeleted: 0,
            skippedDueToOverlap,
            existingClipsPreserved: existingClipsBefore.length,
            previewsGenerated: 0,
            previewFailures: 0,
            previewFailureReasons: [],
            providerTranscription: 'openai',
            providerReasoning: 'openrouter',
            transcriptionModel: canonicalTranscript.model,
            rerankModel,
            viralityModel: process.env.OPENROUTER_VIRALITY_MODEL ?? 'google/gemini-3.1-flash-lite-preview',
            transcriptPrecision: canonicalTranscript.precision,
            candidatesGenerated: generatedCandidates.length,
            candidatesReranked: selectedCandidatePairs.length,
            lowPrecisionWarning: getLowPrecisionWarning(canonicalTranscript),
          },
        };
      }
      clipsToCreate = filtered;
    } else {
      // 'append' — keep everything, create all new candidates as-is
      logger.info('Auto-highlights append mode: appending all candidates without dedup', {
        assetId,
        projectId: asset.projectId,
        existingCount: existingClipsBefore.length,
        candidateCount: extractedClips.length,
      });
    }

    // Step 6: Analyze virality for each clip
    logger.info('Analyzing virality for clips', {
      clipCount: clipsToCreate.length,
    });

    const viralityAnalyses = await viralityService.analyzeClips(
      clipsToCreate.map((clip, index) => ({
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
    const enhancementAnalyses = new Map<string, EnhancementData>();
    if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
      logger.info('Analyzing transcript quality (Phase 1 enhancement)', {
        segmentCount: transcriptionResult.segments.length,
      });

      for (let i = 0; i < clipsToCreate.length; i++) {
        const clip = clipsToCreate[i];
        const segments = transcriptionResult.segments.filter((seg) => {
          const segStartMs = seg.start * 1000;
          const segEndMs = seg.end * 1000;
          return segEndMs > clip.startMs && segStartMs < clip.endMs;
        });

        if (segments.length > 0) {
          try {
            const enhancement: TranscriptEnhancement = await transcriptEnhancementService.analyzeTranscript(
              segments,
              clip.endMs - clip.startMs
            );
            enhancementAnalyses.set(`segment-${i}`, {
              fillerPercentage: enhancement.fillerAnalysis.fillerPercentage,
              wordsPerSecond: enhancement.pacingAnalysis.wordsPerSecond,
              energyProfile: enhancement.pacingAnalysis.energyProfile,
              qualityScore: enhancement.overallQuality.score,
              hasDeadAir: enhancement.pauseAnalysis.hasExcessiveDeadAir,
              pauseCount: enhancement.pauseAnalysis.totalPauses,
              issues: enhancement.overallQuality.issues,
              strengths: enhancement.overallQuality.strengths,
            });
          } catch (error) {
            logger.warn('Failed to analyze transcript quality for clip', {
              clipIndex: i,
              error,
            });
          }
        }
      }
    }

    // Step 8: Create clips in database (with SRT captions from transcript segments)
    const createdClips: Clip[] = [];

    for (let i = 0; i < clipsToCreate.length; i++) {
      const extractedClip = clipsToCreate[i];
      const viralityAnalysis = viralityAnalyses.get(`segment-${i}`);
      const enhancement = enhancementAnalyses.get(`segment-${i}`);
      const qualitySignals =
        extractedClip.qualitySignals ??
        analyzeClipQuality({
          startMs: extractedClip.startMs,
          endMs: extractedClip.endMs,
          transcriptionSegments: transcriptionResult.segments,
          sceneCutsMs,
        });
      const reframePlans = buildClipReframePlans({
        geometry: sourceGeometry,
        qualitySignals,
      });
      const blendedScore = blendViralityScore(viralityAnalysis?.score, qualitySignals.overallScore);

      const viralityFactors: ClipViralityFactors = {
        hookStrength: viralityAnalysis?.factors.hookStrength ?? 0,
        emotionalPeak: viralityAnalysis?.factors.emotionalPeak ?? 0,
        storyArc: viralityAnalysis?.factors.storyArc ?? 0,
        pacing: viralityAnalysis?.factors.pacing ?? 0,
        transcriptQuality: viralityAnalysis?.factors.transcriptQuality ?? 0,
        shareability: viralityAnalysis?.factors.shareability,
        reasoning: viralityAnalysis?.reasoning,
        improvements: viralityAnalysis?.improvements ?? [],
        enhancement: enhancement || undefined,
        qualitySignals,
        reframePlans,
        metadata: {
          aiScore: viralityAnalysis?.score ?? null,
          deterministicScore: qualitySignals.overallScore,
          selectionScore: extractedClip.selectionScore ?? qualitySignals.overallScore,
          llmScore: extractedClip.llmScore,
          candidateId: extractedClip.candidate.id,
          candidateType: extractedClip.candidate.candidateType,
          candidateReasons: extractedClip.candidate.reasons,
          viralReason: extractedClip.viralReason,
          editingNotes: extractedClip.editingNotes,
          platformFit: extractedClip.platformFit,
          boundaryConfidence: extractedClip.boundary.confidence,
          boundaryPrecision: extractedClip.boundary.precision,
          boundaryReasons: extractedClip.boundary.boundaryReasons,
          providerTranscription: 'openai',
          providerReasoning: 'openrouter',
          sourceGeometry,
        },
      };

      const captionSrt = this.buildClipCaptionSrt(
        transcriptionResult,
        extractedClip.startMs,
        extractedClip.endMs
      );

      const clip = await this.clipRepo.create({
        projectId: asset.projectId,
        assetId: asset.id,
        startMs: extractedClip.startMs,
        endMs: extractedClip.endMs,
        title: extractedClip.title,
        summary: extractedClip.hook,
        callToAction: extractedClip.callToAction,
        viralityScore: blendedScore,
        viralityFactors,
        ...(captionSrt && { captionSrt }),
      });

      createdClips.push(clip);
    }

    // Step 8.5: Generate preview videos and thumbnails for all clips
    logger.info('Generating preview videos and thumbnails for clips', {
      clipCount: createdClips.length,
    });

    // Ensure output directories exist
    const previewsDir = path.join(process.cwd(), 'public', 'uploads', 'previews', asset.projectId);
    await fs.mkdir(previewsDir, { recursive: true });

    // Reuse the materialized source from earlier — we already paid the
    // download cost (if any) at the top of this method.
    const sourceVideoPath = sourcePath ?? null;
    const previewFailureReasons: PreviewGenerationFailure[] = [];
    const previewGeneratedClipIds = new Set<string>();

    logger.info('Source video path resolved', {
      assetPath: asset.storagePath || asset.path,
      resolvedPath: sourceVideoPath,
      projectId: asset.projectId,
    });

    if (!sourceVideoPath) {
      const reason = 'Source video file not found on local storage; preview generation skipped.';
      previewFailureReasons.push(
        ...createdClips.map((clip) => ({
          clipId: clip.id,
          stage: 'source_resolution' as const,
          reason,
        }))
      );
      logger.error('Failed to resolve source video path for previews', {
        assetId,
        projectId: asset.projectId,
        candidates: [asset.storagePath, asset.path].filter(Boolean),
      });
    }

    // Generate preview videos and thumbnails with bounded FFmpeg concurrency.
    if (sourceVideoPath) {
      await runWithConcurrencyLimit(createdClips, PREVIEW_CONCURRENCY_LIMIT, async (clip) => {
        let failureStage: PreviewGenerationFailure['stage'] = 'preview';
        try {
          // Generate preview video filename
          const previewFilename = `clip-${clip.id}-${nanoid(8)}.mp4`;
          const previewOutputPath = path.join(previewsDir, previewFilename);
          const previewPublicUrl = `/uploads/previews/${asset.projectId}/${previewFilename}`;

          // Extract video clip
          const previewReframePlan = selectBestReframePlan(
            clip.viralityFactors?.reframePlans,
            PREVIEW_TARGET_RATIO
          );

          await this.videoExtractionService.extractClip({
            inputPath: sourceVideoPath,
            startMs: clip.startMs,
            endMs: clip.endMs,
            outputPath: previewOutputPath,
            preset: PREVIEW_PRESET,
            reframePlan: previewReframePlan,
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
            previewFailureReasons.push({
              clipId: clip.id,
              stage: 'thumbnail',
              reason: thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError),
            });
            logger.warn('Failed to generate thumbnail for clip', {
              clipId: clip.id,
              error: thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError),
            });
          }

          // Update clip with preview path and thumbnail
          failureStage = 'database_update';
          await this.clipRepo.update(clip.id, {
            previewPath: previewPublicUrl,
            ...(thumbnailUrl && { thumbnail: thumbnailUrl }),
          });
          previewGeneratedClipIds.add(clip.id);
        } catch (error) {
          previewFailureReasons.push({
            clipId: clip.id,
            stage: failureStage,
            reason: error instanceof Error ? error.message : String(error),
          });
          logger.error('Failed to generate preview for clip', {
            clipId: clip.id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue without preview - log error but don't fail the entire process
        }
      });
    }

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
      mode,
      existingClipsDeleted,
      skippedDueToOverlap,
      previewsGenerated: previewGeneratedClipIds.size,
      previewFailures: previewFailureReasons.length,
    });

    // existingClipsPreserved counts pre-existing clips left intact in non-replace modes.
    // In replace mode all existing clips were deleted, so 0.
    const existingClipsPreserved = mode === 'replace' ? 0 : existingClipsBefore.length;

    // Cleanup the materialized tempfile (no-op for local-driver assets).
    await materialized?.cleanup();

    return {
      assetId,
      clips: updatedClips,
      analytics: {
        transcriptionGenerated,
        suggestionsReceived: selectedCandidatePairs.length,
        clipsCreated: createdClips.length,
        averageViralityScore,
        mode,
        existingClipsDeleted,
        skippedDueToOverlap,
        existingClipsPreserved,
        previewsGenerated: previewGeneratedClipIds.size,
        previewFailures: previewFailureReasons.length,
        previewFailureReasons,
        providerTranscription: 'openai',
        providerReasoning: 'openrouter',
        transcriptionModel: canonicalTranscript.model,
        rerankModel,
        viralityModel: process.env.OPENROUTER_VIRALITY_MODEL ?? 'google/gemini-3.1-flash-lite-preview',
        transcriptPrecision: canonicalTranscript.precision,
        candidatesGenerated: generatedCandidates.length,
        candidatesReranked: selectedCandidatePairs.length,
        lowPrecisionWarning: getLowPrecisionWarning(canonicalTranscript) ?? rerankWarnings[0] ?? null,
      },
    };
  }

  private buildClipCaptionSrt(
    transcription: { segments?: TranscriptionSegment[] },
    clipStartMs: number,
    clipEndMs: number
  ): string | undefined {
    if (!transcription.segments || transcription.segments.length === 0) {
      return undefined;
    }

    const clipStartSec = clipStartMs / 1000;
    const clipEndSec = clipEndMs / 1000;
    const overlapping = transcription.segments.filter(
      (seg) => seg.end > clipStartSec && seg.start < clipEndSec
    );

    if (overlapping.length === 0) {
      return undefined;
    }

    const dedupedWords: Array<{ word: string; start: number; end: number }> = [];
    const seen = new Set<string>();

    for (const segment of overlapping) {
      if (!segment.words || segment.words.length === 0) {
        continue;
      }

      for (const word of segment.words) {
        if (word.end <= clipStartSec || word.start >= clipEndSec) {
          continue;
        }

        const start = Math.max(clipStartSec, word.start);
        const end = Math.min(clipEndSec, word.end);
        if (end <= start) {
          continue;
        }

        const text = word.word?.trim();
        if (!text) {
          continue;
        }

        const key = `${start.toFixed(3)}|${end.toFixed(3)}|${text.toLowerCase()}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        dedupedWords.push({ word: text, start, end });
      }
    }

    dedupedWords.sort((a, b) => a.start - b.start || a.end - b.end);

    if (dedupedWords.length > 0) {
      const wordsPerCue = this.getAdaptiveWordsPerCue(dedupedWords, clipStartSec, clipEndSec);
      const entries: CaptionEntry[] = [];

      for (let i = 0; i < dedupedWords.length; i += wordsPerCue) {
        const chunk = dedupedWords.slice(i, i + wordsPerCue);
        const first = chunk[0];
        const last = chunk[chunk.length - 1];

        const startMs = Math.max(0, Math.round((first.start - clipStartSec) * 1000));
        const endMs = Math.max(
          startMs + 120,
          Math.round((last.end - clipStartSec) * 1000)
        );
        const text = chunk.map((word) => word.word).join(" ").trim();

        if (!text) {
          continue;
        }

        entries.push({
          index: entries.length + 1,
          startMs,
          endMs,
          text,
        });
      }

      if (entries.length > 0) {
        return buildSRT(entries);
      }
    }

    const fallbackEntries: CaptionEntry[] = overlapping
      .map((segment) => {
        const startSec = Math.max(clipStartSec, segment.start);
        const endSec = Math.min(clipEndSec, segment.end);
        const text = segment.text.trim();
        if (!text || endSec <= startSec) {
          return null;
        }

        return {
          index: 0,
          startMs: Math.max(0, Math.round((startSec - clipStartSec) * 1000)),
          endMs: Math.max(1, Math.round((endSec - clipStartSec) * 1000)),
          text,
        } satisfies CaptionEntry;
      })
      .filter((entry): entry is CaptionEntry => entry !== null)
      .map((entry, index) => ({
        ...entry,
        index: index + 1,
      }));

    return fallbackEntries.length > 0 ? buildSRT(fallbackEntries) : undefined;
  }

  private getAdaptiveWordsPerCue(
    words: Array<{ start: number; end: number }>,
    clipStartSec: number,
    clipEndSec: number
  ): number {
    const firstStart = words[0]?.start ?? clipStartSec;
    const lastEnd = words[words.length - 1]?.end ?? clipEndSec;
    const spokenDurationSec = Math.max(
      1,
      Math.min(clipEndSec, lastEnd) - Math.max(clipStartSec, firstStart)
    );
    const wordsPerSecond = words.length / spokenDurationSec;

    if (wordsPerSecond < 1.8) return 3;
    if (wordsPerSecond < 2.7) return 4;
    if (wordsPerSecond < 3.6) return 5;
    if (wordsPerSecond < 4.5) return 6;
    return 7;
  }
}
