import {
  PLATFORM_EXPORT_PRESETS,
  PLATFORM_EXPORT_PRESET_VALUES,
  resolvePlatformExportPreset,
} from "@/lib/repurpose/export-presets";

describe("platform export presets", () => {
  it("defines platform-ready render presets", () => {
    expect(PLATFORM_EXPORT_PRESET_VALUES).toEqual([
      "youtube_shorts",
      "instagram_reels",
      "tiktok",
      "x_video",
      "linkedin",
      "square_feed",
      "landscape_youtube",
    ]);

    expect(PLATFORM_EXPORT_PRESETS.youtube_shorts.aspectRatio).toBe("9:16");
    expect(PLATFORM_EXPORT_PRESETS.linkedin.legacyPreset).toBe("portrait_4x5_1080");
    expect(PLATFORM_EXPORT_PRESETS.landscape_youtube.width).toBe(1920);
  });

  it("falls back to YouTube Shorts for unknown presets", () => {
    expect(resolvePlatformExportPreset("missing").id).toBe("youtube_shorts");
    expect(resolvePlatformExportPreset(null).id).toBe("youtube_shorts");
  });

  it("keeps safe-zone and bitrate metadata available for render planning", () => {
    const preset = PLATFORM_EXPORT_PRESETS.tiktok;
    expect(preset.captionSafeZone.bottomPct).toBeGreaterThan(0.2);
    expect(preset.bitrateKbps).toBeGreaterThan(0);
    expect(preset.fileNamePrefix).toBe("tiktok");
  });
});
