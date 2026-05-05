import {
  applyCaptionPreset,
  buildCaptionRenderPlan,
  mergeCaptionCues,
  splitCaptionCue,
  validateCaptionCues,
} from "@/lib/repurpose/caption-studio";

describe("caption-studio", () => {
  it("applies professional presets while preserving hook overlays", () => {
    const style = applyCaptionPreset("karaoke_highlight", {
      hookOverlays: [{ id: "hook", text: "Hi", startMs: 0, endMs: 1000 }],
    });

    expect(style.presetId).toBe("karaoke");
    expect(style.animation.type).toBe("karaoke");
    expect(style.hookOverlays).toHaveLength(1);
  });

  it("keeps cue timings monotonic", () => {
    const cues = validateCaptionCues([
      { index: 1, startMs: 500, endMs: 1000, text: "first" },
      { index: 2, startMs: 800, endMs: 1200, text: "second" },
    ]);

    expect(cues[1].startMs).toBeGreaterThanOrEqual(cues[0].endMs);
  });

  it("splits and merges cues safely", () => {
    const split = splitCaptionCue(
      [{ index: 1, startMs: 0, endMs: 2000, text: "one two three four" }],
      0,
    );
    expect(split).toHaveLength(2);

    const merged = mergeCaptionCues(split, 0);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("one two three four");
  });

  it("builds render plan for burned captions and caption-off mode", () => {
    expect(
      buildCaptionRenderPlan({
        includeCaptions: true,
        captionSrt: "1\n00:00:00,000 --> 00:00:01,000\nHello",
      }).mode,
    ).toBe("burned_in");

    expect(
      buildCaptionRenderPlan({
        includeCaptions: false,
        captionSrt: "1\n00:00:00,000 --> 00:00:01,000\nHello",
      }).mode,
    ).toBe("external_srt");
  });
});
