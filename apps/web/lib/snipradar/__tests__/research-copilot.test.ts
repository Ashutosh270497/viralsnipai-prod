import "openai/shims/node";

process.env.OPENAI_API_KEY = "";

const { buildFallbackResearchSynthesis } = require("@/lib/ai/research-copilot");

describe("buildFallbackResearchSynthesis", () => {
  it("builds a usable fallback brief from ranked research results", () => {
    const synthesis = buildFallbackResearchSynthesis({
      query: "creator proof",
      results: [
        {
          id: "viral-1",
          source: "viral_tweet",
          title: "Viral tweet from @builder",
          body: "Share the before/after metric before explaining the tactic.",
          meta: ["case study", "contrarian"],
          score: 92,
          matchReasons: ["Direct phrase match", "High-performing precedent (91/100 viral score)"],
          draftSeed: "seed one",
          sourceUpdatedAt: "2026-03-05T10:00:00.000Z",
        },
        {
          id: "idea-1",
          source: "content_idea",
          title: "Content idea: Before/after clip",
          body: "Turn creator metrics into a short case study.",
          meta: ["short", "growth"],
          score: 84,
          matchReasons: ["High-upside content idea (88/100 virality)"],
          draftSeed: "seed two",
          sourceUpdatedAt: "2026-03-04T10:00:00.000Z",
        },
      ],
    });

    expect(synthesis).not.toBeNull();
    expect(synthesis.source).toBe("heuristic_fallback");
    expect(synthesis.answer).toContain("creator proof");
    expect(synthesis.citations).toHaveLength(2);
    expect(synthesis.draftStarter.length).toBeLessThanOrEqual(280);
    expect(synthesis.recommendedAngles.length).toBeGreaterThan(0);
  });
});
