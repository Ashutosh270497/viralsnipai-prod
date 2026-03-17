import OpenAI from "openai";

import { getActiveClient } from "@/lib/openrouter-client";
import type { StyleProfile } from "@/lib/ai/style-trainer";
import {
  buildResearchInboxRemixFallback,
  buildResearchInboxReplyFallback,
  type ResearchInboxRecord,
} from "@/lib/snipradar/inbox";

const DEFAULT_OPENAI_EXTENSION_MODEL =
  process.env.OPENAI_SNIPRADAR_EXTENSION_MODEL?.trim() ??
  "gpt-5-mini";
const OPENAI_EXTENSION_ANALYSIS_MODEL =
  process.env.OPENAI_SNIPRADAR_EXTENSION_ANALYSIS_MODEL?.trim() ??
  DEFAULT_OPENAI_EXTENSION_MODEL;
const OPENAI_EXTENSION_REPLY_MODEL =
  process.env.OPENAI_SNIPRADAR_EXTENSION_REPLY_MODEL?.trim() ??
  DEFAULT_OPENAI_EXTENSION_MODEL;
const OPENAI_EXTENSION_REMIX_MODEL =
  process.env.OPENAI_SNIPRADAR_EXTENSION_REMIX_MODEL?.trim() ??
  DEFAULT_OPENAI_EXTENSION_MODEL;
const EXTENSION_TIMEOUT_MS = Number(
  process.env.OPENAI_SNIPRADAR_EXTENSION_TIMEOUT_MS ?? 10_000
);

const hasOpenAiApiKey = Boolean(process.env.OPENAI_API_KEY);
const openAiClient = hasOpenAiApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

type ExtensionAiTask = "analysis" | "reply" | "remix";

type ExtensionAiTarget = {
  client: OpenAI | null;
  model: string | null;
  provider: "openrouter" | "openai" | "mock";
};

export const SNIPRADAR_EXTENSION_SOURCE_ANALYSIS_VERSION = 2;

function getExtensionAiTarget(task: ExtensionAiTask): ExtensionAiTarget {
  const featureMap = {
    analysis: "extensionAnalysis",
    reply: "extensionReply",
    remix: "extensionRemix",
  } as const;
  const openAiModelMap = {
    analysis: OPENAI_EXTENSION_ANALYSIS_MODEL,
    reply: OPENAI_EXTENSION_REPLY_MODEL,
    remix: OPENAI_EXTENSION_REMIX_MODEL,
  } as const;

  const resolved = getActiveClient(openAiClient, featureMap[task]);
  return {
    client: resolved.client,
    model: resolved.model ?? openAiModelMap[task],
    provider: resolved.provider,
  };
}

export function getSnipRadarExtensionModelConfig() {
  return {
    analysis: getExtensionAiTarget("analysis"),
    reply: getExtensionAiTarget("reply"),
    remix: getExtensionAiTarget("remix"),
  };
}

export type SnipRadarExtensionSourceAnalysis = {
  source: "ai" | "heuristic_fallback";
  summary: string;
  primaryClaim: string;
  intent: "announcement" | "opinion" | "prediction" | "advice" | "question" | "promotion" | "other";
  stance: "bullish" | "skeptical" | "neutral" | "promotional";
  hookType:
    | "launch"
    | "pricing"
    | "metric"
    | "prediction"
    | "contrarian"
    | "tutorial"
    | "question"
    | "social_proof"
    | "other";
  topics: string[];
  keyTerms: string[];
  replyAngles: string[];
};

export const SNIPRADAR_REPLY_TONES = ["insightful", "agreeable", "spicy"] as const;
export type SnipRadarReplyTone = (typeof SNIPRADAR_REPLY_TONES)[number];

export type SnipRadarExtensionReplyVariant = {
  tone: SnipRadarReplyTone;
  label: string;
  text: string;
};

const SNIPRADAR_REPLY_TONE_LABELS: Record<SnipRadarReplyTone, string> = {
  insightful: "Insightful",
  agreeable: "Agreeable",
  spicy: "Spicy",
};

