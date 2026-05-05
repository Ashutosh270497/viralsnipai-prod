export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { container } from "@/lib/infrastructure/di/container";
import { TYPES } from "@/lib/infrastructure/di/types";
import type { IClipRepository } from "@/lib/domain/repositories/IClipRepository";
import type { IAssetRepository } from "@/lib/domain/repositories/IAssetRepository";
import type { IProjectRepository } from "@/lib/domain/repositories/IProjectRepository";
import { withErrorHandling } from "@/lib/utils/error-handler";
import { ApiResponseBuilder } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { probeVideoGeometry } from "@/lib/ffmpeg";
import { materializeMediaLocally } from "@/lib/media/media-path-resolver";
import {
  generateStableSmartReframePlan,
  generateDynamicSmartReframePlan,
  buildViralityFactorsPatch,
} from "@/lib/media/smart-reframe";
import type { SmartReframeMode } from "@/lib/media/smart-reframe";

const SMART_REFRAME_MODES = [
  "smart_auto",
  "smart_face",
  "smart_person",
  "dynamic_auto",
  "dynamic_face",
  "dynamic_person",
  "center_crop",
  "blurred_background",
] as const;

const analyzeSchema = z.object({
  mode: z.enum(SMART_REFRAME_MODES).default("smart_auto"),
  trackingSmoothness: z.enum(["low", "medium", "high"]).default("medium"),
  subjectPosition: z.enum(["center", "slightly_up", "slightly_down"]).default("center"),
  captionSafeZoneEnabled: z.boolean().default(true),
});

