import { srtUtils } from "@/lib/srt-utils";

const PLACEHOLDER_PATTERNS = [
  /^\[.*\]$/i,
  /^captions?\s*(un)?available\b/i,
  /^subtitles?\s*(un)?available\b/i,
  /^generated\s*content\b/i,
  /^no\s*(captions?|transcript)\b/i,
  /^\(.*\)$/i,
  /^placeholder\b/i,
];

const UNICODE_LETTER_OR_NUMBER_PATTERN = /[\p{L}\p{N}]/u;
const MIN_VALID_RATIO = 0.35;
const MAX_INVALID_TIMING_RATIO = 0.4;
const MIN_QUALITY_SCORE = 45;

export type CaptionQualityTier = "transcript_ready" | "needs_cleanup" | "low_quality";

export interface CaptionQualitySummary {
  isUsable: boolean;
  score: number;
  validCount: number;
  invalidCount: number;
  totalCount: number;
  tier: CaptionQualityTier;
}

export function isPlaceholderCaptionText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (!UNICODE_LETTER_OR_NUMBER_PATTERN.test(trimmed)) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function hasUsableCaptionSrt(captionSrt: string | null | undefined): boolean {
  return getCaptionQuality(captionSrt).isUsable;
}

export function getCaptionQuality(captionSrt: string | null | undefined): CaptionQualitySummary {
  if (!captionSrt) {
    return {
      isUsable: false,
      score: 0,
      validCount: 0,
      invalidCount: 0,
      totalCount: 0,
      tier: "low_quality",
    };
  }

  const entries = srtUtils.parseSRT(captionSrt);
  if (entries.length === 0) {
    return {
      isUsable: false,
      score: 0,
      validCount: 0,
      invalidCount: 0,
      totalCount: 0,
      tier: "low_quality",
    };
  }

  let validCount = 0;
  let invalidTimingCount = 0;
  let nonEmptyCount = 0;

  for (const entry of entries) {
    const text = entry.text.trim();
    const hasText = text.length > 0;
    if (hasText) {
      nonEmptyCount += 1;
    }

    const hasValidTiming =
      Number.isFinite(entry.startMs) &&
      Number.isFinite(entry.endMs) &&
      entry.endMs > entry.startMs;

    if (!hasValidTiming) {
      invalidTimingCount += 1;
      continue;
    }

    if (hasText && !isPlaceholderCaptionText(text)) {
      validCount += 1;
    }
  }

  const totalCount = entries.length;
  const invalidCount = totalCount - validCount;
  const validRatio = validCount / totalCount;
  const nonEmptyRatio = nonEmptyCount / totalCount;
  const validTimingRatio = 1 - invalidTimingCount / totalCount;

  const score = Math.max(
    0,
    Math.min(100, Math.round(validRatio * 70 + nonEmptyRatio * 20 + validTimingRatio * 10))
  );

  const hasTooManyInvalidTimings = invalidTimingCount / totalCount > MAX_INVALID_TIMING_RATIO;
  const isUsable = validRatio >= MIN_VALID_RATIO && !hasTooManyInvalidTimings && score >= MIN_QUALITY_SCORE;

  const tier: CaptionQualityTier = isUsable
    ? "transcript_ready"
    : validCount > 0 && score >= 25
      ? "needs_cleanup"
      : "low_quality";

  return {
    isUsable,
    score,
    validCount,
    invalidCount,
    totalCount,
    tier,
  };
}
