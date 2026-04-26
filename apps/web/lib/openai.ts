import OpenAI from "openai";

import { logger } from "@/lib/logger";
import { generateHooksViaOpenRouter, generateScriptViaOpenRouter } from "./openai-with-router";
import {
  extractOpenRouterContent,
  openRouterClient,
  OPENROUTER_MODELS,
  HAS_OPENROUTER_KEY,
  routedChatCompletion,
  buildEmptyOpenRouterContentError,
  getOpenRouterCandidateModels,
} from "./openrouter-client";

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
const client = hasApiKey
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60_000, // 60 second timeout — prevents hanging requests
      maxRetries: 1,   // Let our own retry logic handle retries
    })
  : null;

type HookPayload = {
  topic: string;
  sourceUrl?: string;
  audience?: string;
  tone?: string;
};

type ScriptPayload = {
  hook: string;
  audience?: string;
  tone?: string;
  durationSec?: number;
};

export interface HighlightPayload {
  transcript: string;
  durationSec: number;
  target?: number;
  audience?: string;
  tone?: string;
  model?: string;
  brief?: string;
  callToAction?: string;
}

export type HighlightSuggestion = {
  title: string;
  hook: string;
  startPercent: number;
  endPercent: number;
  callToAction?: string;
};

type HighlightParseResult = {
  highlights: HighlightSuggestion[];
  repaired: boolean;
};

const HIGHLIGHT_MAX_TOKENS = Number.parseInt(process.env.OPENROUTER_HIGHLIGHTS_MAX_TOKENS ?? "8192", 10);

const VIRAL_CLIP_EXAMPLES = [
  {
    title: "The $0 budget growth trap",
    hook: "Stop grinding on features nobody asked for—this $12 landing page tactic is what actually converts.",
    viralMechanic: "Pattern interrupt + contrarian take + curiosity gap with specific number",
    midpoint: "Show the before/after revenue graph, call out the emotional rollercoaster, and why scrappy beats polished.",
    payoff: "Close on the exact CTA lines that invite the viewer to steal the template while urgency is high."
  },
  {
    title: "AI assistant skepticism flip",
    hook: "You're probably ignoring the boring AI emails—here's the one workflow that made our editor 4x faster.",
    viralMechanic: "Call out common behavior + transformation promise with specific metric",
    midpoint: "Reveal the unexpected bottleneck, share the aha moment, and include the specific prompt wording.",
    payoff: "End with a hard CTA to reuse the prompt today plus a cliffhanger about the next unlock."
  },
  {
    title: "Creator pricing shock",
    hook: "Creators undercharge because they sell time, not outcomes. Watch this onboarding tweak double LTV overnight.",
    viralMechanic: "Universal pain point + mindset shift + dramatic result",
    midpoint: "Break down the objection, describe the narrative tension, and keep the beat tight with data checkpoints.",
    payoff: "Finish with a confident CTA pushing viewers to claim the pricing script while scarcity feels real."
  },
  {
    title: "Fitness transformation mistake",
    hook: "You're doing cardio wrong. This 90-second routine burns more fat than an hour on the treadmill.",
    viralMechanic: "Challenge conventional wisdom + shocking comparison + time efficiency",
    midpoint: "Demonstrate the technique, explain the science, show before/after results from real people.",
    payoff: "Action step to try today, promise of full program in bio, urgency around limited spots."
  },
  {
    title: "Parenting hack revelation",
    hook: "I stopped arguing with my 4-year-old and started doing this instead. Tantrums dropped by 80%.",
    viralMechanic: "Personal story + relatable struggle + dramatic improvement with metric",
    midpoint: "Reveal the counterintuitive technique, share the psychology behind it, give specific examples.",
    payoff: "Simple action parents can take tonight, invite to share their results in comments."
  },
  {
    title: "Investing mistake exposed",
    hook: "Financial advisors hate this. I turned $1,000 into $50k in 2 years without touching stocks.",
    viralMechanic: "Authority figure opposition + impressive transformation + curiosity about method",
    midpoint: "Break down the strategy step-by-step, show the compound effect, address common objections.",
    payoff: "Free resource link in bio, challenge viewers to start with just $100, create urgency."
  },
  {
    title: "Cooking secret revealed",
    hook: "Michelin chefs don't want you to know this. One ingredient transforms any dish instantly.",
    viralMechanic: "Insider secret + universal application + instant gratification promise",
    midpoint: "Reveal the ingredient, show 3 quick examples, explain the science of why it works.",
    payoff: "Challenge viewers to try it tonight and tag you, tease next week's secret ingredient."
  },
  {
    title: "Productivity mindset shift",
    hook: "I quit my 9-5 routine and now I work 4 hours a day making twice the income. Here's the mindset shift.",
    viralMechanic: "Lifestyle transformation + better results with less effort + provocative claim",
    midpoint: "Explain the old trap vs new approach, share the mental models, give real examples from their day.",
    payoff: "One action to take tomorrow morning, free guide in bio, invite to DM success stories."
  },
  {
    title: "Relationship communication breakthrough",
    hook: "My marriage was ending. Then my therapist taught me this 30-second technique. Everything changed.",
    viralMechanic: "High stakes + emotional vulnerability + simple solution + transformation",
    midpoint: "Teach the exact technique, share how it feels in practice, show the immediate impact.",
    payoff: "Challenge couples to try tonight, promise of deeper content in comments, create emotional connection."
  },
  {
    title: "Pet training revelation",
    hook: "Your dog isn't stubborn. You're using the wrong rewards. Watch what happens when I switch to this.",
    viralMechanic: "Reframe the problem + visual demonstration + instant gratification",
    midpoint: "Show the dramatic before/after, explain the psychology, give 3 examples of better rewards.",
    payoff: "Simple homework for tonight, invite to share their dog's progress, tease advanced techniques."
  }
] as const;

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): string {
  const stripped = stripCodeFence(text);
  if (stripped.startsWith("{")) {
    return stripped;
  }

  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  return first >= 0 && last > first ? stripped.slice(first, last + 1) : "";
}

