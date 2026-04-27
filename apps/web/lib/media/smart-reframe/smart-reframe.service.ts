/**
 * Smart Reframe Service — Phase 1
 *
 * Public API for computing a stable smart reframe plan for a clip.
 *
 * The plan is designed to be stored in:
 *   clip.viralityFactors.metadata.smartReframe
 *
 * And to immediately improve the crop in the existing pipeline by patching the
 * clip's viralityFactors.reframePlans[].safeZone so the FFmpeg crop formula
 * in buildPresetVideoFilter() picks the right horizontal (and vertical) position.
 * No schema migration is required.
 */

import { logger } from "@/lib/logger";
import type {
  SmartReframePlan,
  CaptionSafeZone,
  SmartReframeMode,
  SubjectPosition,
  TrackingSmoothness,
} from "./tracking-types";
import { getDefaultCaptionSafeZone } from "./safe-zones";
import { computeStableCropWindow, cropWindowToSafeZone } from "./crop-window";
import { sampleAndDetect } from "./face-person-tracker";
import { createDetectionProvider, getSmartReframeDetectorProviderPreference } from "./vision-api-detector";
import { buildDynamicPlanFromStableFallback, generateDynamicCropPathFromDetections } from "./dynamic-tracking";
import type { ClipReframePlan, ClipReframeTracking, ViralityFactors } from "@/lib/types";
import {
  detectClipWithCvWorker,
  getCvWorkerBaseUrl,
  trackSubjectWithCvWorker,
  type CvClipDetectionResponse,
} from "@/lib/media/cv-worker-client";
import type { AggregatedDetections, DetectionBox } from "./tracking-types";

// Target dimensions for 9:16 short-form export
const DEFAULT_TARGET_WIDTH = 1080;
const DEFAULT_TARGET_HEIGHT = 1920;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateSmartReframeInput {
  sourcePath: string;
  clipStartMs: number;
  clipEndMs: number;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth?: number;
  targetHeight?: number;
  mode?: SmartReframeMode;
  captionSafeZone?: CaptionSafeZone;
  trackingSmoothness?: TrackingSmoothness;
  subjectPosition?: SubjectPosition;
}

// ── Main service function ─────────────────────────────────────────────────────

function cvDetectionsToAggregated(detections: CvClipDetectionResponse): AggregatedDetections {
  return {
    totalFrames: detections.frames.length,
    faceBoxes: detections.frames.flatMap((frame, frameIndex) =>
      frame.faces.map((box) => ({ box: box as DetectionBox, frameIndex }))
    ),
    personBoxes: detections.frames.flatMap((frame, frameIndex) =>
      frame.persons.map((box) => ({ box: box as DetectionBox, frameIndex }))
    ),
  };
}

