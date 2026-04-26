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
import { getLocalUploadDir } from "@/lib/storage";
import { probeVideoGeometry } from "@/lib/ffmpeg";
import {
  generateStableSmartReframePlan,
  generateDynamicSmartReframePlan,
  buildViralityFactorsPatch,
} from "@/lib/media/smart-reframe";
import type { SmartReframeMode } from "@/lib/media/smart-reframe";
import path from "path";
import { promises as fs } from "fs";

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

    // Resolve source file path
    const asset = clip.assetId ? await assetRepo.findById(clip.assetId) : null;
    const uploadDir = getLocalUploadDir();

    const sourcePath = await resolveLocalPath(
      [asset?.storagePath, asset?.path],
      uploadDir
    );

    if (!sourcePath) {
      return ApiResponseBuilder.badRequest(
        "Source asset file not found on local storage. Upload the source video first."
      );
    }

    // Probe source geometry
    let sourceWidth = 1920;
    let sourceHeight = 1080;
    try {
      const geometry = await probeVideoGeometry(sourcePath);
      sourceWidth = geometry.width;
      sourceHeight = geometry.height;
    } catch (err) {
      logger.warn("smart-reframe: geometry probe failed, using defaults", {
        clipId,
        error: err instanceof Error ? err.message : String(err),
      });
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
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveLocalPath(
  candidates: Array<string | null | undefined>,
  uploadDir: string
): Promise<string | null> {
  for (const raw of candidates) {
    if (!raw) continue;
    const candidate = raw.trim();

    const attempts: string[] = [];
    if (path.isAbsolute(candidate)) attempts.push(candidate);
    if (candidate.startsWith("/api/uploads/")) {
      attempts.push(path.join(uploadDir, candidate.slice("/api/uploads/".length)));
    }
    if (candidate.startsWith("/uploads/")) {
      attempts.push(path.join(uploadDir, candidate.slice("/uploads/".length)));
    }
    if (!candidate.startsWith("http")) {
      attempts.push(path.resolve(process.cwd(), candidate));
    }

    for (const p of attempts) {
      try {
        await fs.access(p);
        return p;
      } catch {
        // try next
      }
    }
  }
  return null;
}