function normalizeHighlight(highlight: any): HighlightSuggestion | null {
  const startPercent = Number.parseFloat(String(highlight?.start_percent ?? highlight?.startPercent ?? ""));
  const endPercent = Number.parseFloat(String(highlight?.end_percent ?? highlight?.endPercent ?? ""));

  if (!Number.isFinite(startPercent) || !Number.isFinite(endPercent) || endPercent <= startPercent) {
    return null;
  }

  return {
    title: String(highlight?.title ?? highlight?.headline ?? "Highlight").trim() || "Highlight",
    hook: String(highlight?.hook ?? highlight?.opening ?? highlight?.title ?? "").trim(),
    startPercent,
    endPercent,
    callToAction: highlight?.cta ?? highlight?.call_to_action ?? highlight?.callToAction ?? highlight?.outro ?? undefined,
  };
}

function extractCompleteHighlightObjects(text: string): any[] {
  const highlightsIndex = text.indexOf('"highlights"');
  const arrayStart = highlightsIndex >= 0 ? text.indexOf("[", highlightsIndex) : -1;
  if (arrayStart < 0) {
    return [];
  }

  const objects: any[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart + 1; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          objects.push(JSON.parse(text.slice(start, index + 1)));
        } catch {
          // Ignore the malformed object and keep scanning for later complete ones.
        }
        start = -1;
      }
    }
  }

  return objects;
}

export function parseOpenRouterHighlightsContent(raw: string): HighlightParseResult {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    throw new Error("OpenRouter highlight response did not contain a JSON object.");
  }

  try {
    const parsed = JSON.parse(jsonText) as { highlights?: Array<any> };
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.map(normalizeHighlight).filter((item): item is HighlightSuggestion => Boolean(item))
      : [];

    if (highlights.length === 0) {
      throw new Error("OpenRouter highlight JSON did not contain usable highlights.");
    }

    return { highlights, repaired: false };
  } catch (error) {
    const repairedHighlights = extractCompleteHighlightObjects(jsonText)
      .map(normalizeHighlight)
      .filter((item): item is HighlightSuggestion => Boolean(item));

    if (repairedHighlights.length > 0) {
      return { highlights: repairedHighlights, repaired: true };
    }

    throw error instanceof Error ? error : new Error("OpenRouter returned invalid highlight JSON.");
  }
}

