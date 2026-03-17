import { getActiveClient } from "@/lib/openrouter-client";

type ResearchSynthesisSource =
  | "viral_tweet"
  | "opportunity"
  | "draft"
  | "template"
  | "hooksmith_script"
  | "content_idea"
  | "inbox_capture";

export type ResearchSynthesisResult = {
  id: string;
  source: ResearchSynthesisSource;
  title: string;
  body: string;
  meta: string[];
  score: number;
  matchReasons: string[];
  draftSeed: string;
  sourceUpdatedAt: string | null;
};

export type ResearchSynthesisCitation = {
  id: string;
  source: ResearchSynthesisSource;
  title: string;
  reason: string;
};

export type ResearchSynthesis = {
  source: "ai" | "heuristic_fallback";
  answer: string;
  keyThemes: string[];
  recommendedAngles: string[];
  suggestedFormats: string[];
  draftStarter: string;
  citations: ResearchSynthesisCitation[];
};

const RESEARCH_COPILOT_TIMEOUT_MS = Number(
  process.env.OPENAI_SNIPRADAR_RESEARCH_BRIEF_TIMEOUT_MS ?? 12_000
);

const RESEARCH_BRIEF_TARGET = getActiveClient(null, "snipradarResearchBrief");

function uniqStrings(values: string[], maxItems: number) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).slice(0, maxItems);
}

function clip(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function normalizeSourceLabel(source: ResearchSynthesisSource) {
  return source.replace(/_/g, " ");
}

function buildStarterDraft(query: string, results: ResearchSynthesisResult[]) {
  const top = results[0];
  if (!top) {
    return clip(`Strong angle on ${query}: lead with one sharp insight, back it with proof, and end with a clear CTA.`, 280);
  }

  const lead = top.body.replace(/\s+/g, " ").trim();
  return clip(
    `${query}: ${lead}. My take: here's the pattern worth stealing and how I'd adapt it for my audience.`,
    280
  );
}

export function buildFallbackResearchSynthesis(params: {
  query: string;
  results: ResearchSynthesisResult[];
}): ResearchSynthesis | null {
  const topResults = params.results.slice(0, 5);
  if (topResults.length === 0) return null;

  const keyThemes = uniqStrings(
    topResults.flatMap((result) => [...result.meta, ...result.matchReasons]).map((item) => clip(item, 70)),
    4
  );

  const recommendedAngles = uniqStrings(
    topResults.map((result) => {
      const strongestReason = result.matchReasons[0] ?? normalizeSourceLabel(result.source);
      return clip(`Use ${result.title.toLowerCase()} as a base and reframe it around ${strongestReason.toLowerCase()}.`, 120);
    }),
    3
  );

  const suggestedFormats = uniqStrings(
    topResults.flatMap((result) => result.meta.filter((item) => item.length <= 24)),
    4
  );

  return {
    source: "heuristic_fallback",
    answer: clip(
      `Top matches for "${params.query}" cluster around ${keyThemes.slice(0, 2).join(" and ") || "high-signal patterns"}. Start from the strongest result, then convert the idea into an original post with a sharper opinion and clearer payoff.`,
      420
    ),
    keyThemes,
    recommendedAngles,
    suggestedFormats,
    draftStarter: buildStarterDraft(params.query, topResults),
    citations: topResults.slice(0, 4).map((result) => ({
      id: result.id,
      source: result.source,
      title: result.title,
      reason: result.matchReasons[0] ?? normalizeSourceLabel(result.source),
    })),
  };
}

function sanitizeCitations(
  value: unknown,
  results: ResearchSynthesisResult[]
): ResearchSynthesisCitation[] {
  if (!Array.isArray(value)) return [];

  const resultMap = new Map(results.map((result) => [result.id, result]));
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id : "";
      const result = resultMap.get(id);
      if (!result) return null;
      return {
        id: result.id,
        source: result.source,
        title:
          typeof candidate.title === "string" && candidate.title.trim()
            ? clip(candidate.title, 90)
            : result.title,
        reason:
          typeof candidate.reason === "string" && candidate.reason.trim()
            ? clip(candidate.reason, 120)
            : result.matchReasons[0] ?? normalizeSourceLabel(result.source),
      } satisfies ResearchSynthesisCitation;
    })
    .filter(Boolean)
    .slice(0, 4) as ResearchSynthesisCitation[];
}

