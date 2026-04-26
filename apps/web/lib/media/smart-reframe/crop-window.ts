/**
 * Smart Reframe — Stable Crop Window Algorithm (Phase 1)
 *
 * Converts aggregated face/person detection results into a single stable
 * crop window for the entire clip. No dynamic tracking in Phase 1.
 */

import type {
  AggregatedDetections,
  DetectionBox,
  SmartReframePlan,
  SmartReframeStrategy,
  CaptionSafeZone,
} from "./tracking-types";
import { DEFAULT_SHORT_FORM_SAFE_ZONE } from "./safe-zones";

// ── Detection quality constants ──────────────────────────────────────────────

export const MIN_CONFIDENCE_FACE = 0.45;
export const MIN_CONFIDENCE_PERSON = 0.40;

// Where in the crop window the face center should appear (normalized 0-1 from top)
export const FACE_TARGET_Y_RATIO = 0.38;
export const PERSON_TARGET_Y_RATIO = 0.45;

// Safe horizontal anchor — centered unless detection says otherwise
export const HORIZONTAL_TARGET_X_RATIO = 0.50;

// Padding multipliers (how much space around the detection box to preserve)
export const BOX_PADDING_FACE = 1.8;
export const BOX_PADDING_PERSON = 1.25;

// Minimum detections required to trust the result
const MIN_DETECTION_FREQUENCY = 1;

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Weighted median of an array of values (weights sum > 0). */
function weightedMedian(values: Array<{ value: number; weight: number }>): number {
  if (values.length === 0) return 0.5;

  const sorted = [...values].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((s, v) => s + v.weight, 0);
  if (totalWeight <= 0) return sorted[Math.floor(sorted.length / 2)].value;

  let accumulated = 0;
  const half = totalWeight / 2;
  for (const item of sorted) {
    accumulated += item.weight;
    if (accumulated >= half) return item.value;
  }
  return sorted[sorted.length - 1].value;
}

/**
 * From a list of detection boxes (per-frame), compute a single "primary subject"
 * center position (normalized 0-1) and an aggregate confidence.
 *
 * Strategy:
 * 1. Filter by min confidence
 * 2. Prefer boxes that appear in many frames (frequency)
 * 3. Weighted median of center X/Y (weights = confidence * area)
 */
function aggregateBoxesToCenter(
  boxes: Array<{ box: DetectionBox; frameIndex: number }>,
  minConfidence: number
): { centerX: number; centerY: number; confidence: number; count: number } {
  const valid = boxes.filter((b) => b.box.confidence >= minConfidence);

  if (valid.length < MIN_DETECTION_FREQUENCY) {
    return { centerX: 0.5, centerY: 0.5, confidence: 0, count: 0 };
  }

  const weighted = valid.map(({ box }) => ({
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    weight: box.confidence * box.width * box.height, // area × confidence
    confidence: box.confidence,
  }));

  const centerX = weightedMedian(weighted.map((w) => ({ value: w.cx, weight: w.weight })));
  const centerY = weightedMedian(weighted.map((w) => ({ value: w.cy, weight: w.weight })));
  const confidence = weighted.reduce((s, w) => s + w.confidence, 0) / weighted.length;

  return { centerX, centerY, confidence, count: valid.length };
}

// ── Main algorithm ────────────────────────────────────────────────────────────

/**
 * Compute the crop window (in source pixels) that keeps the subject centered
 * in the output frame while respecting the caption safe zone.
 *
 * This mirrors the crop formula already used by buildPresetVideoFilter() in
 * ffmpeg.ts so the result is always consistent with the render output.
 */
export function computeCropPixels(params: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  subjectCenterX: number;  // 0-1 normalized in source
  subjectCenterY: number;  // 0-1 normalized in source
  targetYRatio: number;    // where in crop the subject should appear (0-1 from top)
}): { x: number; y: number; width: number; height: number } {
  const { sourceWidth, sourceHeight, targetWidth, targetHeight, subjectCenterX, subjectCenterY, targetYRatio } = params;
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;

  let cropWidth: number;
  let cropHeight: number;

  if (sourceRatio >= targetRatio) {
    // Landscape or wider: crop height fills source, crop horizontally
    cropHeight = sourceHeight;
    cropWidth = Math.round(sourceHeight * targetRatio);
  } else {
    // Portrait or taller: crop width fills source, crop vertically
    cropWidth = sourceWidth;
    cropHeight = Math.round(sourceWidth / targetRatio);
  }

  // Subject in pixels
  const subjectPxX = subjectCenterX * sourceWidth;
  const subjectPxY = subjectCenterY * sourceHeight;

  // Horizontal: center the crop on the subject
  let cropX = subjectPxX - cropWidth / 2;

  // Vertical: position crop so subject appears at targetYRatio from top
  // cropY + cropHeight * targetYRatio = subjectPxY
  // => cropY = subjectPxY - cropHeight * targetYRatio
  let cropY = subjectPxY - cropHeight * targetYRatio;

  // Clamp to source bounds
  cropX = clamp(Math.round(cropX), 0, sourceWidth - cropWidth);
  cropY = clamp(Math.round(cropY), 0, sourceHeight - cropHeight);

  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}

