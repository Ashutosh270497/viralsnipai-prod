/** @jest-environment node */

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  getCurrentUser: jest.fn(),
}));

jest.mock("@/lib/infrastructure/di/container", () => ({
  __esModule: true,
  container: { get: jest.fn() },
}));

import { autoHighlightsRequestSchema } from "@/app/api/repurpose/auto-highlights/schema";

describe("auto-highlights request validation", () => {
  it("accepts valid clip length presets", () => {
    const parsed = autoHighlightsRequestSchema.parse({
      assetId: "asset_1",
      qualityMode: "fast",
      clipIntent: "viral_hooks",
      clipLengthPreset: "short",
    });

    expect(parsed.clipLengthPreset).toBe("short");
    expect(parsed.qualityMode).toBe("fast");
    expect(parsed.clipIntent).toBe("viral_hooks");
  });

  it("defaults missing clip length preset to balanced", () => {
    const parsed = autoHighlightsRequestSchema.parse({
      assetId: "asset_1",
    });

    expect(parsed.clipLengthPreset).toBe("balanced");
    expect(parsed.qualityMode).toBe("balanced");
    expect(parsed.clipIntent).toBe("auto");
  });

  it("rejects invalid clip length presets", () => {
    expect(() =>
      autoHighlightsRequestSchema.parse({
        assetId: "asset_1",
        clipLengthPreset: "cinematic",
      }),
    ).toThrow();
  });

  it("rejects invalid quality mode", () => {
    expect(() =>
      autoHighlightsRequestSchema.parse({
        assetId: "asset_1",
        qualityMode: "ultra",
      }),
    ).toThrow();
  });

  it("rejects invalid clip intent", () => {
    expect(() =>
      autoHighlightsRequestSchema.parse({
        assetId: "asset_1",
        clipIntent: "raw_model",
      }),
    ).toThrow();
  });

  it("still parses legacy raw model for route-level dev/admin handling", () => {
    const parsed = autoHighlightsRequestSchema.parse({
      assetId: "asset_1",
      model: "google/gemini-2.5-pro",
    });

    expect(parsed.model).toBe("google/gemini-2.5-pro");
  });
});
