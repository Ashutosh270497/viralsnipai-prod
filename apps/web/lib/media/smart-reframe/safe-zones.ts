/**
 * Smart Reframe — Caption Safe Zones
 *
 * Short-form platforms (YouTube Shorts, TikTok, Reels) overlay UI chrome in
 * the bottom ~15-20% of the frame (username, CTA buttons, description) and
 * occasionally in the top ~8% (progress bar, notifications).
 * Captions should live in the "lower third" safely above those elements.
 */

import type { CaptionSafeZone } from "./tracking-types";

/**
 * Default short-form safe zone for 9:16 vertical exports.
 * bottom 20% is reserved for platform UI and caption overlay.
 */
export const DEFAULT_SHORT_FORM_SAFE_ZONE: CaptionSafeZone = {
  topPct: 0.10,
  bottomPct: 0.20,
  leftPct: 0.05,
  rightPct: 0.05,
  preferredCaptionY: "lower_third",
};

/**
 * Landscape 16:9 safe zone (less aggressive margins).
 */
export const DEFAULT_LANDSCAPE_SAFE_ZONE: CaptionSafeZone = {
  topPct: 0.08,
  bottomPct: 0.12,
  leftPct: 0.04,
  rightPct: 0.04,
  preferredCaptionY: "lower_third",
};

/**
 * Square 1:1 safe zone.
 */
export const DEFAULT_SQUARE_SAFE_ZONE: CaptionSafeZone = {
  topPct: 0.08,
  bottomPct: 0.15,
  leftPct: 0.05,
  rightPct: 0.05,
  preferredCaptionY: "lower_third",
};

/**
 * Returns the appropriate default caption safe zone for the given output ratio.
 */
export function getDefaultCaptionSafeZone(targetRatio: number): CaptionSafeZone {
  if (Math.abs(targetRatio - 9 / 16) < 0.08) return DEFAULT_SHORT_FORM_SAFE_ZONE;
  if (Math.abs(targetRatio - 16 / 9) < 0.08) return DEFAULT_LANDSCAPE_SAFE_ZONE;
  return DEFAULT_SQUARE_SAFE_ZONE;
}

/**
 * Given a crop window height and a safe zone, computes the Y range where the
 * face/subject should NOT land (i.e., the caption area at the bottom).
 * Returns the normalized Y position below which captions will appear.
 */
export function captionAreaTopY(cropWindowHeightPx: number, safeZone: CaptionSafeZone): number {
  return 1.0 - safeZone.bottomPct;
}

/**
 * Given a face center Y (normalized 0-1 within the crop window), returns true
 * if the face would be covered by the caption overlay.
 */
export function isFaceInCaptionZone(
  faceCenterY_normalized: number,
  faceHeight_normalized: number,
  safeZone: CaptionSafeZone
): boolean {
  const faceBottom = faceCenterY_normalized + faceHeight_normalized / 2;
  return faceBottom > 1.0 - safeZone.bottomPct;
}