/**
 * Convert a pixel crop window to a normalized safe-zone point that the existing
 * ClipReframePlan / getPlanAnchorCenter() / buildPresetVideoFilter() pipeline
 * already understands.
 *
 * We encode the desired crop center as the safeZone center:
 *   safeZone.x + safeZone.width/2  = centerX_normalized
 *   safeZone.y + safeZone.height/2 = centerY_normalized
 */
export function cropWindowToSafeZone(
  cropWindow: { x: number; y: number; width: number; height: number },
  sourceWidth: number,
  sourceHeight: number
): { x: number; y: number; width: number; height: number } {
  const centerX = (cropWindow.x + cropWindow.width / 2) / sourceWidth;
  const centerY = (cropWindow.y + cropWindow.height / 2) / sourceHeight;

  // Use a small safeZone box so getPlanAnchorCenter returns exactly our center.
  const half = 0.01;
  return {
    x: clamp(centerX - half, 0, 1 - 2 * half),
    y: clamp(centerY - half, 0, 1 - 2 * half),
    width: 2 * half,
    height: 2 * half,
  };
}

/**
 * Main entry: compute a stable SmartReframePlan from aggregated detections.
 */
export function computeStableCropWindow(params: {
  aggregated: AggregatedDetections;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  safeZone: CaptionSafeZone;
  preferFaces: boolean;
  preferPersons: boolean;
}): SmartReframePlan {
  const { aggregated, sourceWidth, sourceHeight, targetWidth, targetHeight, safeZone } = params;

  // Try faces first (if requested)
  const faceResult =
    params.preferFaces
      ? aggregateBoxesToCenter(aggregated.faceBoxes, MIN_CONFIDENCE_FACE)
      : { centerX: 0.5, centerY: 0.5, confidence: 0, count: 0 };

  // Try persons as fallback
  const personResult =
    params.preferPersons
      ? aggregateBoxesToCenter(aggregated.personBoxes, MIN_CONFIDENCE_PERSON)
      : { centerX: 0.5, centerY: 0.5, confidence: 0, count: 0 };

  let strategy: SmartReframeStrategy;
  let subjectCenterX: number;
  let subjectCenterY: number;
  let confidence: number;
  let fallbackReason: string | undefined;
  let targetYRatio: number;

  if (faceResult.count > 0) {
    strategy = "face_tracking";
    subjectCenterX = faceResult.centerX;
    subjectCenterY = faceResult.centerY;
    confidence = faceResult.confidence;
    targetYRatio = FACE_TARGET_Y_RATIO;
  } else if (personResult.count > 0) {
    strategy = "person_tracking";
    subjectCenterX = personResult.centerX;
    subjectCenterY = personResult.centerY;
    confidence = personResult.confidence;
    targetYRatio = PERSON_TARGET_Y_RATIO;
    if (params.preferFaces) {
      fallbackReason = "No face detected above confidence threshold; using person bounding box.";
    }
  } else {
    strategy = "center_crop";
    subjectCenterX = 0.5;
    subjectCenterY = 0.5;
    confidence = 0;
    targetYRatio = 0.5;
    fallbackReason =
      aggregated.totalFrames === 0
        ? "No frames were sampled."
        : "No face or person detected in sampled frames; falling back to center crop.";
  }

  const cropWindow = computeCropPixels({
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    subjectCenterX,
    subjectCenterY,
    targetYRatio,
  });

  return {
    strategy,
    mode: "stable",
    confidence: Math.round(confidence * 100) / 100,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    cropWindow,
    subjectCenterNormalized: { x: subjectCenterX, y: subjectCenterY },
    safeZone,
    fallbackReason,
    sampledFrames: aggregated.totalFrames,
    faceDetections: aggregated.faceBoxes.length,
    personDetections: aggregated.personBoxes.length,
    analyzedAt: new Date().toISOString(),
  };
}
