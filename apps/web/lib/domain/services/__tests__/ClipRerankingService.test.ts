import { ClipRerankingService } from "@/lib/domain/services/ClipRerankingService";
import type { ClipCandidate } from "@/lib/domain/services/ClipCandidateGenerationService";
import { rerankClipCandidates } from "@/lib/ai/providers/openrouter-reasoning-provider";

jest.mock("@/lib/ai/providers/openrouter-reasoning-provider", () => ({
  rerankClipCandidates: jest.fn(),
}));

const mockedRerankClipCandidates = rerankClipCandidates as jest.MockedFunction<typeof rerankClipCandidates>;

function makeCandidate(id: string, score: number, text = "Stop making this mistake because the result improves by 30 percent."): ClipCandidate {
  return {
    id,
    startMs: Number(id.replace(/\D/g, "")) * 40_000,
    endMs: Number(id.replace(/\D/g, "")) * 40_000 + 36_000,
    text,
    firstWords: text.split(/\s+/).slice(0, 18).join(" "),
    lastWords: text.split(/\s+/).slice(-18).join(" "),
    candidateType: "hook",
    wordStartIndex: null,
    wordEndIndex: null,
    sourceSegmentIds: [`seg-${id}`],
    deterministicScore: score,
    qualitySignals: {
      overallScore: score,
      durationFit: 90,
      transcriptDensity: 82,
      sceneAlignment: 84,
      cutCleanliness: 88,
      pacingConsistency: 86,
      hardCutRisk: "low",
      contentDensity: "balanced",
      wordsPerMinute: 170,
      transcriptSegmentCount: 1,
      sceneCutsInside: 0,
      boundaryDistanceMs: 600,
      reasons: [],
    },
    reasons: ["Strong hook"],
    transcriptPrecision: "word",
  };
}

describe("ClipRerankingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tries json_schema then json_object for the same model before falling back", async () => {
    mockedRerankClipCandidates
      .mockRejectedValueOnce(new Error("schema failed"))
      .mockResolvedValueOnce({
        selected: [{
          candidateId: "cand-001",
          rank: 1,
          title: "Strong hook",
          hook: "Stop making this mistake",
          callToAction: null,
          llmScore: 91,
          viralReason: "Clear hook",
          editingNotes: [],
          platformFit: { youtubeShorts: 90, instagramReels: 90, tiktok: 90, x: 90 },
          finalScore: 90,
        }],
        overallWarnings: [],
        model: "google/gemini-3-flash-preview",
        structuredMode: "json_object",
      });

    const result = await new ClipRerankingService().rerank({
      candidates: [makeCandidate("cand-001", 86)],
      targetClipCount: 1,
      transcriptPrecision: "word",
      sourceDurationSec: 180,
      modelPolicy: {
        task: "highlight_rerank",
        qualityMode: "balanced",
        userPlan: "pro",
        provider: "openrouter",
        primaryModel: "google/gemini-3-flash-preview",
        fallbackModels: ["qwen/qwen3.6-plus"],
        maxTokens: 5000,
        temperature: 0.2,
        timeoutMs: 180_000,
        structuredOutputMode: "auto",
        costTier: "medium",
        modelSelectionReason: "test",
      },
    });

    expect(mockedRerankClipCandidates).toHaveBeenNthCalledWith(1, expect.objectContaining({
      model: "google/gemini-3-flash-preview",
      structuredMode: "json_schema",
      maxAttempts: 1,
    }));
    expect(mockedRerankClipCandidates).toHaveBeenNthCalledWith(2, expect.objectContaining({
      model: "google/gemini-3-flash-preview",
      structuredMode: "json_object",
      maxAttempts: 1,
    }));
    expect(result.structuredMode).toBe("json_object");
    expect(result.deterministicFallbackUsed).toBe(false);
  });

  it("uses deterministic fallback after all rerank models fail", async () => {
    mockedRerankClipCandidates.mockRejectedValue(new Error("provider down"));
    const result = await new ClipRerankingService().rerank({
      candidates: [
        makeCandidate("cand-001", 68, "so this is a weak intro with filler words basically actually"),
        makeCandidate("cand-002", 82, "Stop making this mistake because revenue improved by 30 percent."),
        makeCandidate("cand-003", 74, "Here is a normal middle section about the topic."),
      ],
      targetClipCount: 1,
      transcriptPrecision: "word",
      sourceDurationSec: 180,
      modelPolicy: {
        task: "highlight_rerank",
        qualityMode: "fast",
        userPlan: "free",
        provider: "openrouter",
        primaryModel: "google/gemini-3-flash-preview",
        fallbackModels: ["qwen/qwen3.6-plus"],
        maxTokens: 3200,
        temperature: 0.2,
        timeoutMs: 180_000,
        structuredOutputMode: "auto",
        costTier: "low",
        modelSelectionReason: "test",
      },
    });

    expect(result.model).toBe("deterministic_fallback");
    expect(result.deterministicFallbackUsed).toBe(true);
    expect(result.selected[0].candidateId).toBe("cand-002");
    expect(result.selected[0].viralReason).toMatch(/deterministic/i);
  });
});
