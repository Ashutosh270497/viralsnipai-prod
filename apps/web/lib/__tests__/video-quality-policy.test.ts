/**
 * Video Quality Policy — automated invariant checks.
 *
 * These tests guard against configuration regressions:
 *   - Final exports never use preview-only presets
 *   - High-quality export stays at or below CRF 18
 *   - Balanced export stays at or below CRF 22
 *   - source_copy_trim uses codec copy and no CRF
 *   - Audio bitrate meets minimum thresholds
 *   - preview_fast is never exposed as a final export preset
 */

import {
  VIDEO_QUALITY_PRESETS,
  MAX_EXPORT_CRF,
  MIN_EXPORT_AUDIO_KBPS,
  assertNotPreviewPreset,
  validateExportOptions,
  getQualityOptions,
} from "@/lib/media/video-quality-policy";

describe("video-quality-policy presets", () => {
  // ── source_copy_trim ────────────────────────────────────────────────────────
  describe("source_copy_trim", () => {
    const preset = VIDEO_QUALITY_PRESETS.source_copy_trim;

    it("uses stream copy (no re-encode)", () => {
      expect(preset.streamCopy).toBe(true);
    });

    it("contains -c:v copy and -c:a copy", () => {
      const opts = preset.ffmpegOptions;
      const vcIdx = opts.indexOf("-c:v");
      const acIdx = opts.indexOf("-c:a");
      expect(opts[vcIdx + 1]).toBe("copy");
      expect(opts[acIdx + 1]).toBe("copy");
    });

    it("has no CRF setting", () => {
      expect(preset.crf).toBeNull();
      expect(preset.ffmpegOptions).not.toContain("-crf");
    });

    it("is not preview-only", () => {
      expect(preset.isPreviewOnly).toBe(false);
    });
  });

  // ── preview_fast ────────────────────────────────────────────────────────────
  describe("preview_fast", () => {
    const preset = VIDEO_QUALITY_PRESETS.preview_fast;

    it("is flagged as preview-only", () => {
      expect(preset.isPreviewOnly).toBe(true);
    });

    it("uses CRF > MAX_EXPORT_CRF (intentionally light)", () => {
      expect(preset.crf).toBeGreaterThan(MAX_EXPORT_CRF);
    });

    it("uses veryfast preset for speed", () => {
      expect(preset.preset).toBe("veryfast");
    });

    it("throws when used for final export", () => {
      expect(() => assertNotPreviewPreset("preview_fast", "test")).toThrow(
        /preview-only preset/
      );
    });
  });

  // ── balanced_export ─────────────────────────────────────────────────────────
  describe("balanced_export", () => {
    const preset = VIDEO_QUALITY_PRESETS.balanced_export;

    it("is not preview-only", () => {
      expect(preset.isPreviewOnly).toBe(false);
    });

    it("CRF is at or below MAX_EXPORT_CRF", () => {
      expect(preset.crf).toBeLessThanOrEqual(MAX_EXPORT_CRF);
    });

    it("audio bitrate meets minimum", () => {
      expect(preset.audioBitrateKbps).toBeGreaterThanOrEqual(MIN_EXPORT_AUDIO_KBPS);
    });

    it("passes validateExportOptions", () => {
      const violations = validateExportOptions(preset.ffmpegOptions);
      expect(violations).toHaveLength(0);
    });

    it("does not throw when asserted as non-preview", () => {
      expect(() => assertNotPreviewPreset("balanced_export", "test")).not.toThrow();
    });
  });

  // ── high_quality_export ─────────────────────────────────────────────────────
  describe("high_quality_export", () => {
    const preset = VIDEO_QUALITY_PRESETS.high_quality_export;

    it("is not preview-only", () => {
      expect(preset.isPreviewOnly).toBe(false);
    });

    it("CRF is at or below 18 (high-quality threshold)", () => {
      expect(preset.crf).toBeLessThanOrEqual(18);
    });

    it("uses slow preset for best compression quality", () => {
      expect(preset.preset).toBe("slow");
    });

    it("audio bitrate is at least 192k", () => {
      expect(preset.audioBitrateKbps).toBeGreaterThanOrEqual(192);
    });

    it("uses yuv420p pixel format for broad compatibility", () => {
      expect(preset.ffmpegOptions).toContain("yuv420p");
    });

    it("includes +faststart for streaming", () => {
      expect(preset.ffmpegOptions).toContain("+faststart");
    });

    it("passes validateExportOptions", () => {
      const violations = validateExportOptions(preset.ffmpegOptions);
      expect(violations).toHaveLength(0);
    });
  });

  // ── validateExportOptions ───────────────────────────────────────────────────
  describe("validateExportOptions", () => {
    it("flags CRF above MAX_EXPORT_CRF as a violation", () => {
      const violations = validateExportOptions(["-c:v", "libx264", "-crf", "28"]);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toMatch(/CRF 28/);
    });

    it("flags audio bitrate below minimum as a violation", () => {
      const violations = validateExportOptions(["-c:a", "aac", "-b:a", "64k"]);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toMatch(/64k/);
    });

    it("accepts CRF exactly at MAX_EXPORT_CRF", () => {
      const violations = validateExportOptions(["-crf", String(MAX_EXPORT_CRF)]);
      expect(violations).toHaveLength(0);
    });

    it("returns no violations for high_quality_export options", () => {
      const opts = getQualityOptions("high_quality_export");
      expect(validateExportOptions(opts)).toHaveLength(0);
    });

    it("returns no violations for balanced_export options", () => {
      const opts = getQualityOptions("balanced_export");
      expect(validateExportOptions(opts)).toHaveLength(0);
    });
  });
});

// ── Pipeline invariants ────────────────────────────────────────────────────────
describe("pipeline invariants", () => {
  it("preview_fast preset is never used for final export via assertNotPreviewPreset", () => {
    expect(VIDEO_QUALITY_PRESETS.preview_fast.isPreviewOnly).toBe(true);
    expect(() => assertNotPreviewPreset("preview_fast", "renderExport")).toThrow();
  });

  it("source_copy_trim has no CRF — cannot accidentally bypass quality check", () => {
    expect(VIDEO_QUALITY_PRESETS.source_copy_trim.crf).toBeNull();
  });

  it("all non-preview presets pass validateExportOptions", () => {
    for (const [key, preset] of Object.entries(VIDEO_QUALITY_PRESETS)) {
      if (!preset.isPreviewOnly && !preset.streamCopy) {
        const violations = validateExportOptions(preset.ffmpegOptions);
        expect(violations).toHaveLength(0);
        // Ensures we didn't accidentally fail the check for preset: ${key}
      }
    }
  });

  it("captions require a re-encode pass (not stream copy)", () => {
    // source_copy_trim must never be used when caption burn-in is needed
    expect(VIDEO_QUALITY_PRESETS.source_copy_trim.streamCopy).toBe(true);
    // The stream copy path produces H.264 that cannot have captions burned in after the fact.
    // The extractAndRenderSegment function handles captioned clips always with a full encode.
    expect(VIDEO_QUALITY_PRESETS.high_quality_export.streamCopy).toBe(false);
  });
});