function clip(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cleanSourceText(value: string | null | undefined) {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .map((line) =>
      line
        .replace(/\b(?:https?:\/\/|pic\.x\.com\/|t\.co\/)\S+/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .filter((line, index, arr) => arr.indexOf(line) === index)
    .join("\n");
}

function uniq(values: string[], maxItems: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, maxItems);
}

function extractJsonObject(value: string) {
  const trimmed = value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function extractTextFieldsFromJsonLike(value: string) {
  const matches = value.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/g) ?? [];

  return uniq(
    matches
      .map((match) => {
        const captured = match.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
        if (!captured) return "";
        try {
          return JSON.parse(`"${captured}"`);
        } catch {
          return captured
            .replace(/\\"/g, '"')
            .replace(/\\n/g, " ")
            .replace(/\\t/g, " ")
            .replace(/\\\\/g, "\\");
        }
      })
      .map(normalizeReplyCandidate)
      .filter(Boolean),
    8
  );
}

function countWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

const REPLY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "up",
  "was",
  "will",
  "with",
  "you",
  "your",
]);

function extractReplyAnchors(...values: Array<string | null | undefined>) {
  const anchors = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const matches = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const match of matches) {
      if (match.length < 4) continue;
      if (REPLY_STOP_WORDS.has(match)) continue;
      anchors.add(match);
    }
  }

  return [...anchors].slice(0, 12);
}

function extractLocalFallbackTerms(value: string) {
  return Array.from(new Set((value.toLowerCase().match(/[a-z0-9]+/g) ?? []))).filter(
    (term) => term.length >= 4 && !REPLY_STOP_WORDS.has(term)
  );
}

