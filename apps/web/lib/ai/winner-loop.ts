import crypto from "crypto";
import OpenAI from "openai";
import { openRouterClient, OPENROUTER_MODELS } from "@/lib/openrouter-client";

import type { WinnerAutomationAction, WinnerCandidate } from "@/lib/snipradar/winner-loop";

const DIRECT_MODEL =
  process.env.OPENAI_SNIPRADAR_WINNER_LOOP_MODEL?.trim() ??
  process.env.OPENAI_MODEL?.trim() ??
  "gpt-5-mini";

const directClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** OpenRouter takes priority; direct OpenAI is the fallback. */
const client = openRouterClient ?? directClient;
const WINNER_LOOP_MODEL = openRouterClient
  ? OPENROUTER_MODELS.snipradarWinnerLoop
  : DIRECT_MODEL;

export type WinnerAutomationDraft = {
  text: string;
  reasoning: string;
};

function trimTweet(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 280);
}

function splitFallbackThread(text: string) {
  const cleaned = trimTweet(text);
  const core = cleaned.replace(/[.!?]+$/, "");
  return [
    {
      text: trimTweet(`${core}\n\nHere is the context most people miss:`),
      reasoning: "Lead with the winning idea and open a thread continuation.",
    },
    {
      text: trimTweet(`What made this work:\n1. Clear tension\n2. Specific payoff\n3. Easy takeaway\n\nThat combination compounds on X.`),
      reasoning: "Translate the winning post into practical takeaways.",
    },
    {
      text: trimTweet(`If this angle resonated, the next move is simple: turn the insight into a repeatable system and keep posting proof.`),
      reasoning: "Close with the practical next step and authority signal.",
    },
  ];
}

function buildFallbackDrafts(action: WinnerAutomationAction, winner: WinnerCandidate): WinnerAutomationDraft[] {
  if (action === "expand_thread") {
    return splitFallbackThread(winner.text);
  }

  if (action === "repost_variant") {
    return [
      {
        text: trimTweet(`Most people keep missing this: ${winner.text}`),
        reasoning: "Reframe the winning post with a fresh lead and cooldown-safe wording.",
      },
    ];
  }

  return [
    {
      text: trimTweet(`A second-order lesson from this post: ${winner.text}`),
      reasoning: "Spin the winner into a follow-up angle rather than repeating the same hook.",
    },
  ];
}

export async function generateWinnerAutomationDrafts(params: {
  action: WinnerAutomationAction;
  winner: WinnerCandidate;
}) {
  if (!client) {
    return buildFallbackDrafts(params.action, params.winner);
  }

  const system = `You turn a winning X post into follow-up assets.

Rules:
- every draft must be <= 280 characters
- stay original, do not repeat the winning post verbatim
- preserve the core insight and performance pattern
- return valid JSON only

Action types:
- expand_thread: return exactly 3 thread tweets
- repost_variant: return exactly 1 rewritten repost-safe variant
- spin_off_post: return exactly 1 follow-up single post

Return:
{
  "drafts": [
    { "text": "string", "reasoning": "string" }
  ]
}`;

  try {
    const completion = await client.chat.completions.create({
      model: WINNER_LOOP_MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            action: params.action,
            winner: {
              text: params.winner.text,
              hookType: params.winner.hookType,
              format: params.winner.format,
              emotionalTrigger: params.winner.emotionalTrigger,
              actualImpressions: params.winner.actualImpressions,
              actualReplies: params.winner.actualReplies,
              actualRetweets: params.winner.actualRetweets,
              whyWon: params.winner.whyWon,
            },
          }),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return buildFallbackDrafts(params.action, params.winner);

    const parsed = JSON.parse(content) as { drafts?: WinnerAutomationDraft[] };
    const drafts = Array.isArray(parsed.drafts) ? parsed.drafts : [];
    const cleaned = drafts
      .map((draft) => ({
        text: trimTweet(draft.text ?? ""),
        reasoning: typeof draft.reasoning === "string" ? draft.reasoning.trim().slice(0, 220) : "Follow-up asset from a winning post.",
      }))
      .filter((draft) => draft.text.length >= 10);

    if (cleaned.length === 0) {
      return buildFallbackDrafts(params.action, params.winner);
    }

    return params.action === "expand_thread" ? cleaned.slice(0, 3) : cleaned.slice(0, 1);
  } catch (error) {
    console.error("[SnipRadar Winner Loop] AI generation failed", error);
    return buildFallbackDrafts(params.action, params.winner);
  }
}

export function buildThreadGroupId() {
  return `winner-${crypto.randomUUID()}`;
}
