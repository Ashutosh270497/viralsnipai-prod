import {
  canUseModelDebug,
  normalizeClipIntent,
  resolveModelPolicy,
} from "@/lib/ai/model-policy";
import { PROVIDER_POLICY } from "@/lib/ai/provider-policy";
import { CLIP_INTENT_OPTIONS, QUALITY_MODE_OPTIONS } from "@/lib/ai/model-routing-options";

describe("model policy", () => {
  it("resolves fast, balanced, and best rerank policies", () => {
    expect(resolveModelPolicy({ task: "highlight_rerank", qualityMode: "fast", userPlan: "free" }).costTier).toBe("low");
    expect(resolveModelPolicy({ task: "highlight_rerank", qualityMode: "balanced", userPlan: "plus" }).costTier).toBe("medium");
    expect(resolveModelPolicy({ task: "highlight_rerank", qualityMode: "best", userPlan: "pro" }).costTier).toBe("high");
  });

  it("uses Claude Sonnet 4.6 for best quality highlight reranking", () => {
    const policy = resolveModelPolicy({ task: "highlight_rerank", qualityMode: "best", userPlan: "pro" });
    expect(policy.primaryModel).toBe("anthropic/claude-sonnet-4.6");
    expect(policy.fallbackModels).toEqual([
      "openai/gpt-5.2",
      "google/gemini-3.1-pro-preview",
      "qwen/qwen3.6-plus",
    ]);
  });

  it("uses Claude Sonnet 4.6 for best quality virality and metadata reasoning", () => {
    const virality = resolveModelPolicy({ task: "virality_score", qualityMode: "best", userPlan: "pro" });
    const metadata = resolveModelPolicy({ task: "clip_metadata", qualityMode: "best", userPlan: "pro" });
    expect(virality.primaryModel).toBe("anthropic/claude-sonnet-4.6");
    expect(metadata.primaryModel).toBe("anthropic/claude-sonnet-4.6");
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

  it("keeps normal user routing labels free of raw model IDs", () => {
    const visibleLabels = [
      ...QUALITY_MODE_OPTIONS.map((option) => `${option.label} ${option.value}`),
      ...CLIP_INTENT_OPTIONS.map((option) => `${option.label} ${option.value}`),
    ].join(" ");
    expect(visibleLabels).not.toMatch(/anthropic\/|openai\/|google\/|qwen\//);
    expect(visibleLabels).not.toMatch(/claude|gemini|gpt|qwen/i);
  });

  it("keeps transcription assigned to OpenAI outside OpenRouter reasoning policy", () => {
    expect(PROVIDER_POLICY.transcription).toBe("openai");
    expect(PROVIDER_POLICY.candidateReranking).toBe("openrouter");
    expect(PROVIDER_POLICY.viralityScoring).toBe("openrouter");
    expect(PROVIDER_POLICY.boundaryRefinement).toBe("local");
  });
});
