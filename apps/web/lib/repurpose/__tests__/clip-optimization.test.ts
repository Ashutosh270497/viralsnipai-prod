import {
  analyzeClipQuality,
  blendViralityScore,
  buildClipReframePlans,
  selectBestReframePlan,
} from "../clip-optimization";

describe("clip-optimization", () => {
  const segments = [
    {
      start: 5,
      end: 20,
      text: "This is a tight talking-head section with clean pacing and consistent words.",
      words: [
        { word: "This", start: 5.0, end: 5.3 },
        { word: "is", start: 5.35, end: 5.55 },
        { word: "a", start: 5.6, end: 5.72 },
        { word: "tight", start: 5.8, end: 6.2 },
        { word: "talking-head", start: 6.3, end: 6.9 },
        { word: "section", start: 7.0, end: 7.4 },
        { word: "with", start: 7.45, end: 7.7 },
        { word: "clean", start: 7.8, end: 8.2 },
        { word: "pacing", start: 8.3, end: 8.8 },
        { word: "and", start: 8.9, end: 9.1 },
        { word: "consistent", start: 9.2, end: 9.8 },
        { word: "words", start: 9.9, end: 10.4 },
      ],
    },
  ];

  it("produces explainable quality signals for a clip window", () => {
    const result = analyzeClipQuality({
      startMs: 5_000,
      endMs: 15_000,
      transcriptionSegments: segments,
      sceneCutsMs: [5_000, 15_100],
      minDurationMs: 5_000,
      maxDurationMs: 12_000,
    });

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.durationFit).toBeGreaterThan(60);
    expect(result.sceneAlignment).toBeGreaterThan(70);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("returns ratio-specific reframe plans when geometry is available", () => {
    const qualitySignals = analyzeClipQuality({
      startMs: 5_000,
      endMs: 15_000,
      transcriptionSegments: segments,
      sceneCutsMs: [5_000, 15_100],
      minDurationMs: 5_000,
      maxDurationMs: 12_000,
    });

    const plans = buildClipReframePlans({
      geometry: {
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        orientation: "landscape",
        sourceRatioLabel: "16:9",
      },
      qualitySignals,
    });

    expect(plans).toHaveLength(3);
    expect(plans.find((plan) => plan.ratio === "9:16")?.mode).toBe("speaker_focus");
    expect(plans.find((plan) => plan.ratio === "16:9")?.mode).toBe("native");
    expect(plans.find((plan) => plan.ratio === "9:16")?.tracking?.axis).toBe("horizontal");
    expect((plans.find((plan) => plan.ratio === "9:16")?.tracking?.travel ?? 0)).toBeGreaterThan(0);
  });

  it("blends AI and deterministic score without exceeding range", () => {
    expect(blendViralityScore(80, 60)).toBe(74);
    expect(blendViralityScore(null, 63)).toBe(63);
  });

  it("selects the closest reframe plan for a target aspect ratio", () => {
    const qualitySignals = analyzeClipQuality({
      startMs: 5_000,
      endMs: 15_000,
      transcriptionSegments: segments,
      sceneCutsMs: [5_000, 15_100],
      minDurationMs: 5_000,
      maxDurationMs: 12_000,
    });

    const plans = buildClipReframePlans({
      geometry: {
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        orientation: "landscape",
        sourceRatioLabel: "16:9",
      },
      qualitySignals,
    });

    expect(selectBestReframePlan(plans, 9 / 16)?.ratio).toBe("9:16");
    expect(selectBestReframePlan(plans, 1)?.ratio).toBe("1:1");
    expect(selectBestReframePlan(plans, 4 / 5)?.ratio).toBe("1:1");
  });
});
