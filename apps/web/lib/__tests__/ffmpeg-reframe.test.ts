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
