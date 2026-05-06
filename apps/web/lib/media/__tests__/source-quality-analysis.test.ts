import { analyzeSourceForReframeQuality } from "@/lib/media/source-quality-analysis";
import type { ClipReframePlan } from "@/lib/types";

const speakerFocusPlan: ClipReframePlan = {
  ratio: "9:16",
  mode: "speaker_focus",
  anchor: "speaker",
  confidence: "medium",
  safeZone: { x: 0.2, y: 0.05, width: 0.6, height: 0.9 },
  reasoning: "Speaker focus",
};

describe("source reframe quality analysis", () => {
  it("selects blur-background fit when landscape to vertical crop would upscale too much", () => {
    const analysis = analyzeSourceForReframeQuality({
      inputPath: "/uploads/source.mp4",
      source: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationSec: 120,
        videoCodec: "h264",
        audioCodec: "aac",
        videoBitrateKbps: 8000,
        audioBitrateKbps: 192,
        rotation: 0,
      },
      preset: "shorts_9x16_1080",
      presetDimensions: { width: 1080, height: 1920 },
      reframePlan: speakerFocusPlan,
    });

    expect(analysis.recommendedRenderMode).toBe("fit_with_blur_background");
    expect(analysis.qualityRisk).toBe("high");
    expect(analysis.upscaleFactorX).toBeGreaterThan(1.35);
  });

  it("keeps high-quality crop for vertical sources", () => {
    const analysis = analyzeSourceForReframeQuality({
      inputPath: "/uploads/source.mp4",
      source: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationSec: 120,
        videoCodec: "h264",
        audioCodec: "aac",
        videoBitrateKbps: 8000,
        audioBitrateKbps: 192,
        rotation: 0,
      },
      preset: "shorts_9x16_1080",
      presetDimensions: { width: 1080, height: 1920 },
      reframePlan: speakerFocusPlan,
    });

    expect(analysis.recommendedRenderMode).toBe("high_quality_crop");
    expect(analysis.qualityRisk).toBe("low");
  });
});