/**
 * POST /api/clips/:clipId/reframe/analyze
 *
 * Triggers smart reframe analysis for a clip:
 *   1. Samples frames from the source asset at the clip's time range
 *   2. Detects faces/persons using the Vision API (or falls back to center crop)
 *   3. Computes a stable crop window
 *   4. Updates clip.viralityFactors.reframePlans[9:16].safeZone
 *   5. Stores the full SmartReframePlan in clip.viralityFactors.metadata.smartReframe
 *
 * Body: { mode: SmartReframeMode, captionSafeZoneEnabled: boolean }
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized("Authentication required");
    }

    const json = await request.json().catch(() => ({}));
    const parsed = analyzeSchema.safeParse(json);
    if (!parsed.success) {
      return ApiResponseBuilder.badRequest("Invalid request body", {
        errors: parsed.error.flatten(),
      });
    }

    const { mode, captionSafeZoneEnabled, trackingSmoothness, subjectPosition } = parsed.data;
    const clipId = params.id;

    // Load repositories
    const clipRepo = container.get<IClipRepository>(TYPES.IClipRepository);
    const assetRepo = container.get<IAssetRepository>(TYPES.IAssetRepository);
    const projectRepo = container.get<IProjectRepository>(TYPES.IProjectRepository);

    // Validate clip ownership
    const clip = await clipRepo.findById(clipId);
    if (!clip) return ApiResponseBuilder.notFound("Clip not found");

    const project = await projectRepo.findById(clip.projectId);
    if (!project || project.userId !== user.id) {
      return ApiResponseBuilder.forbidden("Access denied");
    }

    // Resolve source file path. For S3-stored assets this materializes a
    // temp file we MUST clean up — the try/finally below guarantees that
    // even if probeVideoGeometry / generateSmartReframePlan throws.
    const asset = clip.assetId ? await assetRepo.findById(clip.assetId) : null;
    const materialized = await materializeMediaLocally([asset?.storagePath, asset?.path]);

    if (!materialized) {
      return ApiResponseBuilder.badRequest(
        "Source asset file not found on local storage or remote storage. Upload the source video first."
      );
    }
    const sourcePath = materialized.localPath;

    try {
      // Probe source geometry
      let sourceWidth = asset?.sourceWidth ?? null;
      let sourceHeight = asset?.sourceHeight ?? null;
      if (!sourceWidth || !sourceHeight) {
        try {
          const geometry = await probeVideoGeometry(sourcePath);
          sourceWidth = geometry.width;
          sourceHeight = geometry.height;
          if (asset) {
            await assetRepo.update(asset.id, {
              sourceWidth,
              sourceHeight,
            });
          }
        } catch (err) {
          logger.error("smart-reframe: geometry probe failed", {
            clipId,
            sourcePath,
            error: err instanceof Error ? err.message : String(err),
          });
          return ApiResponseBuilder.internalError(
            "Could not inspect source video geometry. Re-upload or retranscode the source video before smart reframe analysis.",
          );
        }
      }

      const reframeRequest = {
        mode,
        trackingSmoothness,
        subjectPosition,
        captionSafeZoneEnabled,
        startMs: clip.startMs,
        endMs: clip.endMs,
        sourceWidth,
        sourceHeight,
      };
      const existingMetadata =
        clip.viralityFactors?.metadata && typeof clip.viralityFactors.metadata === "object"
          ? (clip.viralityFactors.metadata as Record<string, unknown>)
          : {};
      if (JSON.stringify(existingMetadata.smartReframeRequest ?? null) === JSON.stringify(reframeRequest)) {
        const existingPlan = existingMetadata.smartReframe;
        if (existingPlan && typeof existingPlan === "object") {
          const cachedPlan = existingPlan as Record<string, unknown>;
          logger.info("smart-reframe: reusing cached analysis", {
            clipId,
            mode,
            sourceWidth,
            sourceHeight,
          });
          return ApiResponseBuilder.success(
            {
              clipId,
              cached: true,
              strategy: cachedPlan.strategy,
              mode: cachedPlan.mode,
              confidence: cachedPlan.confidence,
              cropPath: cachedPlan.cropPath ?? null,
              smartReframePlan: cachedPlan,
              sampledFrames: cachedPlan.sampledFrames,
              faceDetections: cachedPlan.faceDetections,
              personDetections: cachedPlan.personDetections,
              fallbackReason: cachedPlan.fallbackReason ?? null,
            },
            "Smart reframe analysis reused"
          );
        }
      }

      logger.info("smart-reframe: starting analysis", {
        clipId,
        assetId: clip.assetId,
        mode,
        sourcePath,
        sourceWidth,
        sourceHeight,
        startMs: clip.startMs,
        endMs: clip.endMs,
      });

      const analyzeStart = Date.now();

      // Generate the plan
      const isDynamic = mode.startsWith("dynamic_");
      const smartPlan = await (isDynamic ? generateDynamicSmartReframePlan : generateStableSmartReframePlan)({
        sourcePath,
        clipStartMs: clip.startMs,
        clipEndMs: clip.endMs,
        sourceWidth,
        sourceHeight,
        mode: mode as SmartReframeMode,
        trackingSmoothness,
        subjectPosition,
        // If captionSafeZoneEnabled is false, use a zero-margin safe zone
        captionSafeZone: captionSafeZoneEnabled ? undefined : {
          topPct: 0,
          bottomPct: 0,
          leftPct: 0,
          rightPct: 0,
          preferredCaptionY: "lower_third" as const,
        },
      });

      // Patch viralityFactors
      const updatedViralityFactors = buildViralityFactorsPatch(
        clip.viralityFactors,
        smartPlan
      );
      updatedViralityFactors.metadata = {
        ...(updatedViralityFactors.metadata ?? {}),
        smartReframeRequest: reframeRequest,
      };

      await clipRepo.update(clipId, { viralityFactors: updatedViralityFactors });

      logger.info("smart-reframe: analysis complete", {
        clipId,
        mode: smartPlan.mode,
        strategy: smartPlan.strategy,
        confidence: smartPlan.confidence,
        sampledFrames: smartPlan.sampledFrames,
        primaryTrackLength: smartPlan.primaryTrackLength,
        faceDetections: smartPlan.faceDetections,
        personDetections: smartPlan.personDetections,
        smoothing: smartPlan.smoothing,
        fallbackReason: smartPlan.fallbackReason,
        cropPathLength: smartPlan.cropPath?.length ?? 0,
        durationMs: Date.now() - analyzeStart,
      });

      return ApiResponseBuilder.success(
        {
          clipId,
          strategy: smartPlan.strategy,
          mode: smartPlan.mode,
          confidence: smartPlan.confidence,
          cropPath: smartPlan.cropPath ?? null,
          smartReframePlan: smartPlan,
          sampledFrames: smartPlan.sampledFrames,
          faceDetections: smartPlan.faceDetections,
          personDetections: smartPlan.personDetections,
          fallbackReason: smartPlan.fallbackReason ?? null,
        },
        "Smart reframe analysis complete"
      );
    } finally {
      await materialized.cleanup();
    }
  }
);
