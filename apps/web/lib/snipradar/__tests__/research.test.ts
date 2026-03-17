import "openai/shims/node";

process.env.OPENAI_API_KEY = "";

jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

jest.mock("@/lib/data/viral-templates", () => ({
  getViralTemplates: () => [],
}));

const { rankResearchDocuments } = require("@/lib/snipradar/research");

describe("rankResearchDocuments", () => {
  it("prioritizes direct lexical matches with strong source quality", () => {
    const ranked = rankResearchDocuments(
      [
        {
          id: "viral-1",
          source: "viral_tweet",
          sourceRecordId: "viral-1",
          title: "Viral tweet from @builder",
          snippet: "Contrarian hook about creator growth and waitlist conversions.",
          tags: ["contrarian", "creator growth", "cta"],
          metadata: {
            viralScore: 91,
            likes: 1200,
            hookType: "contrarian",
          },
          normalizedText: "contrarian hook about creator growth and waitlist conversions",
          sourceUpdatedAt: new Date("2026-03-05T12:00:00.000Z"),
          embedding: null,
        },
        {
          id: "template-1",
          source: "template",
          sourceRecordId: "template-1",
          title: "hook template",
          snippet: "General template for product launches.",
          tags: ["hook", "launch"],
          metadata: {
            qualityScore: 82,
            intent: "authority",
          },
          normalizedText: "general template for product launches",
          sourceUpdatedAt: null,
          embedding: null,
        },
      ],
      "creator growth",
      null
    );

    expect(ranked[0]?.id).toBe("viral-1");
    expect(ranked[0]?.matchReasons).toContain("Direct phrase match");
    expect(ranked[0]?.matchReasons).toContain("High-performing precedent (91/100 viral score)");
  });

  it("uses embeddings to surface semantic matches beyond direct phrase overlap", () => {
    const ranked = rankResearchDocuments(
      [
        {
          id: "draft-1",
          source: "draft",
          sourceRecordId: "draft-1",
          title: "Existing draft",
          snippet: "A post about founder storytelling and launch proof.",
          tags: ["story", "authority"],
          metadata: {
            viralPrediction: 78,
          },
          normalizedText: "founder storytelling and launch proof",
          sourceUpdatedAt: new Date("2026-03-04T10:00:00.000Z"),
          embedding: [0.9, 0.1, 0],
        },
        {
          id: "opportunity-1",
          source: "opportunity",
          sourceRecordId: "opportunity-1",
          title: "Engagement opportunity: @creator",
          snippet: "People are debating reply strategy.",
          tags: ["reply", "engagement"],
          metadata: {
            score: 64,
          },
          normalizedText: "people are debating reply strategy",
          sourceUpdatedAt: new Date("2026-03-04T10:00:00.000Z"),
          embedding: [0, 1, 0],
        },
      ],
      "founder proof",
      [1, 0, 0]
    );

    expect(ranked[0]?.id).toBe("draft-1");
    expect(ranked[0]?.totalScore).toBeGreaterThan(ranked[1]?.totalScore ?? 0);
    expect(ranked[0]?.matchReasons).toContain("Strong semantic match");
  });
});
