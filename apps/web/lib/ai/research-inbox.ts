import OpenAI from "openai";
import { openRouterClient, OPENROUTER_MODELS } from "@/lib/openrouter-client";

type InboxEnrichmentInput = {
  itemType: string;
  title: string | null;
  text: string | null;
  authorUsername: string | null;
  selectedNiche?: string | null;
};

export type InboxEnrichment = {
  source: "ai" | "heuristic_fallback";
  title: string | null;
  summary: string | null;
  labels: string[];
  suggestedAction: "reply" | "remix" | "track" | "research";
};

const DIRECT_MODEL =
  process.env.OPENAI_SNIPRADAR_INBOX_MODEL?.trim() ??
  process.env.OPENAI_MODEL?.trim() ??
  "gpt-5-mini";
const INBOX_TIMEOUT_MS = Number(process.env.OPENAI_SNIPRADAR_INBOX_TIMEOUT_MS ?? 10_000);

const directClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** OpenRouter takes priority; direct OpenAI is the fallback. */
const client = openRouterClient ?? directClient;
const INBOX_MODEL = openRouterClient
  ? OPENROUTER_MODELS.snipradarInboxEnrichment
  : DIRECT_MODEL;

function clip(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function uniq(values: string[], maxItems: number) {
  return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))).slice(0, maxItems);
}

export function buildFallbackInboxEnrichment(input: InboxEnrichmentInput): InboxEnrichment {
  const text = (input.text ?? "").trim();
  const labels = uniq(
    [
      input.itemType,
      input.authorUsername ? `@${input.authorUsername}` : "",
      input.selectedNiche ?? "",
      text.includes("?") ? "question" : "",
      /\bthread\b/i.test(text) ? "thread" : "",
      /\blaunch|waitlist|cta\b/i.test(text) ? "conversion" : "",
      /\bhot take|contrarian|unpopular\b/i.test(text) ? "contrarian" : "",
    ],
    4
  );

  const summary = text
    ? clip(
        `Saved ${input.itemType} from ${input.authorUsername ? `@${input.authorUsername}` : "X"} for later reuse. The main value is the angle and structure, not the exact wording.`,
        220
      )
    : null;

  return {
    source: "heuristic_fallback",
    title: input.title ? clip(input.title, 120) : input.authorUsername ? `Capture from @${input.authorUsername}` : null,
    summary,
    labels,
    suggestedAction: input.itemType === "profile" ? "track" : text.length < 120 ? "reply" : "remix",
  };
}

export async function generateInboxEnrichment(input: InboxEnrichmentInput): Promise<InboxEnrichment> {
  const fallback = buildFallbackInboxEnrichment(input);
  if (!client) return fallback;

  const system = `You are SnipRadar Inbox Enrichment.

Turn a saved X capture into structured metadata for later action.

Rules:
- use only the provided capture
- keep title <= 120 chars
- keep summary <= 220 chars
- labels must be short lowercase tags
- choose suggestedAction from: reply, remix, track, research
- return valid JSON only

Return exactly:
{
  "title": "string or null",
  "summary": "string or null",
  "labels": ["string", "string", "string"],
  "suggestedAction": "reply" | "remix" | "track" | "research"
}`;

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        model: INBOX_MODEL,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({
              itemType: input.itemType,
              title: input.title,
              text: input.text,
              authorUsername: input.authorUsername,
              selectedNiche: input.selectedNiche ?? "general",
            }),
          },
        ],
        response_format: { type: "json_object" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT: Inbox enrichment exceeded deadline.")), INBOX_TIMEOUT_MS)
      ),
    ]);

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;
    const parsed = JSON.parse(content) as Record<string, unknown>;

    const suggestedAction =
      parsed.suggestedAction === "reply" ||
      parsed.suggestedAction === "remix" ||
      parsed.suggestedAction === "track" ||
      parsed.suggestedAction === "research"
        ? parsed.suggestedAction
        : fallback.suggestedAction;

    return {
      source: "ai",
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? clip(parsed.title, 120)
          : fallback.title,
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? clip(parsed.summary, 220)
          : fallback.summary,
      labels: uniq(
        Array.isArray(parsed.labels)
          ? parsed.labels.filter((item): item is string => typeof item === "string")
          : fallback.labels,
        5
      ),
      suggestedAction,
    };
  } catch (error: any) {
    if (error?.status === 429) {
      console.warn("[SnipRadar Inbox] Rate limited during enrichment, using fallback.");
      return fallback;
    }
    if (error instanceof Error && error.message.startsWith("TIMEOUT:")) {
      console.warn("[SnipRadar Inbox] Enrichment timed out, using fallback.");
      return fallback;
    }
    console.error("[SnipRadar Inbox] Enrichment failed", error);
    return fallback;
  }
}