export async function generateHooks(payload: HookPayload) {
  return generateHooksViaOpenRouter(payload);
}

export async function generateScript(payload: ScriptPayload) {
  return generateScriptViaOpenRouter(payload);
}

export { client as openAIClient };

export async function generateHighlights(payload: HighlightPayload) {
  const requestedModel = payload.model?.trim();
  const wantsOpenRouterModel = requestedModel ? requestedModel.includes("/") : false;

  const determineClipLimit = (seconds: number): number => {
    if (seconds <= 0) {
      return 3;
    }
    if (seconds < 10 * 60) {
      return 3;
    }
    if (seconds <= 30 * 60) {
      return 6;
    }
    return 10;
  };

  const clipLimit = determineClipLimit(payload.durationSec);
  const minClipCount = Math.min(clipLimit, 3);
  const maxClipCount = clipLimit;
  const minClipSeconds = 30;
  const maxClipSeconds = 45;

  if (requestedModel && !wantsOpenRouterModel) {
    throw new Error(`Highlight model "${requestedModel}" is not an OpenRouter model ID.`);
  }

  if (process.env.OPENROUTER_ENABLED !== "true" || !HAS_OPENROUTER_KEY || !openRouterClient) {
    throw new Error("OpenRouter is not configured. Set OPENROUTER_API_KEY and OPENROUTER_ENABLED=true.");
  }

  // Use smarter transcript truncation for longer videos
  const maxTranscriptLength = 50000; // Increased from 16000 to 50000
  const truncatedTranscript = payload.transcript.length > maxTranscriptLength
    ? smartTruncateTranscript(payload.transcript, maxTranscriptLength)
    : payload.transcript;

  const userPayload = {
    transcript: truncatedTranscript,
    duration_seconds: payload.durationSec,
    target_clips: Math.min(maxClipCount, Math.max(minClipCount, payload.target ?? clipLimit)),
    min_duration_seconds: minClipSeconds,
    max_duration_seconds: maxClipSeconds,
    must_return_between: [minClipCount, maxClipCount],
    audience: payload.audience ?? "Ambitious creators",
    tone: payload.tone ?? "Tension, insight, payoff",
    call_to_action: payload.callToAction ?? "Drive viewers to subscribe or click through",
    campaign_brief:
      payload.brief?.slice(0, 600) ??
      "Prioritise hooks that feel contrarian yet actionable. Highlight scrappy wins, emotional stakes, and clear takeaways.",
    examples: VIRAL_CLIP_EXAMPLES
  };

  // Shared system prompt for OpenRouter highlight detection.
  const highlightsSystemContent = [
    "You are an elite social video editor and viral content strategist with deep expertise in TikTok, Instagram Reels, and YouTube Shorts algorithms.",
    "Your mission: identify clips with MAXIMUM viral potential based on proven patterns that consistently generate millions of views.",
    "",
    "**VIRAL MECHANICS TO PRIORITIZE:**",
    "1. PATTERN INTERRUPT: Challenge assumptions, 'You're doing X wrong', 'Stop doing X'",
    "2. CURIOSITY GAP: Tease specific results without revealing how ('$1000 to $50k', 'doubled my...')",
    "3. TRANSFORMATION STORIES: Before/after with emotional stakes and metrics (%, time, money)",
    "4. CONTRARIAN TAKES: Against conventional wisdom or expert advice",
    "5. PERSONAL VULNERABILITY: High-stakes stories ('My marriage was ending', 'I was broke')",
    "6. INSTANT GRATIFICATION: Quick results ('30-second technique', '90-second routine')",
    "7. AUTHORITY CHALLENGE: 'Doctors hate this', 'Experts don't want you to know'",
    "8. RELATABILITY + SOLUTION: Universal struggles with unexpected solutions",
    "",
    "**FIRST 3 SECONDS REQUIREMENTS:**",
    "- Bold statement, provocative question, or shocking claim",
    "- Specific numbers/metrics when possible",
    "- Pattern interrupt that stops scrolling",
    "- NO slow intros, greetings, or context",
    "",
    "**MIDDLE SECTION NEEDS:**",
    "- Rising tension or escalating insights",
    "- Specific, actionable information (not vague)",
    "- Emotional peaks: surprise, excitement, inspiration, controversy",
    "- Fast pacing, no dead air",
    "",
    "**ENDING MUST DELIVER:**",
    "- Clear payoff resolving the hook's promise",
    "- Strong CTA (try tonight, DM me, link in bio)",
    "- Urgency/scarcity when appropriate",
    "- Optional: cliffhanger for next video",
    "",
    "**OUTPUT:** Valid JSON only: {\"highlights\":[{...}]}",
    "Each object needs only: title, hook, start_percent, end_percent, call_to_action",
    "Keep title <= 8 words, hook <= 24 words, call_to_action <= 14 words.",
    "Numeric percentages (0-100), chronological, start < end",
    "Target 30-45 seconds per clip. Return exactly target_clips items.",
    "Sentence boundaries only. No overlaps.",
    "Do not include markdown, comments, trailing prose, or extra keys.",
    "Close every JSON object and array.",
    "",
    "**SELECTION CRITERIA:**",
    "- Would this stop mid-scroll in 3 seconds?",
    "- Delivers specific, valuable insight/transformation?",
    "- Emotional resonance or controversy?",
    "- Would viewers share or tag friends?",
    "",
    "Return best options even if transcript lacks strong viral moments, prioritizing specificity, contrarian angles, and emotional stakes."
  ].join(" ");

  const openRouterHighlightsModel: string = wantsOpenRouterModel && requestedModel
    ? requestedModel
    : OPENROUTER_MODELS.highlights;

  const highlightModels = getOpenRouterCandidateModels("highlights", openRouterHighlightsModel);
  const failures: Array<{ model: string; message: string; recovered?: number }> = [];

  for (const model of highlightModels) {
    logger.debug("[Highlights] Using OpenRouter model", { model });

    try {
      const orResp = await openRouterClient.chat.completions.create({
        model,
        messages: [
          { role: "system", content: highlightsSystemContent },
          { role: "user", content: JSON.stringify(userPayload) }
        ],
        max_tokens: Number.isFinite(HIGHLIGHT_MAX_TOKENS) ? HIGHLIGHT_MAX_TOKENS : 8192,
        temperature: 0.1,
        provider: { allow_fallbacks: true },
      } as any);
      const orRaw = extractOpenRouterContent(orResp);

      if (!orRaw) {
        throw buildEmptyOpenRouterContentError(model, orResp);
      }

      const parsed = parseOpenRouterHighlightsContent(orRaw);
      const usableHighlights = parsed.highlights
        .filter((item) => item.startPercent >= 0 && item.endPercent <= 100)
        .slice(0, maxClipCount);

      if (usableHighlights.length < minClipCount) {
        failures.push({
          model,
          message: `Only ${usableHighlights.length} usable highlights returned; expected at least ${minClipCount}.`,
          recovered: usableHighlights.length,
        });
        logger.warn("[Highlights] OpenRouter model returned too few usable highlights", {
          model,
          count: usableHighlights.length,
          repaired: parsed.repaired,
        });
        continue;
      }

      if (parsed.repaired) {
        logger.warn("[Highlights] Recovered complete highlights from truncated JSON", {
          model,
          count: usableHighlights.length,
        });
      }

      return usableHighlights;
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenRouter highlight generation failed";
      failures.push({ model, message });
      logger.warn("[Highlights] OpenRouter model failed", { model, message });
      continue;
    }
  }

  throw new Error(
    `OpenRouter failed to generate valid highlights. Tried models: ${failures
      .map((failure) => `${failure.model}: ${failure.message}`)
      .join(" | ")}`
  );
}