function inferIntent(text: string): SnipRadarExtensionSourceAnalysis["intent"] {
  if (/\?/.test(text)) return "question";
  if (/\blaunch|launched|shipping|shipped|introduced|announce|announcing\b/i.test(text)) return "announcement";
  if (/\bfree|preview|beta|discount|pricing|waitlist|sign up|turn it on\b/i.test(text)) return "promotion";
  if (/\bwill|could|by 20\d{2}|next year|soon\b/i.test(text)) return "prediction";
  if (/\bshould|need to|how to|here'?s how|tips\b/i.test(text)) return "advice";
  if (/\bhot take|unpopular|most\b/i.test(text)) return "opinion";
  return "other";
}

function inferStance(text: string): SnipRadarExtensionSourceAnalysis["stance"] {
  if (/\bfree|preview|beta|turn it on|no-brainer|excited\b/i.test(text)) return "promotional";
  if (/\bcould|will|massive|huge|inevitable|no-brainer\b/i.test(text)) return "bullish";
  if (/\bbut|however|skeptical|doubt|not sure\b/i.test(text)) return "skeptical";
  return "neutral";
}

function inferHookType(text: string): SnipRadarExtensionSourceAnalysis["hookType"] {
  if (/\blaunch|launched|ship|shipping|introduced|preview\b/i.test(text)) return "launch";
  if (/\bfree|pricing|discount|cheap|expensive\b/i.test(text)) return "pricing";
  if (/\b\d+[%x]|\b\d[\d,.]*\b|\brevenue|valuation|users|views|impressions\b/i.test(text)) return "metric";
  if (/\bwill|could|by 20\d{2}|next year\b/i.test(text)) return "prediction";
  if (/\bhot take|unpopular|contrarian|most teams\b/i.test(text)) return "contrarian";
  if (/\bhow to|step|tutorial|guide\b/i.test(text)) return "tutorial";
  if (/\?/.test(text)) return "question";
  if (/\bcase study|proof|results|screenshot|tested\b/i.test(text)) return "social_proof";
  return "other";
}

function extractTopics(text: string, selectedNiche?: string | null) {
  const lower = text.toLowerCase();
  const topics = [
    /\bsecurity|secure|vuln|review\b/.test(lower) ? "security" : "",
    /\bcodex\b/.test(lower) ? "codex" : "",
    /\bclaude\b/.test(lower) ? "claude" : "",
    /\bopenai\b/.test(lower) ? "openai" : "",
    /\bpreview|beta|launch\b/.test(lower) ? "launch" : "",
    /\bfree|pricing\b/.test(lower) ? "pricing" : "",
    /\bdesktop\b/.test(lower) ? "desktop" : "",
    /\bdocs?|documentation|guide\b/.test(lower) ? "docs" : "",
    /\bupdate|latest version|upgrade\b/.test(lower) ? "update" : "",
    /\bai|agent|model|llm\b/.test(lower) ? "ai" : "",
    /\bdevsecops|developer|engineering|code\b/.test(lower) ? "developer_tools" : "",
    selectedNiche?.trim().toLowerCase() ?? "",
  ];

  return uniq(topics.filter(Boolean), 6).map((value) => value.toLowerCase());
}

function buildHeuristicReplyAngles(text: string) {
  const lower = text.toLowerCase();
  const angles = [
    /\bfree|preview|beta\b/.test(lower) ? "react to the low-friction timing or free preview" : "",
    /\blaunch|launched|ship|shipping\b/.test(lower) ? "highlight why the launch wedge matters" : "",
    /\bdesktop\b/.test(lower) ? "react to how desktop changes workflow friction" : "",
    /\bdocs?|documentation|guide\b/.test(lower) ? "react to onboarding or adoption friction" : "",
    /\bupdate|latest version|upgrade\b/.test(lower) ? "react to how updates change daily use, not just launch optics" : "",
    /\bsecurity|secure|vuln|review\b/.test(lower) ? "connect to security review adoption or operational habit" : "",
    /\bturn it on|enable|enabled\b/.test(lower) ? "lean into how obvious the activation decision is" : "",
    /\btrillion|billion|revenue|valuation|growth\b/.test(lower) ? "react to the scale implication behind the metric" : "",
  ];

  return uniq(angles.filter(Boolean), 4);
}

function buildHeuristicSourceAnalysis(params: {
  item: Pick<ResearchInboxRecord, "text" | "title" | "authorUsername" | "itemType">;
  selectedNiche?: string | null;
}): SnipRadarExtensionSourceAnalysis {
  const cleanedTitle = cleanSourceText(params.item.title);
  const cleanedText = cleanSourceText(params.item.text);
  const sourceText = clip(
    cleanedText || cleanedTitle || "",
    500
  );
  const topics = extractTopics(sourceText, params.selectedNiche);
  const keyTerms = extractReplyAnchors(cleanedTitle, cleanedText, params.selectedNiche);
  const replyAngles = buildHeuristicReplyAngles(sourceText);

  return {
    source: "heuristic_fallback",
    summary: clip(sourceText || `Saved ${params.item.itemType} from @${params.item.authorUsername ?? "creator"}`, 180),
    primaryClaim: clip(sourceText || "React to the core post claim directly.", 160),
    intent: inferIntent(sourceText),
    stance: inferStance(sourceText),
    hookType: inferHookType(sourceText),
    topics,
    keyTerms,
    replyAngles:
      replyAngles.length > 0 ? replyAngles : ["react to the core claim, not the broad category"],
  };
}

export async function analyzeSnipRadarExtensionSource(params: {
  item: Pick<ResearchInboxRecord, "text" | "title" | "authorUsername" | "itemType">;
  selectedNiche?: string | null;
}): Promise<SnipRadarExtensionSourceAnalysis> {
  const fallback = buildHeuristicSourceAnalysis(params);
  const target = getExtensionAiTarget("analysis");
  if (!target.client || !target.model) return fallback;
  const cleanedTitle = cleanSourceText(params.item.title);
  const cleanedText = cleanSourceText(params.item.text);

  const prompt = `You are SnipRadar Source Analysis.

Analyze this saved X ${params.item.itemType} before writing a reply or remix.

Rules:
- infer the core claim very specifically from the source
- identify the user's real posting intent
- extract concrete key terms from the source
- suggest reply angles that would sound relevant on X
- keep all strings concise
- return valid JSON only

Return exactly:
{
  "summary": "string",
  "primaryClaim": "string",
  "intent": "announcement" | "opinion" | "prediction" | "advice" | "question" | "promotion" | "other",
  "stance": "bullish" | "skeptical" | "neutral" | "promotional",
  "hookType": "launch" | "pricing" | "metric" | "prediction" | "contrarian" | "tutorial" | "question" | "social_proof" | "other",
  "topics": ["string"],
  "keyTerms": ["string"],
  "replyAngles": ["string"]
}`;

  try {
    const response = await Promise.race([
      target.client.chat.completions.create({
        model: target.model,
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: JSON.stringify({
              title: cleanedTitle || null,
              text: cleanedText || null,
              authorUsername: params.item.authorUsername ?? null,
              itemType: params.item.itemType,
              selectedNiche: params.selectedNiche ?? "general",
            }),
          },
        ],
        max_completion_tokens: 400,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT: Extension source analysis exceeded deadline.")), EXTENSION_TIMEOUT_MS)
      ),
    ]);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return fallback;
    const jsonPayload = extractJsonObject(content);
    if (!jsonPayload) return fallback;
    const parsed = JSON.parse(jsonPayload) as Record<string, unknown>;

    const intentOptions: SnipRadarExtensionSourceAnalysis["intent"][] = [
      "announcement",
      "opinion",
      "prediction",
      "advice",
      "question",
      "promotion",
      "other",
    ];
    const stanceOptions: SnipRadarExtensionSourceAnalysis["stance"][] = [
      "bullish",
      "skeptical",
      "neutral",
      "promotional",
    ];
    const hookTypeOptions: SnipRadarExtensionSourceAnalysis["hookType"][] = [
      "launch",
      "pricing",
      "metric",
      "prediction",
      "contrarian",
      "tutorial",
      "question",
      "social_proof",
      "other",
    ];

    return {
      source: "ai",
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? clip(parsed.summary, 180)
          : fallback.summary,
      primaryClaim:
        typeof parsed.primaryClaim === "string" && parsed.primaryClaim.trim()
          ? clip(parsed.primaryClaim, 160)
          : fallback.primaryClaim,
      intent: intentOptions.includes(parsed.intent as SnipRadarExtensionSourceAnalysis["intent"])
        ? (parsed.intent as SnipRadarExtensionSourceAnalysis["intent"])
        : fallback.intent,
      stance: stanceOptions.includes(parsed.stance as SnipRadarExtensionSourceAnalysis["stance"])
        ? (parsed.stance as SnipRadarExtensionSourceAnalysis["stance"])
        : fallback.stance,
      hookType: hookTypeOptions.includes(parsed.hookType as SnipRadarExtensionSourceAnalysis["hookType"])
        ? (parsed.hookType as SnipRadarExtensionSourceAnalysis["hookType"])
        : fallback.hookType,
      topics: uniq(
        Array.isArray(parsed.topics)
          ? parsed.topics.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase())
          : fallback.topics,
        6
      ),
      keyTerms: uniq(
        Array.isArray(parsed.keyTerms)
          ? parsed.keyTerms.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase())
          : fallback.keyTerms,
        8
      ),
      replyAngles: uniq(
        Array.isArray(parsed.replyAngles)
          ? parsed.replyAngles.filter((item): item is string => typeof item === "string")
          : fallback.replyAngles,
        4
      ),
    };
  } catch (error: any) {
    if (error?.status === 429) {
      console.warn("[SnipRadar Extension] Source analysis rate limited, using fallback.");
      return fallback;
    }
    if (error instanceof Error && error.message.startsWith("TIMEOUT:")) {
      console.warn("[SnipRadar Extension] Source analysis timed out, using fallback.");
      return fallback;
    }
    console.error("[SnipRadar Extension] Source analysis failed", error);
    return fallback;
  }
}