export async function generateResearchSynthesis(params: {
  query: string;
  results: ResearchSynthesisResult[];
  selectedNiche?: string | null;
}): Promise<ResearchSynthesis | null> {
  const fallback = buildFallbackResearchSynthesis(params);
  if (!RESEARCH_BRIEF_TARGET.client || !RESEARCH_BRIEF_TARGET.model || params.results.length === 0) {
    return fallback;
  }

  const contextResults = params.results.slice(0, 8).map((result) => ({
    id: result.id,
    source: result.source,
    title: result.title,
    body: result.body,
    meta: result.meta,
    score: result.score,
    matchReasons: result.matchReasons,
  }));

  const system = `You are SnipRadar Research Copilot.

You synthesize indexed X research results into a concise working brief for a creator.

Rules:
- use only the provided results
- surface patterns, not generic advice
- keep recommendations specific to the query
- suggest original angles, not copies
- draftStarter must be <= 280 characters
- cite only result ids that exist in the provided list
- return valid JSON only

Return exactly:
{
  "answer": "string",
  "keyThemes": ["string", "string", "string"],
  "recommendedAngles": ["string", "string", "string"],
  "suggestedFormats": ["string", "string", "string"],
  "draftStarter": "string <= 280 chars",
  "citations": [
    { "id": "string", "title": "string", "reason": "string" }
  ]
}`;

  try {
    const completion = await Promise.race([
      RESEARCH_BRIEF_TARGET.client.chat.completions.create({
        model: RESEARCH_BRIEF_TARGET.model,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({
              query: params.query,
              selectedNiche: params.selectedNiche ?? "general",
              results: contextResults,
            }),
          },
        ],
        response_format: { type: "json_object" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("TIMEOUT: Research synthesis exceeded deadline.")),
          RESEARCH_COPILOT_TIMEOUT_MS
        )
      ),
    ]);

    const content = completion.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const citations = sanitizeCitations(parsed.citations, params.results);

    return {
      source: "ai",
      answer:
        typeof parsed.answer === "string" && parsed.answer.trim()
          ? clip(parsed.answer, 420)
          : fallback?.answer ?? "",
      keyThemes: uniqStrings(
        Array.isArray(parsed.keyThemes)
          ? parsed.keyThemes.filter((item): item is string => typeof item === "string").map((item) => clip(item, 90))
          : fallback?.keyThemes ?? [],
        4
      ),
      recommendedAngles: uniqStrings(
        Array.isArray(parsed.recommendedAngles)
          ? parsed.recommendedAngles.filter((item): item is string => typeof item === "string").map((item) => clip(item, 120))
          : fallback?.recommendedAngles ?? [],
        4
      ),
      suggestedFormats: uniqStrings(
        Array.isArray(parsed.suggestedFormats)
          ? parsed.suggestedFormats.filter((item): item is string => typeof item === "string").map((item) => clip(item, 40))
          : fallback?.suggestedFormats ?? [],
        4
      ),
      draftStarter:
        typeof parsed.draftStarter === "string" && parsed.draftStarter.trim()
          ? clip(parsed.draftStarter, 280)
          : fallback?.draftStarter ?? buildStarterDraft(params.query, params.results),
      citations:
        citations.length > 0
          ? citations
          : fallback?.citations ?? [],
    };
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith("TIMEOUT:")) {
      console.warn("[SnipRadar][Research] Synthesis timed out, using fallback.");
      return fallback;
    }
    if (error?.status === 429) {
      console.warn("[SnipRadar][Research] Rate limited during synthesis, using fallback.");
      return fallback;
    }
    console.error("[SnipRadar][Research] AI synthesis failed", error);
    return fallback;
  }
}
