import "openai/shims/node";

process.env.OPENAI_API_KEY = "";
process.env.OPENROUTER_API_KEY = "";

const {
  buildResearchInboxDraftSeed,
  mergeResearchInboxLabels,
  buildResearchInboxReplyFallback,
  buildResearchInboxRemixFallback,
  mapResearchInboxItem,
  normalizeResearchInboxLabels,
} = require("@/lib/snipradar/inbox");
const {
  buildFallbackInboxEnrichment,
  generateInboxEnrichment,
} = require("@/lib/ai/research-inbox");
const {
  analyzeSnipRadarExtensionSource,
  generateSnipRadarExtensionReply,
  generateSnipRadarExtensionReplyVariants,
  generateSnipRadarExtensionRemix,
  getSnipRadarExtensionModelConfig,
} = require("@/lib/ai/snipradar-extension");

describe("research inbox helpers", () => {
  it("builds a draft seed from a saved capture", () => {
    const seed = buildResearchInboxDraftSeed({
      title: "Capture from @builder",
      text: "Most creators underuse proof in their CTA.",
      authorUsername: "builder",
      note: "Strong conversion angle",
      itemType: "tweet",
    });

    expect(seed).toContain("Write an original X post inspired");
    expect(seed).toContain("@builder");
    expect(seed).toContain("Strong conversion angle");
  });

  it("maps inbox items into UI-safe payloads", () => {
    const mapped = mapResearchInboxItem({
      id: "item-1",
      source: "browser_extension",
      itemType: "tweet",
      sourceUrl: "https://x.com/builder/status/1",
      xEntityId: "1",
      title: "Capture",
      text: "Source text",
      authorUsername: "builder",
      authorDisplayName: "Builder",
      authorAvatarUrl: null,
      status: "new",
      labels: ["extension"],
      note: null,
      generatedReply: null,
      generatedRemix: null,
      metadata: null,
      trackedAccountId: null,
      lastActionAt: null,
      createdAt: new Date("2026-03-06T10:00:00.000Z"),
      updatedAt: new Date("2026-03-06T10:00:00.000Z"),
    });

    expect(mapped.itemType).toBe("tweet");
    expect(mapped.status).toBe("new");
    expect(mapped.draftSeed).toContain("Source text");
  });

  it("normalizes and merges inbox labels for bulk operations", () => {
    expect(normalizeResearchInboxLabels(["  builders  ", "growth", "builders", " "])).toEqual([
      "builders",
      "growth",
    ]);

    expect(mergeResearchInboxLabels(["builders", "research"], ["research", "reply-targets"])).toEqual([
      "builders",
      "research",
      "reply-targets",
    ]);
  });

  it("returns fallback reply and remix text when AI is unavailable", async () => {
    const item = {
      title: "Capture from @builder",
      text: "Strong hooks create curiosity before the CTA.",
      authorUsername: "builder",
      itemType: "tweet",
    };

    const reply = await generateSnipRadarExtensionReply({
      item,
      selectedNiche: "creator growth",
      styleProfile: null,
    });
    const remix = await generateSnipRadarExtensionRemix({
      item,
      selectedNiche: "creator growth",
      styleProfile: null,
    });

    expect(reply).toBe(buildResearchInboxReplyFallback(item, "creator growth"));
    expect(remix).toBe(buildResearchInboxRemixFallback(item, "creator growth"));
    expect(reply.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(20);
    expect(reply.length).toBeLessThanOrEqual(120);
    expect(remix.length).toBeLessThanOrEqual(280);
  });

  it("returns 3 labeled fallback reply variants when AI is unavailable", async () => {
    const item = {
      title: "Codex Security launch",
      text: "Codex Security is free during research preview. Turn it on.",
      authorUsername: "rohanvarma",
      itemType: "tweet",
    };

    const variants = await generateSnipRadarExtensionReplyVariants({
      item,
      selectedNiche: "ai tools",
      styleProfile: null,
    });

    expect(variants).toHaveLength(3);
    expect(variants.map((variant) => variant.tone)).toEqual([
      "insightful",
      "agreeable",
      "spicy",
    ]);
    expect(variants.every((variant) => typeof variant.text === "string" && variant.text.length > 0)).toBe(true);
  });

  it("falls back to mock provider when neither OpenAI nor OpenRouter is configured", () => {
    const config = getSnipRadarExtensionModelConfig();

    expect(config.analysis.provider).toBe("mock");
    expect(config.reply.provider).toBe("mock");
    expect(config.remix.provider).toBe("mock");
  });

  it("builds a topical fallback reply for preview and security launch posts", () => {
    const reply = buildResearchInboxReplyFallback(
      {
        title: "Codex Security launch",
        text: "Codex Security is free during research preview. Turn it on.",
        authorUsername: "rohanvarma",
        itemType: "tweet",
      },
      "ai tools"
    );

    expect(reply).toBe("Free in preview is an easy yes.");
  });

  it("builds a topical fallback reply for docs and desktop update posts", () => {
    const reply = buildResearchInboxReplyFallback(
      {
        title: "Claude Code desktop docs",
        text: "Get started with Claude Code desktop here. Update to the latest version.",
        authorUsername: "trq212",
        itemType: "tweet",
      },
      "developer tools"
    );

    expect(reply).toBe("Desktop docs cut onboarding friction fast.");
  });

  it("builds a topical fallback reply for grounded AGI skepticism posts", () => {
    const reply = buildResearchInboxReplyFallback(
      {
        title: "A bot still can't solve for vada pav",
        text: "At this point, a bot can't solve for vada pav, leave alone AGI.",
        authorUsername: "chandrarsrikant",
        itemType: "tweet",
      },
      "ai tools"
    );

    expect(reply).toBe("AGI can wait till support basics work.");
  });

  it("analyzes the source post before generation when AI is unavailable", async () => {
    const analysis = await analyzeSnipRadarExtensionSource({
      item: {
        title: "Codex Security launch",
        text: "Codex Security is free during research preview. Turn it on.",
        authorUsername: "rohanvarma",
        itemType: "tweet",
      },
      selectedNiche: "ai tools",
    });

    expect(analysis.source).toBe("heuristic_fallback");
    expect(analysis.intent).toBe("promotion");
    expect(analysis.hookType).toBe("launch");
    expect(analysis.topics).toContain("security");
    expect(analysis.keyTerms).toContain("codex");
    expect(analysis.replyAngles.length).toBeGreaterThan(0);
  });

  it("builds fallback inbox enrichment when AI is unavailable", async () => {
    const input = {
      itemType: "tweet",
      title: null,
      text: "Most creator CTAs fail because they ask too early and show no proof.",
      authorUsername: "builder",
      selectedNiche: "creator growth",
    };

    const fallback = buildFallbackInboxEnrichment(input);
    const generated = await generateInboxEnrichment(input);

    expect(fallback.labels.length).toBeGreaterThan(0);
    expect(generated.source).toBe("heuristic_fallback");
    expect(generated.summary).toContain("Saved tweet");
    expect(generated.labels.length).toBeGreaterThan(0);
  });
});
