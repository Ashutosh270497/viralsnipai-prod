import {
  canUseModelDebug,
  normalizeClipIntent,
  resolveModelPolicy,
} from "@/lib/ai/model-policy";

describe("model policy", () => {
  it("resolves fast, balanced, and best rerank policies", () => {
    expect(resolveModelPolicy({ task: "highlight_rerank", qualityMode: "fast", userPlan: "free" }).costTier).toBe("low");
    expect(resolveModelPolicy({ task: "highlight_rerank", qualityMode: "balanced", userPlan: "plus" }).costTier).toBe("medium");
    expect(resolveModelPolicy({ task: "highlight_rerank", qualityMode: "best", userPlan: "pro" }).costTier).toBe("high");
  });

  it("caps best quality for free users", () => {
    const policy = resolveModelPolicy({ task: "highlight_rerank", qualityMode: "best", userPlan: "free" });
    expect(policy.qualityMode).toBe("balanced");
  });

  it("rejects production normal-user overrides", () => {
    expect(() =>
      resolveModelPolicy({
        task: "highlight_rerank",
        requestedOverrideModel: "openai/gpt-4o",
        isDev: false,
        isAdmin: false,
      }),
    ).toThrow(/restricted/);
  });

  it("allows developer/admin override with provider/model format", () => {
    const policy = resolveModelPolicy({
      task: "highlight_rerank",
      requestedOverrideModel: "openai/gpt-4o",
      isDev: true,
    });
    expect(policy.primaryModel).toBe("openai/gpt-4o");
    expect(policy.modelSelectionReason).toMatch(/override/i);
  });

  it("rejects invalid override model format", () => {
    expect(() =>
      resolveModelPolicy({
        task: "highlight_rerank",
        requestedOverrideModel: "whisper-1",
        isDev: true,
      }),
    ).toThrow(/provider\/model/);
  });

  it("returns fallback chains and long video reason", () => {
    const policy = resolveModelPolicy({
      task: "highlight_rerank",
      qualityMode: "balanced",
      userPlan: "pro",
      videoDurationSec: 2_400,
    });
    expect(policy.fallbackModels.length).toBeGreaterThan(0);
    expect(policy.modelSelectionReason).toMatch(/Long video/);
  });

  it("normalizes clip intent", () => {
    expect(normalizeClipIntent("quotes")).toBe("quotes");
    expect(normalizeClipIntent("unknown")).toBe("auto");
  });

  it("gates debug by environment/admin context", () => {
    expect(canUseModelDebug({ isDev: true })).toBe(true);
    expect(canUseModelDebug({ isDev: false, isAdmin: false })).toBe(false);
    expect(canUseModelDebug({ isDev: false, isAdmin: true })).toBe(true);
  });
});
