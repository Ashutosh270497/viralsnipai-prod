import { buildPresetVideoFilter } from "../ffmpeg";
import type { ClipReframePlan } from "../types";

describe("ffmpeg reframing filters", () => {
  it("builds a crop-based filter for speaker-focused portrait reframes", () => {
    const plan: ClipReframePlan = {
      ratio: "9:16",
      mode: "speaker_focus",
      anchor: "speaker",
      confidence: "high",
      safeZone: {
        x: 0.18,
        y: 0.08,
        width: 0.64,
        height: 0.84,
      },
      tracking: {
        axis: "horizontal",
        travel: 0.12,
        lockStrength: 0.9,
        easing: "ease_in_out",
      },
      reasoning: "Portrait delivery should bias toward the active speaker safe area.",
    };

    const filter = buildPresetVideoFilter({
      preset: "shorts_9x16_1080",
      reframePlan: plan,
      durationSeconds: 12,
    });

    expect(filter).toContain("crop=");
    expect(filter).toContain("scale=1080:1920");
    expect(filter).toContain("cos(PI*");
    expect(filter).toContain("iw*0.5000+");
    expect(filter).toContain("\\,");
  });

  it("builds a dynamic crop filter from crop keyframes", () => {
    const plan: ClipReframePlan = {
      ratio: "9:16",
      mode: "speaker_focus",
      anchor: "speaker",
      confidence: "high",
      safeZone: {
        x: 0.2,
        y: 0,
        width: 0.3,
        height: 1,
      },
      dynamicCropSource: {
        width: 1920,
        height: 1080,
      },
      dynamicCropPath: [
        {
          timeMs: 10_000,
          x: 300,
          y: 0,
          width: 608,
          height: 1080,
          confidence: 0.82,
          detectionType: "face",
        },
        {
          timeMs: 10_750,
          x: 420,
          y: 0,
          width: 608,
          height: 1080,
          confidence: 0.84,
          detectionType: "face",
        },
        {
          timeMs: 11_500,
          x: 540,
          y: 0,
          width: 608,
          height: 1080,
          confidence: 0.8,
          detectionType: "interpolated",
        },
      ],
      reasoning: "Dynamic face tracking should follow the speaker.",
    };

    const filter = buildPresetVideoFilter({
      preset: "shorts_9x16_1080",
      reframePlan: plan,
      durationSeconds: 1.5,
    });

    expect(filter).toContain("crop=trunc(iw*0.316667/2)*2:trunc(ih*1.000000/2)*2");
    expect(filter).toContain("lte(t\\,0.7500)");
    expect(filter).toContain("scale=1080:1920:flags=lanczos");
    expect(filter).toContain("setsar=1");
    expect(filter).not.toContain("cos(PI*");
  });

  it("falls back to stable crop when dynamic crop path is incomplete", () => {
    const plan: ClipReframePlan = {
      ratio: "9:16",
      mode: "speaker_focus",
      anchor: "speaker",
      confidence: "medium",
      safeZone: {
        x: 0.25,
        y: 0.1,
        width: 0.4,
        height: 0.8,
      },
      dynamicCropSource: {
        width: 1920,
        height: 1080,
      },
      dynamicCropPath: [
        {
          timeMs: 0,
          x: 360,
          y: 0,
          width: 608,
          height: 1080,
          confidence: 0.8,
          detectionType: "face",
        },
      ],
      reasoning: "One keyframe is not enough for dynamic tracking.",
    };

    const filter = buildPresetVideoFilter({
      preset: "shorts_9x16_1080",
      reframePlan: plan,
      durationSeconds: 8,
    });

    expect(filter).toContain("crop=");
    expect(filter).toContain("if(gte(iw/ih");
    expect(filter).toContain("scale=1080:1920");
  });

  it("builds a padded filter for letterboxed reframes", () => {
    const plan: ClipReframePlan = {
      ratio: "16:9",
      mode: "letterbox",
      anchor: "safe_area",
      confidence: "medium",
      safeZone: {
        x: 0.04,
        y: 0.12,
        width: 0.92,
        height: 0.76,
      },
      reasoning: "Source is narrower than target, so preserving composition is safer than aggressive crop.",
    };

    const filter = buildPresetVideoFilter({
      preset: "landscape_16x9_1080",
      reframePlan: plan,
    });

    expect(filter).toContain("force_original_aspect_ratio=decrease");
    expect(filter).toContain("pad=1920:1080");
    expect(filter).toContain("setsar=1");
  });
});
