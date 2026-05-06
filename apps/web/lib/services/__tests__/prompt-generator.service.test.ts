import {
  buildPromptGeneratorTranscriptSample,
  extractPlainTranscriptText,
  generateLocalPromptFallback,
  GeneratedPromptsSchema,
  PromptGeneratorService,
} from "@/lib/services/prompt-generator.service";
import { openRouterJson } from "@/lib/ai/providers/openrouter-reasoning-provider";

jest.mock("@/lib/ai/providers/openrouter-reasoning-provider", () => ({
  openRouterJson: jest.fn(),
}));

const mockedOpenRouterJson = openRouterJson as jest.MockedFunction<typeof openRouterJson>;

describe("PromptGeneratorService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns validated prompts from OpenRouter using prompt policy defaults", async () => {
    mockedOpenRouterJson.mockResolvedValueOnce({
      data: {
        brief:
          "Find moments where the speaker explains the core growth idea, gives concrete examples, and lands a useful takeaway.",
        audience: "Founders and creators looking for practical growth advice from the video.",
        tone: "Clear, practical, confident, and concise.",
        callToAction: "Follow for more practical growth breakdowns from the full conversation.",
        reasoning:
          "The transcript contains advice-oriented sections with concrete examples. These moments should work as standalone clips.",
      },
      model: "openai/gpt-5.2",
      latencyMs: 1200,
    });

    const result = await new PromptGeneratorService().generateFromTranscript({
      transcript: "This video explains startup growth, customer retention, and creator distribution tactics. ".repeat(30),
      qualityMode: "balanced",
      userPlan: "pro",
    });

    expect(result.source).toBe("ai");
    expect(result.model).toBe("openai/gpt-5.2");
    expect(mockedOpenRouterJson).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-5.2",
        timeoutMs: 90_000,
      }),
    );
    expect(GeneratedPromptsSchema.safeParse(result.prompts).success).toBe(true);
  });

  it("falls back locally when all OpenRouter models fail", async () => {
    mockedOpenRouterJson.mockRejectedValue(new Error("OpenRouter timeout"));

    const result = await new PromptGeneratorService().generateFromTranscript({
      transcript:
        "The speaker explains retention, activation, onboarding, and revenue growth with 30 percent improvement examples. ".repeat(25),
      customInstructions: "Focus on growth advice",
      qualityMode: "fast",
    });

    expect(result.source).toBe("local_fallback");
    expect(result.warning).toMatch(/fallback/i);
    expect(result.prompts.brief).toMatch(/retention|activation|growth/i);
    expect(GeneratedPromptsSchema.safeParse(result.prompts).success).toBe(true);
  });

  it("extracts plain text from canonical transcript JSON", () => {
    const text = extractPlainTranscriptText(JSON.stringify({
      text: "This is the clean transcript text.",
      segments: [{ text: "Segment fallback." }],
    }));

    expect(text).toBe("This is the clean transcript text.");
  });

  it("samples beginning, middle, and ending for long transcripts", () => {
    const transcript = [
      "beginning topic ".repeat(600),
      "middle lesson ".repeat(600),
      "ending takeaway ".repeat(600),
    ].join(" ");

    const sample = buildPromptGeneratorTranscriptSample(transcript, 3000);

    expect(sample).toContain("Transcript beginning");
    expect(sample).toContain("Transcript middle");
    expect(sample).toContain("Transcript ending");
    expect(sample.length).toBeLessThanOrEqual(3000);
  });

  it("creates local fallback prompts that pass schema validation", () => {
    const prompts = generateLocalPromptFallback({
      transcript: "Retention retention onboarding onboarding growth growth 42 percent practical advice. ".repeat(20),
      platform: "YouTube Shorts",
    });

    expect(GeneratedPromptsSchema.safeParse(prompts).success).toBe(true);
  });
});