async function tryDetectClipWithCvWorker(params: {
  sourcePath: string;
  clipStartMs: number;
  clipEndMs: number;
  mode: SmartReframeMode;
  timeoutMs?: number;
}): Promise<AggregatedDetections | null> {
  const preference = getSmartReframeDetectorProviderPreference();
  if (preference === "openrouter" || preference === "fallback" || !getCvWorkerBaseUrl()) {
    return null;
  }

  try {
    const detectionResult = await detectClipWithCvWorker(
      {
        sourcePath: params.sourcePath,
        clipStartMs: params.clipStartMs,
        clipEndMs: params.clipEndMs,
        sampleIntervalMs: Number(process.env.SMART_REFRAME_SAMPLE_INTERVAL_MS ?? 750),
        maxFrames: Number(process.env.SMART_REFRAME_MAX_FRAMES ?? 24),
        detectFaces: params.mode !== "smart_person" && params.mode !== "dynamic_person",
        detectPersons: params.mode !== "smart_face" && params.mode !== "dynamic_face",
      },
      { timeoutMs: params.timeoutMs ?? 45_000 }
    );

    if (!detectionResult || detectionResult.frames.length === 0) {
      logger.warn("smart-reframe: CV worker returned no detection frames", {
        mode: params.mode,
        fallbackReason: detectionResult?.fallbackReason,
      });
      return null;
    }

    const aggregated = cvDetectionsToAggregated(detectionResult);
    const detectionCount = aggregated.faceBoxes.length + aggregated.personBoxes.length;
    if (detectionCount === 0) {
      logger.warn("smart-reframe: CV worker returned sampled frames with no usable detections; falling back", {
        mode: params.mode,
        provider: detectionResult.provider,
        sampledFrames: aggregated.totalFrames,
        fallbackReason: detectionResult.fallbackReason,
      });
      return null;
    }

    logger.info("smart-reframe: CV worker detections received", {
      mode: params.mode,
      provider: detectionResult.provider,
      sampledFrames: aggregated.totalFrames,
      faceDetections: aggregated.faceBoxes.length,
      personDetections: aggregated.personBoxes.length,
      fallbackReason: detectionResult.fallbackReason,
    });
    return aggregated;
  } catch (error) {
    logger.warn("smart-reframe: CV worker detection failed", {
      mode: params.mode,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function tryGenerateDynamicPlanWithCvWorker(params: {
  sourcePath: string;
  clipStartMs: number;
  clipEndMs: number;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  mode: SmartReframeMode;
  safeZone: CaptionSafeZone;
  trackingSmoothness: TrackingSmoothness;
  subjectPosition: SubjectPosition;
}): Promise<SmartReframePlan | null> {
  const preference = getSmartReframeDetectorProviderPreference();
  if (preference === "openrouter" || preference === "fallback" || !getCvWorkerBaseUrl() || !params.mode.startsWith("dynamic_")) {
    return null;
  }

  try {
    const detectionResult = await detectClipWithCvWorker(
      {
        sourcePath: params.sourcePath,
        clipStartMs: params.clipStartMs,
        clipEndMs: params.clipEndMs,
        sampleIntervalMs: Number(process.env.SMART_REFRAME_SAMPLE_INTERVAL_MS ?? 750),
        maxFrames: Number(process.env.SMART_REFRAME_MAX_FRAMES ?? 24),
        detectFaces: params.mode !== "dynamic_person",
        detectPersons: params.mode !== "dynamic_face",
      },
      { timeoutMs: 45_000 }
    );

    if (!detectionResult || detectionResult.frames.length === 0) {
      return null;
    }

    const aggregated = cvDetectionsToAggregated(detectionResult);
    const detectionCount = aggregated.faceBoxes.length + aggregated.personBoxes.length;
    if (detectionCount === 0) {
      logger.warn("smart-reframe: CV worker dynamic analysis returned no usable detections", {
        mode: params.mode,
        provider: detectionResult.provider,
        sampledFrames: aggregated.totalFrames,
        fallbackReason: detectionResult.fallbackReason,
      });
      return null;
    }

    const stablePlan = computeStableCropWindow({
      aggregated,
      sourceWidth: params.sourceWidth,
      sourceHeight: params.sourceHeight,
      targetWidth: params.targetWidth,
      targetHeight: params.targetHeight,
      safeZone: params.safeZone,
      preferFaces: params.mode !== "dynamic_person",
      preferPersons: params.mode !== "dynamic_face",
    });

    const trackingResult = await trackSubjectWithCvWorker(
      {
        sourcePath: params.sourcePath,
        clipStartMs: params.clipStartMs,
        clipEndMs: params.clipEndMs,
        sourceWidth: params.sourceWidth,
        sourceHeight: params.sourceHeight,
        targetWidth: params.targetWidth,
        targetHeight: params.targetHeight,
        mode: params.mode as "dynamic_auto" | "dynamic_face" | "dynamic_person",
        smoothness: params.trackingSmoothness,
        subjectPosition: params.subjectPosition,
        detections: detectionResult.frames,
      },
      { timeoutMs: 20_000 }
    );

    const reliableDynamicPath =
      trackingResult &&
      trackingResult.cropPath.length >= Math.min(3, Math.max(1, detectionResult.frames.length)) &&
      trackingResult.confidence >= 0.35 &&
      trackingResult.primaryTrackLength >= 2;

    if (!trackingResult || !reliableDynamicPath) {
      logger.warn("smart-reframe: CV worker dynamic fallback to stable crop", {
        reason: trackingResult?.fallbackReason,
        confidence: trackingResult?.confidence,
        primaryTrackLength: trackingResult?.primaryTrackLength,
        sampledFrames: detectionResult.sampledFrames,
      });
      return buildDynamicPlanFromStableFallback(
        stablePlan,
        trackingResult?.fallbackReason ?? "CV worker dynamic tracking was not reliable enough."
      );
    }

    const representative = trackingResult.cropPath[Math.floor(trackingResult.cropPath.length / 2)];
    const plan: SmartReframePlan = {
      ...stablePlan,
      strategy: trackingResult.strategy,
      mode: "dynamic",
      confidence: trackingResult.confidence,
      cropWindow: {
        x: representative.x,
        y: representative.y,
        width: representative.width,
        height: representative.height,
      },
      cropPath: trackingResult.cropPath,
      sampledFrames: trackingResult.sampledFrames,
      faceDetections: trackingResult.faceDetections,
      personDetections: trackingResult.personDetections,
      primaryTrackLength: trackingResult.primaryTrackLength,
      fallbackReason: undefined,
      smoothing: params.trackingSmoothness,
      subjectPosition: params.subjectPosition,
    };

    logger.info("smart-reframe: CV worker dynamic plan computed", {
      strategy: plan.strategy,
      confidence: plan.confidence,
      sampledFrames: plan.sampledFrames,
      primaryTrackLength: plan.primaryTrackLength,
      cropPathLength: plan.cropPath?.length ?? 0,
      interpolatedKeyframes: trackingResult.interpolatedKeyframes ?? 0,
      fallbackKeyframes: trackingResult.fallbackKeyframes ?? 0,
      fallbackReason: trackingResult.fallbackReason,
    });

    return plan;
  } catch (error) {
    logger.warn("smart-reframe: CV worker dynamic analysis failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Generate a stable smart reframe plan for a clip segment.
 *
 * Never throws — falls back to center_crop if anything fails.
 */
export async function generateStableSmartReframePlan(
  input: GenerateSmartReframeInput
): Promise<SmartReframePlan> {
  const {
    sourcePath,
    clipStartMs,
    clipEndMs,
    sourceWidth,
    sourceHeight,
    targetWidth = DEFAULT_TARGET_WIDTH,
    targetHeight = DEFAULT_TARGET_HEIGHT,
    mode = "smart_auto",
    captionSafeZone,
  } = input;

  const targetRatio = targetWidth / targetHeight;
  const safeZone = captionSafeZone ?? getDefaultCaptionSafeZone(targetRatio);

  // Determine detection preferences based on mode
  const preferFaces = mode === "smart_auto" || mode === "smart_face";
  const preferPersons = mode === "smart_auto" || mode === "smart_person";

  // center_crop / blurred_background: skip detection entirely
  if (mode === "center_crop" || mode === "blurred_background") {
    return computeStableCropWindow({
      aggregated: { faceBoxes: [], personBoxes: [], totalFrames: 0 },
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      safeZone,
      preferFaces: false,
      preferPersons: false,
    });
  }

  const provider = createDetectionProvider();

  try {
    const preference = getSmartReframeDetectorProviderPreference();
    const cvAggregated = await tryDetectClipWithCvWorker({
      sourcePath,
      clipStartMs,
      clipEndMs,
      mode,
    });
    const aggregated =
      cvAggregated ??
      (preference === "fallback"
        ? { faceBoxes: [], personBoxes: [], totalFrames: 0 }
        : await sampleAndDetect({
            sourcePath,
            startMs: clipStartMs,
            endMs: clipEndMs,
            provider,
          }));

    const plan = computeStableCropWindow({
      aggregated,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      safeZone,
      preferFaces,
      preferPersons,
    });

    logger.info("smart-reframe: plan computed", {
      strategy: plan.strategy,
      confidence: plan.confidence,
      sampledFrames: plan.sampledFrames,
      faceDetections: plan.faceDetections,
      personDetections: plan.personDetections,
      cropWindow: plan.cropWindow,
      fallbackReason: plan.fallbackReason,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      mode,
    });

    return plan;
  } catch (err) {
    const fallbackReason = `Detection pipeline error: ${err instanceof Error ? err.message : String(err)}`;
    logger.warn("smart-reframe: falling back to center_crop", { fallbackReason });

    return computeStableCropWindow({
      aggregated: { faceBoxes: [], personBoxes: [], totalFrames: 0 },
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      safeZone,
      preferFaces: false,
      preferPersons: false,
    });
  }
}

/**
 * Generate a dynamic smart reframe plan with crop keyframes.
 *
 * Exports still have a stable fallback path: the 9:16 ClipReframePlan is patched
 * from the median/first dynamic window, and the full cropPath is also copied
 * into the ClipReframePlan so FFmpeg can render dynamic crop keyframes.
 */
export async function generateDynamicSmartReframePlan(
  input: GenerateSmartReframeInput
): Promise<SmartReframePlan> {
  const {
    sourcePath,
    clipStartMs,
    clipEndMs,
    sourceWidth,
    sourceHeight,
    targetWidth = DEFAULT_TARGET_WIDTH,
    targetHeight = DEFAULT_TARGET_HEIGHT,
    mode = "dynamic_auto",
    captionSafeZone,
    trackingSmoothness = "medium",
    subjectPosition = "center",
  } = input;

  const targetRatio = targetWidth / targetHeight;
  const safeZone = captionSafeZone ?? getDefaultCaptionSafeZone(targetRatio);
  const provider = createDetectionProvider();

  try {
    const cvWorkerPlan = await tryGenerateDynamicPlanWithCvWorker({
      sourcePath,
      clipStartMs,
      clipEndMs,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      mode,
      safeZone,
      trackingSmoothness,
      subjectPosition,
    });
    if (cvWorkerPlan) {
      return cvWorkerPlan;
    }

    const aggregated = await sampleAndDetect({
      sourcePath,
      startMs: clipStartMs,
      endMs: clipEndMs,
      provider,
    });

    const stablePlan = computeStableCropWindow({
      aggregated,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      safeZone,
      preferFaces: mode !== "dynamic_person",
      preferPersons: mode !== "dynamic_face",
    });

    const dynamicResult = generateDynamicCropPathFromDetections({
      aggregated,
      clipStartMs,
      clipEndMs,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      safeZone,
      mode,
      smoothness: trackingSmoothness,
      subjectPosition,
    });

    const reliableDynamicPath =
      dynamicResult.cropPath.length >= Math.min(3, Math.max(1, aggregated.totalFrames)) &&
      dynamicResult.confidence >= 0.35 &&
      dynamicResult.primaryTrackLength >= 2;

    if (!reliableDynamicPath) {
      const reason =
        dynamicResult.fallbackReason ??
        `Dynamic tracking confidence too low (${dynamicResult.confidence.toFixed(2)}). Using stable smart crop.`;
      logger.warn("smart-reframe: dynamic fallback to stable crop", {
        mode,
        reason,
        confidence: dynamicResult.confidence,
        primaryTrackLength: dynamicResult.primaryTrackLength,
        sampledFrames: aggregated.totalFrames,
      });
      return buildDynamicPlanFromStableFallback(stablePlan, reason);
    }

    const representative = dynamicResult.cropPath[Math.floor(dynamicResult.cropPath.length / 2)];
    const plan: SmartReframePlan = {
      ...stablePlan,
      strategy: dynamicResult.strategy,
      mode: "dynamic",
      confidence: Math.min(1, dynamicResult.confidence),
      cropWindow: {
        x: representative.x,
        y: representative.y,
        width: representative.width,
        height: representative.height,
      },
      cropPath: dynamicResult.cropPath,
      fallbackReason: undefined,
      primaryTrackLength: dynamicResult.primaryTrackLength,
      smoothing: trackingSmoothness,
      subjectPosition,
    };

    logger.info("smart-reframe: dynamic plan computed", {
      strategy: plan.strategy,
      mode: plan.mode,
      confidence: plan.confidence,
      sampledFrames: plan.sampledFrames,
      primaryTrackLength: plan.primaryTrackLength,
      faceDetections: plan.faceDetections,
      personDetections: plan.personDetections,
      smoothing: trackingSmoothness,
      subjectPosition,
      cropPathLength: plan.cropPath?.length ?? 0,
    });

    return plan;
  } catch (err) {
    const reason = `Dynamic detection pipeline error: ${err instanceof Error ? err.message : String(err)}`;
    logger.warn("smart-reframe: dynamic pipeline failed; using stable crop", { reason });
    const stable = await generateStableSmartReframePlan({
      sourcePath,
      clipStartMs,
      clipEndMs,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      mode: "smart_auto",
      captionSafeZone: safeZone,
    });
    return buildDynamicPlanFromStableFallback(stable, reason);
  }
}

// ── Integration helpers ───────────────────────────────────────────────────────

function createDynamicTrackingPatch(
  smartPlan: SmartReframePlan
): { safeZone: ClipReframePlan["safeZone"]; tracking?: ClipReframeTracking } | null {
  const cropPath = smartPlan.cropPath;
  if (smartPlan.mode !== "dynamic" || !cropPath || cropPath.length < 2) {
    return null;
  }

  const first = cropPath[0];
  const last = cropPath[cropPath.length - 1];
  const firstCenterX = (first.x + first.width / 2) / smartPlan.sourceWidth;
  const firstCenterY = (first.y + first.height / 2) / smartPlan.sourceHeight;
  const lastCenterX = (last.x + last.width / 2) / smartPlan.sourceWidth;
  const lastCenterY = (last.y + last.height / 2) / smartPlan.sourceHeight;
  const deltaX = lastCenterX - firstCenterX;
  const deltaY = lastCenterY - firstCenterY;
  const axis: ClipReframeTracking["axis"] =
    Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
  const travel = axis === "horizontal" ? Math.abs(deltaX) : Math.abs(deltaY);

  if (travel < 0.015) {
    return {
      safeZone: cropWindowToSafeZone(smartPlan.cropWindow, smartPlan.sourceWidth, smartPlan.sourceHeight),
      tracking: {
        axis: "static",
        travel: 0,
        lockStrength: Math.max(0.25, smartPlan.confidence),
        easing: "ease_in_out",
      },
    };
  }

  const baseWindow = { ...smartPlan.cropWindow };
  if (axis === "horizontal") {
    const midpointX = ((firstCenterX + lastCenterX) / 2) * smartPlan.sourceWidth;
    baseWindow.x = Math.round(
      Math.min(
        Math.max(0, midpointX - baseWindow.width / 2),
        Math.max(0, smartPlan.sourceWidth - baseWindow.width)
      )
    );
  } else {
    const midpointY = ((firstCenterY + lastCenterY) / 2) * smartPlan.sourceHeight;
    baseWindow.y = Math.round(
      Math.min(
        Math.max(0, midpointY - baseWindow.height / 2),
        Math.max(0, smartPlan.sourceHeight - baseWindow.height)
      )
    );
  }

  return {
    safeZone: cropWindowToSafeZone(baseWindow, smartPlan.sourceWidth, smartPlan.sourceHeight),
    tracking: {
      axis,
      travel: Math.min(0.5, travel),
      lockStrength: Math.min(1, Math.max(0.35, smartPlan.confidence)),
      easing: "ease_in_out",
    },
  };
}

/**
 * Apply a SmartReframePlan to the existing ClipReframePlan[] array.
 *
 * Patches the 9:16 plan's safeZone so the existing buildPresetVideoFilter()
 * in ffmpeg.ts immediately uses the detected subject center. Also updates
 * anchor to "speaker" and mode to "speaker_focus" so the crop expression
 * activates (letterbox mode ignores safeZone).
 *
 * Call this after generating a plan to update viralityFactors.reframePlans
 * before persisting to the database.
 */
export function applySmartReframeToPlan(
  reframePlans: ClipReframePlan[],
  smartPlan: SmartReframePlan
): ClipReframePlan[] {
  return reframePlans.map((plan) => {
    if (plan.ratio !== "9:16") return plan;

    // Only patch if we actually detected something useful
    if (smartPlan.strategy === "center_crop" && !smartPlan.fallbackReason) {
      // Explicit center crop request — keep safeZone at geometric center
      return { ...plan, anchor: "center" as const, mode: "center_crop" as const };
    }

    const dynamicTracking = createDynamicTrackingPatch(smartPlan);
    const newSafeZone = dynamicTracking?.safeZone ?? cropWindowToSafeZone(
      smartPlan.cropWindow,
      smartPlan.sourceWidth,
      smartPlan.sourceHeight
    );

    return {
      ...plan,
      mode: "speaker_focus" as const,  // activates the crop expression in buildPresetVideoFilter
      anchor: "speaker" as const,
      safeZone: newSafeZone,
      tracking: dynamicTracking?.tracking ?? plan.tracking,
      dynamicCropPath:
        smartPlan.mode === "dynamic" && smartPlan.cropPath?.length
          ? smartPlan.cropPath.map((keyframe) => ({ ...keyframe }))
          : undefined,
      dynamicCropSource:
        smartPlan.mode === "dynamic" && smartPlan.cropPath?.length
          ? {
              width: smartPlan.sourceWidth,
              height: smartPlan.sourceHeight,
            }
          : undefined,
      reasoning: `Smart reframe: ${smartPlan.strategy} (confidence ${(smartPlan.confidence * 100).toFixed(0)}%). ` +
        (smartPlan.mode === "dynamic" ? "Dynamic crop tracking enabled. " : "") +
        (smartPlan.fallbackReason ? `Fallback: ${smartPlan.fallbackReason}` : ""),
    };
  });
}

/**
 * Produce a ViralityFactors patch that stores the SmartReframePlan in metadata
 * and updates reframePlans[].
 *
 * Usage:
 *   const patch = buildViralityFactorsPatch(clip.viralityFactors, smartPlan);
 *   await clipRepo.update(clipId, { viralityFactors: patch });
 */
export function buildViralityFactorsPatch(
  existing: ViralityFactors | undefined | null,
  smartPlan: SmartReframePlan
): ViralityFactors {
  const base: ViralityFactors = existing ?? {
    hookStrength: 0,
    emotionalPeak: 0,
    storyArc: 0,
    pacing: 0,
    transcriptQuality: 0,
    reframePlans: [],
    metadata: {},
  };

  const updatedReframePlans = applySmartReframeToPlan(
    base.reframePlans ?? [],
    smartPlan
  );

  return {
    ...base,
    reframePlans: updatedReframePlans,
    metadata: {
      ...(base.metadata ?? {}),
      smartReframe: smartPlan,
    },
  };
}
