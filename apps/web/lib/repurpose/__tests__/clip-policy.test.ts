import { resolveClipPolicy, V1_CLIP_POLICY } from "@/lib/repurpose/clip-policy";

describe("clip length preset policy", () => {
  it("resolves short clips to a shorter window", () => {
    expect(resolveClipPolicy("short")).toMatchObject({
      minMs: 18_000,
      idealMs: 24_000,
      maxMs: 30_000,
    });
  });

  it("resolves balanced clips as the default", () => {
    expect(resolveClipPolicy("balanced")).toMatchObject({
      minMs: 24_000,
      idealMs: 38_000,
      maxMs: 45_000,
    });
    expect(resolveClipPolicy()).toEqual(resolveClipPolicy("balanced"));
  });

  it("resolves detailed clips to a longer allowed window", () => {
    expect(resolveClipPolicy("detailed")).toMatchObject({
      minMs: 35_000,
      idealMs: 48_000,
      maxMs: 58_000,
    });
  });

  it("keeps target clip limits safe across presets", () => {
    for (const preset of ["short", "balanced", "detailed"] as const) {
      expect(resolveClipPolicy(preset).maxTargetClips).toBe(V1_CLIP_POLICY.maxTargetClips);
      expect(resolveClipPolicy(preset).maxTargetClips).toBeLessThanOrEqual(8);
    }
  });
});