export type ImagenPromptPayload = {
  context: string;
  existingPrompt?: string;
  aspectRatio?: string;
  styleHint?: string;
  negativePrompt?: string;
};

export async function generateImagenPrompt(
  payload: ImagenPromptPayload
): Promise<{ prompt: string; negativePrompt?: string }> {
  const baseContext = payload.context?.trim() ?? "";

  const requestBody = {
    context: baseContext,
    existing_prompt: payload.existingPrompt?.trim() || null,
    aspect_ratio: payload.aspectRatio ?? null,
    style_hint: payload.styleHint?.trim() || null,
    negative_prompt: payload.negativePrompt?.trim() || null
  };

  const systemContent =
    "You are an imaginative creative director who crafts concise, compelling prompts for Google Imagen or similar diffusion models. Respond with strictly valid JSON shaped as {\"prompt\":\"...\",\"negative_prompt\":\"...\"}. The prompt should be 1-3 sentences, prioritize subject + setting + mood + stylistic guidance, and avoid camera jargon unless requested. Suggest an optional negative_prompt if obvious artifacts should be avoided.";

  let text = await routedChatCompletion(
    client,
    'imagenPrompt',
    '',
    [
      { role: "system", content: systemContent },
      { role: "user", content: JSON.stringify(requestBody) }
    ],
    { maxTokens: 512, temperature: 0.7 }
  );

  if (!text.trim().startsWith("{")) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      text = match[0];
    }
  }

  try {
    const parsed = JSON.parse(text) as { prompt?: string; negative_prompt?: string };
    const finalPrompt = parsed.prompt?.trim();
    if (!finalPrompt) {
      throw new Error("Missing prompt");
    }
    const negative = parsed.negative_prompt?.trim();
    return negative ? { prompt: finalPrompt, negativePrompt: negative } : { prompt: finalPrompt };
  } catch (error) {
    logger.error("[Imagen] Failed to parse OpenRouter prompt JSON", { error, text });
    throw new Error("OpenRouter returned invalid Imagen prompt JSON.");
  }
}

