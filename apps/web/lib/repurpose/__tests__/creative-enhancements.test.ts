import {
  buildEnhancementRenderPlan,
  clampEnhancementToClip,
  clipEnhancementSchema,
  enhancementsToHookOverlays,
  mergeEnhancementsIntoCaptionStyle,
  normalizeEnhancementPayload,
  type ClipEnhancement,
} from "@/lib/repurpose/creative-enhancements";

function enhancement(partial: Partial<ClipEnhancement>): ClipEnhancement {
  return {
    id: partial.id ?? "enh-1",
    clipId: partial.clipId ?? "clip-1",
    type: partial.type ?? "text_overlay",
    startMs: partial.startMs ?? 0,
    endMs: partial.endMs ?? 2000,
    payload: partial.payload ?? { text: "Big idea" },
    enabled: partial.enabled ?? true,
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
  };
}

describe("creative enhancements", () => {
  it("validates enhancement creation input", () => {
    expect(
      clipEnhancementSchema.parse({
        type: "cta_card",
        startMs: 500,
        endMs: 2500,
        payload: { text: "DM me for the checklist" },
      }),
    ).toMatchObject({
      type: "cta_card",
      enabled: true,
    });
    expect(() =>
      clipEnhancementSchema.parse({
        type: "cta_card",
        startMs: 2500,
        endMs: 500,
        payload: {},
      }),
    ).toThrow();
  });

  it("clamps suggested timing to the clip duration", () => {
    expect(clampEnhancementToClip({ startMs: -400, endMs: 80_000 }, 10_000)).toEqual({
      startMs: 0,
      endMs: 10_000,
    });
  });

  it("normalizes text overlays into FFmpeg hook overlays", () => {
    const overlays = enhancementsToHookOverlays([
      enhancement({
        payload: {
          text: "Save this",
          position: "bottom",
          fontSize: 72,
          backgroundColor: "#2563eb",
        },
      }),
    ]);

    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toMatchObject({
      text: "Save this",
      position: "bottom",
      fontSize: 72,
      backgroundColor: "#2563EB",
    });
  });

  it("turns keyword highlights into visible render overlays", () => {
    const style = mergeEnhancementsIntoCaptionStyle(null, [
      enhancement({
        type: "keyword_highlight",
        payload: { keyword: "retention", color: "#facc15" },
      }),
    ]);

    expect(style.keywordHighlightEnabled).toBe(true);
    expect(style.hookOverlays[0]).toMatchObject({
      text: "RETENTION",
      textColor: "#FACC15",
    });
  });

  it("keeps b-roll and audio in the render plan without pretending media exists", () => {
    const plan = buildEnhancementRenderPlan([
      enhancement({ type: "b_roll", payload: { searchQuery: "busy startup office" } }),
      enhancement({ type: "music_bed", payload: { label: "soft beat", volume: 0.2 } }),
      enhancement({ type: "emoji", payload: { emoji: "🔥" } }),
    ]);

    expect(plan.overlays).toHaveLength(1);
    expect(plan.bRoll).toHaveLength(1);
    expect(plan.audio).toHaveLength(1);
    expect(plan.warnings[0]).toContain("has no media attached");
  });

  it("sanitizes audio and b-roll payloads", () => {
    expect(normalizeEnhancementPayload("music_bed", { volume: 5 })).toMatchObject({
      volume: 1,
      normalizeLoudness: true,
    });
    expect(normalizeEnhancementPayload("b_roll", { query: "city traffic" })).toMatchObject({
      searchQuery: "city traffic",
      mediaUrl: null,
    });
  });
});
