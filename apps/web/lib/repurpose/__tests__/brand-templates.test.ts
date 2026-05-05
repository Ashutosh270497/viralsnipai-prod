import {
  BUILT_IN_BRAND_TEMPLATES,
  buildClipUpdateFromBrandTemplate,
  buildNewClipBrandDefaults,
  getBuiltInBrandTemplate,
  normalizeBrandTemplateInput,
  serializeBrandTemplate,
} from "@/lib/repurpose/brand-templates";

describe("brand templates", () => {
  it("exposes built-in starters that can be copied", () => {
    expect(BUILT_IN_BRAND_TEMPLATES.map((template) => template.name)).toEqual(
      expect.arrayContaining([
        "Minimal Clean",
        "Hormozi Bold",
        "Podcast Pro",
        "Founder/Business",
        "Educational",
        "Gaming/Reaction",
        "News Explainer",
      ]),
    );
    expect(getBuiltInBrandTemplate("builtin:hormozi_bold")?.captionStyle?.fontSize).toBeGreaterThan(50);
  });

  it("normalizes a template from a built-in source", () => {
    const normalized = normalizeBrandTemplateInput({
      builtinId: "builtin:minimal_clean",
      isDefault: true,
    });

    expect(normalized.name).toBe("Minimal Clean");
    expect(normalized.isDefault).toBe(true);
    expect(normalized.layoutConfig.aspectRatio).toBe("9:16");
    expect(normalized.defaultPlatformPresets).toContain("youtube_shorts");
  });

  it("serializes DB rows into UI-safe records", () => {
    const row = {
      id: "template-1",
      userId: "user-1",
      name: "Agency",
      description: null,
      isDefault: true,
      captionStyle: { fontSize: 64, position: "bottom" },
      layoutConfig: { preset: "center_crop", aspectRatio: "9:16" },
      overlayStyle: { textColor: "#fff" },
      defaultPlatformPresets: ["youtube_shorts", "bad"],
      createdAt: new Date("2026-05-05T00:00:00.000Z"),
      updatedAt: new Date("2026-05-05T00:00:00.000Z"),
    };

    const serialized = serializeBrandTemplate(row);
    expect(serialized.captionStyle?.fontSize).toBe(64);
    expect(serialized.defaultPlatformPresets).toEqual(["youtube_shorts"]);
    expect(serialized.createdAt).toBe("2026-05-05T00:00:00.000Z");
  });

  it("builds clip updates without destroying existing virality metadata", () => {
    const template = getBuiltInBrandTemplate("builtin:founder_business")!;
    const update = buildClipUpdateFromBrandTemplate(
      {
        callToAction: null,
        viralityFactors: {
          hookStrength: 72,
          emotionalPeak: 55,
          storyArc: 64,
          pacing: 70,
          transcriptQuality: 88,
          metadata: { candidateId: "cand-1" },
        },
      },
      template,
      { overwrite: false, appliedAt: "2026-05-05T00:00:00.000Z" },
    );

    expect(update.callToAction).toBe(template.defaultCTA);
    expect(update.viralityFactors.metadata?.candidateId).toBe("cand-1");
    expect(update.viralityFactors.metadata?.brandTemplateId).toBe(template.id);
    expect(update.viralityFactors.metadata?.layoutConfig).toBeTruthy();
  });

  it("returns default values for new auto-highlight clips", () => {
    const template = getBuiltInBrandTemplate("builtin:educational")!;
    const defaults = buildNewClipBrandDefaults(template);

    expect(defaults.captionStyle?.emphasisColor).toBe("#22C55E");
    expect(defaults.callToAction).toBe(template.defaultCTA);
    expect(defaults.brandMetadata?.brandTemplateId).toBe(template.id);
  });
});