/**
 * Smart transcript truncation that preserves complete sentences
 * and prioritizes content diversity across the video
 */
function smartTruncateTranscript(transcript: string, maxLength: number): string {
  if (transcript.length <= maxLength) {
    return transcript;
  }

  // Strategy: Sample from beginning, middle, and end to get diverse content
  const segmentSize = Math.floor(maxLength / 3);
  const totalLength = transcript.length;

  // Extract beginning (first segment)
  const beginning = transcript.slice(0, segmentSize);
  const beginningEnd = beginning.lastIndexOf('. ') > 0
    ? beginning.lastIndexOf('. ') + 1
    : beginning.lastIndexOf(' ');
  const beginningSegment = transcript.slice(0, beginningEnd > 0 ? beginningEnd : segmentSize);

  // Extract middle (around 50% mark)
  const middleStart = Math.floor(totalLength * 0.4);
  const middleChunk = transcript.slice(middleStart, middleStart + segmentSize);
  const middleChunkStart = middleChunk.indexOf('. ') > 0
    ? middleChunk.indexOf('. ') + 1
    : middleChunk.indexOf(' ');
  const middleChunkEnd = middleChunk.lastIndexOf('. ') > 0
    ? middleChunk.lastIndexOf('. ') + 1
    : middleChunk.lastIndexOf(' ');
  const middleSegment = middleChunk.slice(
    middleChunkStart > 0 ? middleChunkStart : 0,
    middleChunkEnd > 0 ? middleChunkEnd : segmentSize
  );

  // Extract end (last segment)
  const endStart = totalLength - segmentSize;
  const endChunk = transcript.slice(endStart);
  const endChunkStart = endChunk.indexOf('. ') > 0
    ? endChunk.indexOf('. ') + 1
    : endChunk.indexOf(' ');
  const endSegment = endChunk.slice(endChunkStart > 0 ? endChunkStart : 0);

  // Combine with markers
  return [
    beginningSegment.trim(),
    '\n[... middle section ...]\n',
    middleSegment.trim(),
    '\n[... later section ...]\n',
    endSegment.trim()
  ].join(' ');
}
