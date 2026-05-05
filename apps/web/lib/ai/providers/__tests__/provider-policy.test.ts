import { PROVIDER_POLICY } from "@/lib/ai/provider-policy";

describe("PROVIDER_POLICY", () => {
  it("routes precision transcription to OpenAI and reasoning to OpenRouter", () => {
    expect(PROVIDER_POLICY.transcription).toBe("openai");
    expect(PROVIDER_POLICY.diarization).toBe("openai");
    expect(PROVIDER_POLICY.candidateGeneration).toBe("local");
    expect(PROVIDER_POLICY.boundaryRefinement).toBe("local");
    expect(PROVIDER_POLICY.candidateReranking).toBe("openrouter");
    expect(PROVIDER_POLICY.viralityScoring).toBe("openrouter");
    expect(PROVIDER_POLICY.titleHookGeneration).toBe("openrouter");
  });
});
