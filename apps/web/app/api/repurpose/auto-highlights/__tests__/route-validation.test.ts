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
      model: "google/gemini-2.5-pro",
      clipLengthPreset: "short",
    });

    expect(parsed.clipLengthPreset).toBe("short");
  });

  it("defaults missing clip length preset to balanced", () => {
    const parsed = autoHighlightsRequestSchema.parse({
      assetId: "asset_1",
      model: "google/gemini-2.5-pro",
    });

    expect(parsed.clipLengthPreset).toBe("balanced");
  });

  it("rejects invalid clip length presets", () => {
    expect(() =>
      autoHighlightsRequestSchema.parse({
        assetId: "asset_1",
        clipLengthPreset: "cinematic",
      }),
    ).toThrow();
  });

  it("rejects invalid reasoning models", () => {
    expect(() =>
      autoHighlightsRequestSchema.parse({
        assetId: "asset_1",
        model: "whisper-1",
      }),
    ).toThrow(/Invalid OpenRouter reasoning model/);
  });
});
