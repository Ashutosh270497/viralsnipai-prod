/**
 * Video Quality Policy
 *
 * Single source of truth for all FFmpeg quality presets used across the
 * ViralSnipAI pipeline. Import from here — do not scatter CRF/preset values
 * directly in ffmpeg.ts or use-case files.
 *
 * Preset selection guide:
 *   source_copy_trim   → no crop/scale/caption needed; stream copy preserves 100% quality
 *   preview_fast       → dashboard preview UI only; NEVER use as final export input
 *   balanced_export    → standard final export (free + starter plans)
 *   high_quality_export → best final export (creator + studio plans, or no filters needed)
 */

export const VIDEO_QUALITY_PRESETS = {
  /**
   * Stream copy — zero re-encode.
   * Use when: simple trim with no crop, scale, reframe, or caption filter.
   * Fastest path, lossless.
   */
  source_copy_trim: {
    streamCopy: true,
    isPreviewOnly: false,
    ffmpegOptions: ["-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart"],
    crf: null,
    preset: null,
    audioBitrateKbps: null,
  },

  /**
   * Fast preview for dashboard UI only.
   * NEVER pass this output as input to a final export render.
   * CRF 24, veryfast preset — acceptable for 240px preview, not final delivery.
   */
  preview_fast: {
    streamCopy: false,
    isPreviewOnly: true,
    ffmpegOptions: [
      "-c:v",    "libx264",
      "-preset",  "veryfast",
      "-crf",     "24",
      "-pix_fmt", "yuv420p",
      "-c:a",     "aac",
      "-b:a",     "128k",
      "-movflags", "+faststart",
    ],
    crf: 24,
    preset: "veryfast",
    audioBitrateKbps: 128,
  },

  /**
   * Balanced export — standard quality for free and starter plan final exports.
   * CRF 20, medium preset. Good quality/speed tradeoff for 60–95 s clips.
   */
  balanced_export: {
    streamCopy: false,
    isPreviewOnly: false,
    ffmpegOptions: [
      "-c:v",      "libx264",
      "-preset",    "medium",
      "-crf",       "20",
      "-profile:v", "high",
      "-level",     "4.2",
      "-pix_fmt",   "yuv420p",
      "-c:a",       "aac",
      "-b:a",       "192k",
      "-movflags",  "+faststart",
    ],
    crf: 20,
    preset: "medium",
    audioBitrateKbps: 192,
  },

  /**
   * High-quality export — for creator/studio plans and all production renders.
   * CRF 16, slow preset — visually near-lossless for typical 30–95 s clips.
   * This is the default for renderExport() / extractAndRenderSegment().
   */
  high_quality_export: {
    streamCopy: false,
    isPreviewOnly: false,
    ffmpegOptions: [
      "-c:v",      "libx264",
      "-preset",    "slow",
      "-crf",       "16",
      "-profile:v", "high",
      "-level",     "4.2",
      "-pix_fmt",   "yuv420p",
      "-c:a",       "aac",
      "-b:a",       "256k",
      "-movflags",  "+faststart",
    ],
    crf: 16,
    preset: "slow",
    audioBitrateKbps: 256,
  },
} as const;

export type VideoQualityPresetKey = keyof typeof VIDEO_QUALITY_PRESETS;

/** Maximum CRF a final export is allowed to use. Enforced in tests. */
export const MAX_EXPORT_CRF = 22;

/** Minimum audio bitrate (kbps) for a final export. */
export const MIN_EXPORT_AUDIO_KBPS = 128;

/**
 * Assert that a preset is not preview-only.
 * Call this at the start of any final-export code path that accepts a preset key
 * to catch misconfiguration at runtime.
 */
export function assertNotPreviewPreset(presetKey: VideoQualityPresetKey, caller: string): void {
  if (VIDEO_QUALITY_PRESETS[presetKey].isPreviewOnly) {
    throw new Error(
      `[video-quality-policy] "${presetKey}" is a preview-only preset and cannot be used for final export in: ${caller}`
    );
  }
}

/**
 * Return the FFmpeg options array for the given preset.
 * Typed so callers don't need to index the const directly.
 */
export function getQualityOptions(presetKey: VideoQualityPresetKey): readonly string[] {
  return VIDEO_QUALITY_PRESETS[presetKey].ffmpegOptions;
}

/**
 * Validate a set of FFmpeg options (from a render output) against minimum
 * quality requirements. Returns a list of violations.
 *
 * Used in tests to assert no production render falls below the threshold.
 */
export function validateExportOptions(ffmpegOptions: readonly string[]): string[] {
  const violations: string[] = [];
  const opts = [...ffmpegOptions];

  const crfIdx = opts.indexOf("-crf");
  if (crfIdx !== -1) {
    const crf = Number(opts[crfIdx + 1]);
    if (Number.isFinite(crf) && crf > MAX_EXPORT_CRF) {
      violations.push(`CRF ${crf} exceeds maximum allowed export CRF of ${MAX_EXPORT_CRF}`);
    }
  }

  const bitrateIdx = opts.indexOf("-b:a");
  if (bitrateIdx !== -1) {
    const raw = opts[bitrateIdx + 1] ?? "";
    const kbps = Number(raw.replace(/k$/i, ""));
    if (Number.isFinite(kbps) && kbps < MIN_EXPORT_AUDIO_KBPS) {
      violations.push(`Audio bitrate ${kbps}k is below minimum export audio bitrate of ${MIN_EXPORT_AUDIO_KBPS}k`);
    }
  }

  return violations;
}