function normalizeReplyCandidate(value: string) {
  return value
    .replace(/^[-*•\d.\s]+/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function labelReplyTone(tone: SnipRadarReplyTone) {
  return SNIPRADAR_REPLY_TONE_LABELS[tone];
}

const BANNED_REPLY_PATTERNS = [
  /\bstrong take\b/i,
  /\bgreat point\b/i,
  /\binteresting\b/i,
  /\bi agree\b/i,
  /\bexactly\b/i,
  /\b100%\b/i,
  /\bi'?d push\b/i,
  /\bthe part that stands out\b/i,
  /\bthis is\b/i,
  /\bworth watching\b/i,
  /\bworth seeing\b/i,
];

const GENERIC_ABSTRACT_REPLY_PATTERNS = [
  /\bpace\b/i,
  /\bceiling\b/i,
  /\bsecond-order\b/i,
  /\bimplication\b/i,
  /\bcompounding\b/i,
  /\bheadline\b/i,
  /\breal wedge\b/i,
  /\bangle matters\b/i,
  /\bedge compounds\b/i,
  /\bworkflow shift\b/i,
  /\breal story\b/i,
  /\bgets real\b/i,
  /\bmatters more than\b/i,
];

const WEAK_REPLY_OPENERS = [/^(this|that|it|the)\b/i, /^(worth|maybe|feels like)\b/i];

function countAnchorMatches(value: string, anchors: string[]) {
  const lower = value.toLowerCase();
  return anchors.filter((anchor) => lower.includes(anchor)).length;
}

function scoreReplyCandidate(value: string, anchors: string[]) {
  const normalized = normalizeReplyCandidate(value);
  if (!normalized) return -1000;

  let score = 0;
  const words = countWords(normalized);
  const chars = normalized.length;
  const lower = normalized.toLowerCase();
  const matchedAnchors = anchors.filter((anchor) => lower.includes(anchor));

  if (words <= 20) score += 40;
  else score -= 100;

  if (words >= 6 && words <= 14) score += 25;
  if (chars <= 90) score += 10;
  if (!/[#:;"“”]/.test(normalized)) score += 8;
  if (normalized.split(/[.!?]/).filter(Boolean).length === 1) score += 6;
  if (/[.!?]$/.test(normalized)) score += 2;

  for (const pattern of BANNED_REPLY_PATTERNS) {
    if (pattern.test(normalized)) score -= 50;
  }

  for (const pattern of WEAK_REPLY_OPENERS) {
    if (pattern.test(normalized)) {
      score -= matchedAnchors.length > 0 ? 8 : 24;
    }
  }

  if (matchedAnchors.length > 0) {
    score += Math.min(36, matchedAnchors.length * 12);
  } else if (anchors.length > 0) {
    score -= 45;
  }

  for (const pattern of GENERIC_ABSTRACT_REPLY_PATTERNS) {
    if (pattern.test(normalized)) {
      score -= matchedAnchors.length > 0 ? 8 : 28;
    }
  }

  return score;
}

function selectBestReplyCandidate(rawContent: string, fallback: string, anchors: string[]) {
  const jsonLikeCandidates = extractTextFieldsFromJsonLike(rawContent);
  const candidates =
    jsonLikeCandidates.length > 0
      ? jsonLikeCandidates
      : rawContent
          .split(/\n+/)
          .map(normalizeReplyCandidate)
          .filter(Boolean);

  if (candidates.length === 0) {
    return fallback;
  }

  const ranked = [...candidates].sort(
    (a, b) => scoreReplyCandidate(b, anchors) - scoreReplyCandidate(a, anchors)
  );
  const best = ranked[0];
  const bestScore = scoreReplyCandidate(best, anchors);
  if (anchors.length > 0 && countAnchorMatches(best, anchors) === 0) {
    return fallback;
  }
  if (bestScore < 10) {
    return fallback;
  }
  const trimmed = best
    .split(/\s+/)
    .slice(0, 20)
    .join(" ")
    .trim();

  return trimmed || fallback;
}

function buildReplyVariantFallbacks(params: {
  item: Pick<ResearchInboxRecord, "text" | "title" | "authorUsername" | "itemType">;
  selectedNiche?: string | null;
  sourceAnalysis: SnipRadarExtensionSourceAnalysis;
}) {
  const sourceText = cleanSourceText([params.item.title ?? "", params.item.text ?? ""].join(" ")).toLowerCase();
  const base = buildResearchInboxReplyFallback(params.item, params.selectedNiche);
  const anchor =
    params.sourceAnalysis.keyTerms[0] ??
    extractLocalFallbackTerms(sourceText)[0] ??
    params.sourceAnalysis.topics[0] ??
    "launch";
  const readableAnchor = anchor.replace(/_/g, " ");

  const agreeable =
    (/\bfree|preview|beta\b/.test(sourceText) && "Hard to ignore while it's free.") ||
    (/\bdesktop\b/.test(sourceText) && "Desktop support makes rollout easier.") ||
    (/\bdocs?|documentation|guide\b/.test(sourceText) && "Good docs accelerate adoption fast.") ||
    (/\bsecurity|compliance|evaluation\b/.test(sourceText) && "That makes enterprise adoption easier.") ||
    clip(`${capitalize(readableAnchor)} makes this easier to adopt.`, 120);

  const spicy =
    (/\bbot|agi\b/.test(sourceText) && "AGI hype still loses to basic reliability.") ||
    (/\bsecurity|compliance|evaluation\b/.test(sourceText) &&
      "Shipping is easy. Operational trust is harder.") ||
    (/\blaunch|launched|announce|announcing|preview\b/.test(sourceText) &&
      "The announcement is easy. Adoption is harder.") ||
    clip(`${capitalize(readableAnchor)} is the easy part. Operational proof is harder.`, 120);

  const byTone: Record<SnipRadarReplyTone, string> = {
    insightful: base,
    agreeable,
    spicy,
  };

  const seen = new Set<string>();
  return SNIPRADAR_REPLY_TONES.map((tone) => {
    let text = clip(byTone[tone], 120);
    if (seen.has(text.toLowerCase())) {
      text =
        tone === "agreeable"
          ? clip(`${capitalize(readableAnchor)} lowers the adoption bar fast.`, 120)
          : tone === "spicy"
            ? clip(`${capitalize(readableAnchor)} is easy to announce, harder to operationalize.`, 120)
            : text;
    }
    seen.add(text.toLowerCase());
    return {
      tone,
      label: labelReplyTone(tone),
      text,
    };
  });
}

function coerceTone(value: string | null | undefined): SnipRadarReplyTone | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (SNIPRADAR_REPLY_TONES.includes(normalized as SnipRadarReplyTone)) {
    return normalized as SnipRadarReplyTone;
  }
  if (normalized === "contrarian") return "spicy";
  return null;
}

function normalizeReplyVariants(
  variants: Array<{ tone?: string | null; text?: string | null }>,
  fallbacks: SnipRadarExtensionReplyVariant[],
  anchors: string[]
) {
  const selected = new Map<SnipRadarReplyTone, string>();
  const used = new Set<string>();

  for (const candidate of variants) {
    const tone = coerceTone(candidate.tone);
    const text = normalizeReplyCandidate(candidate.text ?? "");
    if (!tone || !text || used.has(text.toLowerCase())) continue;
    const score = scoreReplyCandidate(text, anchors);
    if (anchors.length > 0 && countAnchorMatches(text, anchors) === 0) continue;
    if (score < 8) continue;
    selected.set(tone, clip(text, 120));
    used.add(text.toLowerCase());
  }

  for (const fallback of fallbacks) {
    if (!selected.has(fallback.tone)) {
      selected.set(fallback.tone, fallback.text);
      used.add(fallback.text.toLowerCase());
    }
  }

  return SNIPRADAR_REPLY_TONES.map((tone) => ({
    tone,
    label: labelReplyTone(tone),
    text: selected.get(tone) ?? fallbacks.find((variant) => variant.tone === tone)?.text ?? "",
  }));
}

function extractReplyVariantPayload(content: string) {
  const jsonPayload = extractJsonObject(content);
  if (!jsonPayload) return [];

  try {
    const parsed = JSON.parse(jsonPayload) as {
      variants?: Array<{ tone?: string; text?: string }>;
    };
    return Array.isArray(parsed.variants) ? parsed.variants : [];
  } catch {
    return [];
  }
}

function scoreRemixCandidate(value: string, anchors: string[]) {
  const normalized = normalizeReplyCandidate(value);
  if (!normalized) return -1000;

  let score = 0;
  const words = countWords(normalized);
  const chars = normalized.length;
  const lower = normalized.toLowerCase();
  const matchedAnchors = anchors.filter((anchor) => lower.includes(anchor));

  if (chars <= 280) score += 30;
  else score -= 120;

  if (words >= 12 && words <= 38) score += 20;
  if (matchedAnchors.length > 0) score += Math.min(30, matchedAnchors.length * 10);
  else if (anchors.length > 0) score -= 35;

  if (!/[#]/.test(normalized)) score += 6;
  if (/[\.\?!]$/.test(normalized)) score += 4;

  for (const pattern of BANNED_REPLY_PATTERNS) {
    if (pattern.test(normalized)) score -= 40;
  }

  return score;
}

function selectBestRemixCandidate(rawCandidates: string[], fallback: string, anchors: string[]) {
  const candidates = rawCandidates
    .flatMap((candidate) => {
      const extracted = extractTextFieldsFromJsonLike(candidate);
      return extracted.length > 0 ? extracted : [candidate];
    })
    .map(normalizeReplyCandidate)
    .filter(Boolean);
  if (candidates.length === 0) return fallback;

  const ranked = [...candidates].sort(
    (a, b) => scoreRemixCandidate(b, anchors) - scoreRemixCandidate(a, anchors)
  );
  const best = ranked[0];
  const bestScore = scoreRemixCandidate(best, anchors);

  if (anchors.length > 0 && countAnchorMatches(best, anchors) === 0) {
    return fallback;
  }

  return bestScore >= 0 ? clip(best, 280) : fallback;
}

function buildStyleHint(styleProfile?: StyleProfile | null) {
  if (!styleProfile) return "No stored style profile. Write clear, concise, human-sounding copy.";
  return `Style profile:
- Tone: ${styleProfile.tone}
- Vocabulary: ${styleProfile.vocabulary.slice(0, 10).join(", ") || "none"}
- Avg length: ${styleProfile.avgLength}
- Emoji usage: ${styleProfile.emojiUsage}
- Hashtag style: ${styleProfile.hashtagStyle}
- Sentence pattern: ${styleProfile.sentencePattern}`;
}

function buildReplyReferenceHint(
  referencePosts?: Array<{
    text: string;
    actualImpressions?: number | null;
    actualLikes?: number | null;
    actualReplies?: number | null;
  }>
) {
  if (!referencePosts?.length) {
    return "No top-performing reference posts available.";
  }

  return `High-performing voice references from this user:
${referencePosts
  .slice(0, 5)
  .map((post, index) => {
    const metrics = [
      post.actualImpressions ? `${post.actualImpressions} impr` : null,
      post.actualLikes ? `${post.actualLikes} likes` : null,
      post.actualReplies ? `${post.actualReplies} replies` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return `${index + 1}. ${clip(post.text, 180)}${metrics ? ` (${metrics})` : ""}`;
  })
  .join("\n")}`;
}

export async function generateSnipRadarExtensionReply(params: {
  item: Pick<ResearchInboxRecord, "text" | "title" | "authorUsername" | "itemType">;
  selectedNiche?: string | null;
  styleProfile?: StyleProfile | null;
  sourceAnalysis?: SnipRadarExtensionSourceAnalysis;
  referencePosts?: Array<{
    text: string;
    actualImpressions?: number | null;
    actualLikes?: number | null;
    actualReplies?: number | null;
  }>;
}) {
  const [first] = await generateSnipRadarExtensionReplyVariants(params);
  return first?.text ?? buildResearchInboxReplyFallback(params.item, params.selectedNiche);
}

export async function generateSnipRadarExtensionReplyVariants(params: {
  item: Pick<ResearchInboxRecord, "text" | "title" | "authorUsername" | "itemType">;
  selectedNiche?: string | null;
  styleProfile?: StyleProfile | null;
  sourceAnalysis?: SnipRadarExtensionSourceAnalysis;
  referencePosts?: Array<{
    text: string;
    actualImpressions?: number | null;
    actualLikes?: number | null;
    actualReplies?: number | null;
  }>;
}): Promise<SnipRadarExtensionReplyVariant[]> {
  const target = getExtensionAiTarget("reply");
  const cleanedTitle = cleanSourceText(params.item.title);
  const cleanedText = cleanSourceText(params.item.text);
  const analysis =
    params.sourceAnalysis ??
    (await analyzeSnipRadarExtensionSource({
      item: {
        ...params.item,
        title: cleanedTitle,
        text: cleanedText,
      },
        selectedNiche: params.selectedNiche,
      }));
  const fallbacks = buildReplyVariantFallbacks({
    item: params.item,
    selectedNiche: params.selectedNiche,
    sourceAnalysis: analysis,
  });
  if (!target.client || !target.model) return fallbacks;
  const anchors = uniq(
    [
      ...extractReplyAnchors(cleanedTitle, cleanedText, params.selectedNiche),
      ...analysis.keyTerms,
      ...analysis.topics,
    ],
    12
  );

  const prompt = `You are SnipRadar Reply Assist.

Write 3 reply variants for X to the saved ${params.item.itemType}.

Rules:
- each reply must be one sentence
- each reply must be 20 words max
- target 5-12 words
- short, punchy, natural, human
- sound like a real operator replying fast on X
- react to the specific post, not the entire category
- add a compressed insight, tension, or grounded punchline
- do not flatter
- do not summarize the whole post
- do not restate obvious parts of the source text
- each reply must clearly connect to the specific post, not generic AI/growth commentary
- prefer reacting to the core claim, launch, pricing, metric, or implication in the source
- use at least one concrete term from the source when it helps relevance
- avoid generic openers like "Strong take", "Great point", "Interesting", "Exactly", "I agree"
- avoid consultant phrasing like "I'd push it further"
- avoid vague abstractions that could fit any post
- make the 3 variants meaningfully different in angle
- variant tones:
  - insightful: compact observation or grounded implication
  - agreeable: warmer validation without flattery
  - spicy: sharper but still professional and credible
- no hashtags
- no quotation marks
- no emojis unless absolutely necessary
- no bullets, no numbering, no labels
- avoid vague placeholders like "this", "that", "the angle", "the wedge", "the implications"
- if the source has a specific noun, product, phrase, or real-world reference, use it
- do not invent facts not present in the source
- prefer specificity over cleverness

${buildStyleHint(params.styleProfile)}
${buildReplyReferenceHint(params.referencePosts)}
Structured source analysis:
- summary: ${analysis.summary}
- primary claim: ${analysis.primaryClaim}
- intent: ${analysis.intent}
- stance: ${analysis.stance}
- hook type: ${analysis.hookType}
- topics: ${analysis.topics.join(", ") || "none"}
- key terms: ${analysis.keyTerms.join(", ") || "none"}
- reply angles: ${analysis.replyAngles.join(" | ") || "none"}

Context:
- Saved item title: ${cleanedTitle || "n/a"}
- Author: @${params.item.authorUsername ?? "creator"}
- Selected niche: ${params.selectedNiche ?? "general"}
- Source text: ${cleanedText || "n/a"}

Bad examples:
- This is the real wedge here.
- The second-order effects will be bigger.
- The angle matters more than the announcement.

Good examples:
- Free preview removes the excuse not to test it.
- Vada pav is still the harder benchmark.
- Desktop docs cut onboarding friction fast.
- Claude Code desktop removes one more excuse to stay in the browser.

Return valid JSON only in this exact shape:
{
  "variants": [
    { "tone": "insightful", "text": "string" },
    { "tone": "agreeable", "text": "string" },
    { "tone": "spicy", "text": "string" }
  ]
}`;

  try {
    const response = await Promise.race([
      target.client.chat.completions.create({
        model: target.model,
        messages: [
          {
            role: "system",
            content:
              "You write compact, human X replies. Favor relevance, source anchoring, and natural wording over generic punchiness.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 220,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT: Extension reply assist exceeded deadline.")), EXTENSION_TIMEOUT_MS)
      ),
    ]);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return fallbacks;

    const parsedVariants = extractReplyVariantPayload(content);
    if (parsedVariants.length > 0) {
      return normalizeReplyVariants(parsedVariants, fallbacks, anchors);
    }

    const rawCandidates = extractTextFieldsFromJsonLike(content).concat(content.split(/\n+/).filter(Boolean));
    const normalizedCandidates = uniq(
      rawCandidates.map(normalizeReplyCandidate).filter(Boolean),
      8
    );

    const fallbacklessVariants = SNIPRADAR_REPLY_TONES.map((tone, index) => ({
      tone,
      text: normalizedCandidates[index] ?? "",
    }));

    return normalizeReplyVariants(fallbacklessVariants, fallbacks, anchors);
  } catch (error: any) {
    if (error?.status === 429) {
      console.warn("[SnipRadar Extension] Reply assist rate limited, using fallback.");
      return fallbacks;
    }
    console.error("[SnipRadar Extension] Reply assist failed", error);
    return fallbacks;
  }
}

export async function generateSnipRadarExtensionRemix(params: {
  item: Pick<ResearchInboxRecord, "text" | "title" | "authorUsername" | "itemType">;
  selectedNiche?: string | null;
  styleProfile?: StyleProfile | null;
  sourceAnalysis?: SnipRadarExtensionSourceAnalysis;
}) {
  const fallback = buildResearchInboxRemixFallback(params.item, params.selectedNiche);
  const target = getExtensionAiTarget("remix");
  if (!target.client || !target.model) return fallback;
  const cleanedTitle = cleanSourceText(params.item.title);
  const cleanedText = cleanSourceText(params.item.text);
  const analysis =
    params.sourceAnalysis ??
    (await analyzeSnipRadarExtensionSource({
      item: {
        ...params.item,
        title: cleanedTitle,
        text: cleanedText,
      },
      selectedNiche: params.selectedNiche,
    }));
  const anchors = uniq(
    [
      ...extractReplyAnchors(cleanedTitle, cleanedText, params.selectedNiche),
      ...analysis.keyTerms,
      ...analysis.topics,
    ],
    12
  );

  const prompt = `You are SnipRadar Remix Assist.

Turn the saved ${params.item.itemType} into 3 original standalone X posts.

Rules:
- each remix must be <= 280 characters
- keep the useful structure, not the exact wording
- add a sharper opinion, tension, or clearer payoff
- keep it specific to the source post
- reuse concrete source nouns or phrases when they improve relevance
- do not copy the source verbatim
- do not invent unsupported facts
- avoid vague filler that could fit any AI or growth post
- no hashtags unless critical
- no markdown or labels
- no numbering in the actual post body

${buildStyleHint(params.styleProfile)}
Structured source analysis:
- summary: ${analysis.summary}
- primary claim: ${analysis.primaryClaim}
- intent: ${analysis.intent}
- stance: ${analysis.stance}
- hook type: ${analysis.hookType}
- topics: ${analysis.topics.join(", ") || "none"}
- key terms: ${analysis.keyTerms.join(", ") || "none"}
- reply angles worth preserving: ${analysis.replyAngles.join(" | ") || "none"}

Context:
- Saved item title: ${cleanedTitle || "n/a"}
- Selected niche: ${params.selectedNiche ?? "general"}
- Source text: ${cleanedText || "n/a"}

Return valid JSON only in this exact shape:
{
  "candidates": [
    {
      "text": "string",
      "anchorTerms": ["string"],
      "whyRelevant": "string"
    }
  ]
}`;

  try {
    const response = await Promise.race([
      target.client.chat.completions.create({
        model: target.model,
        messages: [
          {
            role: "system",
            content:
              "You write original X posts with clear hooks and strong relevance to the source material.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 320,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT: Extension remix exceeded deadline.")), EXTENSION_TIMEOUT_MS)
      ),
    ]);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return fallback;

    try {
      const jsonPayload = extractJsonObject(content);
      if (!jsonPayload) {
        throw new Error("Missing JSON payload");
      }
      const parsed = JSON.parse(jsonPayload) as {
        candidates?: Array<{ text?: string; anchorTerms?: string[]; whyRelevant?: string }>;
      };
      const rawCandidates = Array.isArray(parsed.candidates)
        ? parsed.candidates
            .map((candidate) => (typeof candidate?.text === "string" ? candidate.text : ""))
            .filter(Boolean)
        : [];

      return selectBestRemixCandidate(rawCandidates, fallback, anchors);
    } catch {
      const extractedCandidates = extractTextFieldsFromJsonLike(content);
      return selectBestRemixCandidate(
        extractedCandidates.length > 0 ? extractedCandidates : content.split(/\n+/),
        fallback,
        anchors
      );
    }
  } catch (error: any) {
    if (error?.status === 429) {
      console.warn("[SnipRadar Extension] Remix assist rate limited, using fallback.");
      return fallback;
    }
    console.error("[SnipRadar Extension] Remix assist failed", error);
    return fallback;
  }
}
