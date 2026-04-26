import type { CropKeyframe, TrackingSmoothness } from "./tracking-types";

export const SMOOTHING_ALPHA = 0.2;
export const DEADBAND_X_PCT = 0.025;
export const DEADBAND_Y_PCT = 0.02;
export const MAX_CROP_SHIFT_PER_SECOND_X = 0.18;
export const MAX_CROP_SHIFT_PER_SECOND_Y = 0.12;
export const MISSING_DETECTION_INTERPOLATE_MS = 2000;
export const MISSING_DETECTION_FALLBACK_MS = 3500;

type SmoothCropPathOptions = {
  sourceWidth: number;
  sourceHeight: number;
  smoothness?: TrackingSmoothness;
};

const SMOOTHNESS_ALPHA: Record<TrackingSmoothness, number> = {
  low: 0.35,
  medium: SMOOTHING_ALPHA,
  high: 0.12,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampShift(current: number, next: number, maxDelta: number) {
  const delta = next - current;
  if (Math.abs(delta) <= maxDelta) {
    return next;
  }
  return current + Math.sign(delta) * maxDelta;
}

export function smoothCropPath(
  cropPath: CropKeyframe[],
  options: SmoothCropPathOptions
): CropKeyframe[] {
  if (cropPath.length <= 1) {
    return cropPath;
  }

  const sourceWidth = Math.max(1, options.sourceWidth);
  const sourceHeight = Math.max(1, options.sourceHeight);
  const alpha = SMOOTHNESS_ALPHA[options.smoothness ?? "medium"];
  const sorted = [...cropPath].sort((a, b) => a.timeMs - b.timeMs);
  const smoothed: CropKeyframe[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = smoothed[smoothed.length - 1];
    const raw = sorted[index];
    const elapsedSeconds = Math.max((raw.timeMs - previous.timeMs) / 1000, 0.001);

    const deadbandX = sourceWidth * DEADBAND_X_PCT;
    const deadbandY = sourceHeight * DEADBAND_Y_PCT;
    const rawX = Math.abs(raw.x - previous.x) < deadbandX ? previous.x : raw.x;
    const rawY = Math.abs(raw.y - previous.y) < deadbandY ? previous.y : raw.y;

    const maxDeltaX = sourceWidth * MAX_CROP_SHIFT_PER_SECOND_X * elapsedSeconds;
    const maxDeltaY = sourceHeight * MAX_CROP_SHIFT_PER_SECOND_Y * elapsedSeconds;

    const blendedX = previous.x + (rawX - previous.x) * alpha;
    const blendedY = previous.y + (rawY - previous.y) * alpha;

    const x = clamp(
      Math.round(clampShift(previous.x, blendedX, maxDeltaX)),
      0,
      Math.max(0, sourceWidth - raw.width)
    );
    const y = clamp(
      Math.round(clampShift(previous.y, blendedY, maxDeltaY)),
      0,
      Math.max(0, sourceHeight - raw.height)
    );

    smoothed.push({
      ...raw,
      x,
      y,
    });
  }

  return smoothed;
}
