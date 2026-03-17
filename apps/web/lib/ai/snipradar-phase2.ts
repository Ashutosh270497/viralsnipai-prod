import { getActiveClient } from "@/lib/openrouter-client";

const HOOKS_TARGET = getActiveClient(null, "snipradarHooks");
const THREADS_TARGET = getActiveClient(null, "snipradarThreads");

function stripJsonFences(content: string) {
  return content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}

function extractJsonArray(content: string): any[] | null {
  try {
    const parsed = JSON.parse(stripJsonFences(content));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.items)) return parsed.items;
    if (Array.isArray(parsed.hooks)) return parsed.hooks;
    if (Array.isArray(parsed.tweets)) return parsed.tweets;
    if (Array.isArray(parsed.thread)) return parsed.thread;
    if (Array.isArray(parsed.candidates)) return parsed.candidates;

    const firstArray = Object.values(parsed).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
    return null;
  } catch {
    return null;
  }
}

function extractListFallback(content: string) {
  return stripJsonFences(content)
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);
}

export async function generateHookIdeas(params: {
  niche?: string;
  topic: string;
  examples?: string[];
  count?: number;
}): Promise<string[]> {
  if (!HOOKS_TARGET.client || !HOOKS_TARGET.model) return [];

  const count = Math.min(Math.max(params.count ?? 12, 5), 20);

  const response = await HOOKS_TARGET.client.chat.completions.create({
    model: HOOKS_TARGET.model,
    messages: [
      {
        role: "system",
        content:
          'You generate high-performing X hooks. Return valid JSON only in the shape {"hooks":["string"]}. Every hook must be <= 120 chars.',
      },
      {
        role: "user",
        content: `Niche: ${params.niche ?? "general"}\nTopic: ${params.topic}\nExamples: ${params.examples?.join(" | ") ?? "none"}\nGenerate ${count} hooks in mixed styles (question/stat/contrarian/story/list/challenge).`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "";
  const array = extractJsonArray(content) ?? extractListFallback(content);
  if (!array || array.length === 0) return [];

  return array
    .map((item) => (typeof item === "string" ? item : item.hook ?? item.text ?? ""))
    .map((text) => String(text).trim())
    .filter(Boolean)
    .slice(0, count)
    .map((text) => text.slice(0, 120));
}

export async function generateThreadTweets(params: {
  topic: string;
  niche?: string;
  styleTone?: string | null;
  viralPatterns?: Array<{ text: string; whyItWorked?: string | null }>;
  tweetCount?: number;
}): Promise<string[]> {
  if (!THREADS_TARGET.client || !THREADS_TARGET.model) return [];

  const tweetCount = Math.min(Math.max(params.tweetCount ?? 6, 4), 12);
  const patterns = (params.viralPatterns ?? []).slice(0, 5);

  // Note: response_format: json_object is intentionally omitted — Anthropic models
  // via OpenRouter can return null content when this parameter is present, silently
  // breaking the parse. The prompt enforces JSON output; extractJsonArray handles parsing.
  const response = await THREADS_TARGET.client.chat.completions.create({
    model: THREADS_TARGET.model,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content:
          'You create high-quality X threads. Respond with ONLY a JSON object in the shape {"tweets":["string"]}. No markdown, no explanation. Each tweet must be <= 280 chars and work standalone while forming a coherent sequence.',
      },
      {
        role: "user",
        content: `Topic: ${params.topic}\nNiche: ${params.niche ?? "general"}\nStyle tone: ${params.styleTone ?? "clear and opinionated"}\nPatterns: ${patterns.map((p, i) => `${i + 1}) ${p.text.slice(0, 120)} — ${p.whyItWorked ?? ""}`).join("\n") || "none"}\nGenerate a ${tweetCount}-tweet thread with: hook tweet, insight tweets, actionable close. Return JSON only.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  if (!content.trim()) return [];

  const array = extractJsonArray(content) ?? extractListFallback(content);
  if (!array || array.length === 0) return [];

  return array
    .map((item) =>
      typeof item === "string"
        ? item
        : item.tweet ?? item.text ?? item.content ?? item.body ?? ""
    )
    .map((text) => String(text).trim())
    .filter(Boolean)
    .slice(0, tweetCount)
    .map((text) => text.slice(0, 280));
}
