import OpenAI from "openai";

import { generateGeminiHighlights, HAS_GEMINI_KEY } from "@/lib/google-gemini";
import { logger } from "@/lib/logger";
import { generateHooksViaOpenRouter, generateScriptViaOpenRouter } from "./openai-with-router";
import { openRouterClient, OPENROUTER_MODELS, HAS_OPENROUTER_KEY, routedChatCompletion } from "./openrouter-client";

const OPENAI_HOOKS_MODEL =
  process.env.OPENAI_HOOKS_MODEL?.trim() ??
  process.env.OPENAI_MODEL?.trim() ??
  "gpt-5-mini";
const OPENAI_SCRIPT_MODEL =
  process.env.OPENAI_SCRIPT_MODEL?.trim() ??
  process.env.OPENAI_MODEL?.trim() ??
  "gpt-4.1-mini";
const OPENAI_HIGHLIGHTS_MODEL =
  process.env.OPENAI_HIGHLIGHTS_MODEL?.trim() ??
  process.env.OPENAI_MODEL?.trim() ??
  "gpt-5-mini";
const OPENAI_IMAGEN_PROMPT_MODEL =
  process.env.OPENAI_IMAGEN_PROMPT_MODEL?.trim() ??
  process.env.OPENAI_SCRIPT_MODEL?.trim() ??
  process.env.OPENAI_MODEL?.trim() ??
  "gpt-4.1-mini";

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
const client = hasApiKey
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60_000, // 60 second timeout — prevents hanging requests
      maxRetries: 1,   // Let our own retry logic handle retries
    })
  : null;

function mockHooks(topic: string) {
  const seed = topic || "your brand";
  return Array.from({ length: 8 }).map(
    (_, index) => `Hook ${index + 1}: ${seed} — grab attention in 5 words`
  );
}

function mockScript(hook: string) {
  return `Hook: ${hook}\n\nValue:\n1. Lead with the tension introduced.\n2. Deliver a practical example.\n3. Give a take-away the viewer can apply today.\n\nCTA: Subscribe for the full teardown.`;
}

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

export async function generateHooks(payload: HookPayload) {
  // Try OpenRouter first if OPENROUTER_ENABLED=true and OPENROUTER_API_KEY is set.
  // Returns null on failure so we fall through to OpenAI automatically.
  const orHooks = await generateHooksViaOpenRouter(payload);
  if (orHooks) return orHooks;

  if (!client) {
    return mockHooks(payload.topic);
  }

  logger.debug("[Hooksmith] Using OpenAI model", { model: OPENAI_HOOKS_MODEL });
  const response = await client.responses.create({
    model: OPENAI_HOOKS_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are Hooksmith, a sharp social strategist. Reply only with compact JSON in the exact shape {\"hooks\":[\"hook 1\", ...]}. Each hook must be 8-14 words, lead with tension, avoid clichés, and feel distinct. No additional prose, explanations, or markdown."
      },
      {
        role: "user",
        content: JSON.stringify({
          topic: payload.topic,
          sourceUrl: payload.sourceUrl,
          audience: payload.audience ?? "creators",
          tone: payload.tone ?? "energetic"
        })
      }
    ]
  });

  let text =
    response.output_text ??
    response.output
      ?.flatMap((chunk: any) =>
        chunk.content?.map((item: any) => item.text?.value ?? "").filter(Boolean)
      )
      ?.join("")
      ?.trim() ??
    "{}";

  // If the model wrapped JSON inside prose, extract the first JSON block.
  if (text !== "{}" && !text.trim().startsWith("{")) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      text = match[0];
    }
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.hooks) && parsed.hooks.length > 0) {
      return parsed.hooks.slice(0, 10);
    }
  } catch (error) {
    console.error("Failed to parse hooks", error, text);
  }

  return mockHooks(payload.topic);
}

export async function generateScript(payload: ScriptPayload) {
  // Try OpenRouter first if OPENROUTER_ENABLED=true and OPENROUTER_API_KEY is set.
  // Returns null on failure so we fall through to OpenAI automatically.
  const orScript = await generateScriptViaOpenRouter(payload);
  if (orScript) return orScript;

  if (!client) {
    return mockScript(payload.hook);
  }

  logger.debug("[Hooksmith] Using OpenAI script model", { model: OPENAI_SCRIPT_MODEL });
  const response = await client.responses.create({
    model: OPENAI_SCRIPT_MODEL,
    input: `Write a ${payload.durationSec ?? 120}-second YouTube Short script in 3 beats (Hook–Value–CTA). Sentences short, spoken tone, timestamp markers optional. End with a crisp CTA. Hook: ${
      payload.hook
    }. Audience: ${payload.audience ?? "creators"}. Tone: ${payload.tone ?? "energetic"}.`
  });

  const text = response.output_text ?? mockScript(payload.hook);
  return text;
}

export { client as openAIClient };

export async function generateHighlights(payload: HighlightPayload) {
  const requestedModel = payload.model?.trim();
  const requestedLower = requestedModel?.toLowerCase();
  const wantsDirectGemini = requestedLower ? requestedLower.startsWith("gemini") : false;
  const wantsOpenRouterModel = requestedModel ? requestedModel.includes("/") : false;
  const wantsOpenAI = requestedLower
    ? !wantsOpenRouterModel && requestedLower.startsWith("gpt")
    : false;

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

  if (HAS_GEMINI_KEY && (!wantsOpenAI && !wantsOpenRouterModel && (wantsDirectGemini || !requestedModel))) {
    const geminiModel = requestedModel ?? process.env.GOOGLE_GEMINI_MODEL ?? "gemini-1.5-flash";
    try {
      logger.debug("[Highlights] Using Gemini model", { model: geminiModel });
      const result = await generateGeminiHighlights({
        ...payload,
        model: geminiModel,
        target: Math.min(maxClipCount, Math.max(minClipCount, payload.target ?? clipLimit))
      });
      if (result && result.length > 0) {
        return result;
      }
      logger.debug("[Highlights] Gemini returned no highlights, falling back to OpenAI.");
    } catch (error) {
      console.error("Gemini highlight generation failed", error);
    }
  } else if (wantsDirectGemini && !HAS_GEMINI_KEY) {
    console.warn("[Highlights] Gemini model requested but no API key configured; using OpenAI instead.");
  }

  if (!client) {
    const duration = Math.max(1, payload.durationSec);
    const requestedCount = payload.target ?? clipLimit;
    const count = Math.min(maxClipCount, Math.max(minClipCount, requestedCount));
    const clipDurationSec = Math.min(
      duration,
      Math.min(maxClipSeconds, Math.max(minClipSeconds, Math.floor(duration / count) || minClipSeconds))
    );
    const clipPercent = (clipDurationSec / duration) * 100;

    return Array.from({ length: count }).map((_, index) => {
      const startPercent = Math.min(100, Math.max(0, (index / count) * 100));
      const endPercent = Math.min(100, startPercent + clipPercent);
      return {
        title: `Highlight ${index + 1}`,
        hook: `Tease the key insight ${index + 1}`,
        startPercent,
        endPercent
      };
    });
  }

  const openAIModel = requestedModel && wantsOpenAI ? requestedModel : OPENAI_HIGHLIGHTS_MODEL;

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

  // Shared system prompt used by both OpenRouter and OpenAI paths
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
    "Each needs: title, hook, start_percent, end_percent, optional call_to_action",
    "Numeric percentages (0-100), chronological, start < end",
    "Target 30-45 seconds per clip. Return 3-10 viral moments.",
    "Sentence boundaries only. No overlaps.",
    "",
    "**SELECTION CRITERIA:**",
    "- Would this stop mid-scroll in 3 seconds?",
    "- Delivers specific, valuable insight/transformation?",
    "- Emotional resonance or controversy?",
    "- Would viewers share or tag friends?",
    "",
    "Return best options even if transcript lacks strong viral moments, prioritizing specificity, contrarian angles, and emotional stakes."
  ].join(" ");

  // Try OpenRouter for highlights if enabled and not explicitly requesting OpenAI/a specific model
  const OPENROUTER_HIGHLIGHTS_ENABLED = process.env.OPENROUTER_ENABLED === 'true';
  if (OPENROUTER_HIGHLIGHTS_ENABLED && HAS_OPENROUTER_KEY && openRouterClient && !wantsOpenAI) {
    const openRouterHighlightsModel: string = wantsOpenRouterModel && requestedModel
      ? requestedModel
      : OPENROUTER_MODELS.highlights;
    try {
      logger.debug("[Highlights] Trying OpenRouter model", { model: openRouterHighlightsModel });
      const orResp = await openRouterClient.chat.completions.create({
        model: openRouterHighlightsModel,
        messages: [
          { role: "system", content: highlightsSystemContent },
          { role: "user", content: JSON.stringify(userPayload) }
        ],
        max_tokens: 4096,
        temperature: 0.3,
      });
      const orRaw = orResp.choices[0]?.message?.content ?? "{}";
      const orText = orRaw.trim().startsWith("{") ? orRaw : (orRaw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      try {
        const parsedOr = JSON.parse(orText) as { highlights?: Array<any> };
        if (parsedOr.highlights && Array.isArray(parsedOr.highlights) && parsedOr.highlights.length > 0) {
          return parsedOr.highlights
            .map((h) => ({
              title: h.title ?? h.headline ?? "Highlight",
              hook: h.hook ?? h.opening ?? h.title ?? "",
              startPercent: Number.parseFloat(h.start_percent ?? h.startPercent ?? 0),
              endPercent: Number.parseFloat(h.end_percent ?? h.endPercent ?? 0),
              callToAction: h.cta ?? h.call_to_action ?? h.outro ?? undefined,
            }))
            .filter((item) => Number.isFinite(item.startPercent) && Number.isFinite(item.endPercent));
        }
      } catch {
        // JSON parse failed — fall through to OpenAI
      }
      logger.debug("[Highlights] OpenRouter returned no usable highlights, falling back to OpenAI.");
    } catch (error) {
      console.warn("[Highlights] OpenRouter generation failed, falling back to OpenAI:", error instanceof Error ? error.message : error);
    }
  }

  logger.debug("[Highlights] Using OpenAI model", { model: openAIModel });
  const response = await client.responses.create({
    model: openAIModel,
    input: [
      {
        role: "system",
        content: highlightsSystemContent
      },
      {
        role: "user",
        content: JSON.stringify(userPayload)
      }
    ]
  });

  let text =
    response.output_text ??
    response.output
      ?.flatMap((chunk: any) =>
        chunk.content?.map((item: any) => item.text?.value ?? "").filter(Boolean)
      )
      ?.join("")
      ?.trim() ??
    "{}";

  if (text !== "{}" && !text.trim().startsWith("{")) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      text = match[0];
    }
  }

  try {
    const parsed = JSON.parse(text) as { highlights?: Array<any> };
    if (parsed.highlights && Array.isArray(parsed.highlights) && parsed.highlights.length > 0) {
      return parsed.highlights
        .map((highlight) => ({
          title: highlight.title ?? highlight.headline ?? "Highlight",
          hook: highlight.hook ?? highlight.opening ?? highlight.title ?? "",
          startPercent: Number.parseFloat(highlight.start_percent ?? highlight.startPercent ?? 0),
          endPercent: Number.parseFloat(highlight.end_percent ?? highlight.endPercent ?? 0),
          callToAction: highlight.cta ?? highlight.call_to_action ?? highlight.outro ?? undefined
        }))
        .filter((item) => Number.isFinite(item.startPercent) && Number.isFinite(item.endPercent));
    }
  } catch (error) {
    console.error("Failed to parse highlights", error, text);
  }

  const duration = Math.max(1, payload.durationSec);
  const requestedCount = payload.target ?? clipLimit;
  const fallbackCount = Math.min(maxClipCount, Math.max(minClipCount, requestedCount));
  const clipDurationSec = Math.min(
    duration,
    Math.min(maxClipSeconds, Math.max(minClipSeconds, Math.floor(duration / fallbackCount) || minClipSeconds))
  );
  const percentSpan = (clipDurationSec / duration) * 100;

  return Array.from({ length: fallbackCount }).map((_, index) => {
    const startPercent = Math.min(100, Math.max(0, (index / fallbackCount) * 100));
    const endPercent = Math.min(100, startPercent + percentSpan);
    return {
      title: `Highlight ${index + 1}`,
      hook: `Tease the key insight ${index + 1}`,
      startPercent,
      endPercent
    };
  });
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
  const fallbackPrompt = buildImagenFallbackPrompt(baseContext, payload.aspectRatio, payload.styleHint);

  if (!client) {
    return { prompt: fallbackPrompt };
  }

  const requestBody = {
    context: baseContext,
    existing_prompt: payload.existingPrompt?.trim() || null,
    aspect_ratio: payload.aspectRatio ?? null,
    style_hint: payload.styleHint?.trim() || null,
    negative_prompt: payload.negativePrompt?.trim() || null
  };

  const systemContent =
    "You are an imaginative creative director who crafts concise, compelling prompts for Google Imagen or similar diffusion models. Respond with strictly valid JSON shaped as {\"prompt\":\"...\",\"negative_prompt\":\"...\"}. The prompt should be 1-3 sentences, prioritize subject + setting + mood + stylistic guidance, and avoid camera jargon unless requested. Suggest an optional negative_prompt if obvious artifacts should be avoided.";

  let text: string;
  try {
    text = await routedChatCompletion(
      client,
      'imagenPrompt',
      OPENAI_IMAGEN_PROMPT_MODEL,
      [
        { role: "system", content: systemContent },
        { role: "user", content: JSON.stringify(requestBody) }
      ],
      { maxTokens: 512, temperature: 0.7 }
    );
  } catch (err) {
    console.warn("[Imagen] routedChatCompletion failed", err);
    return { prompt: fallbackPrompt };
  }

  if (!text) {
    return { prompt: fallbackPrompt };
  }

  if (!text.trim().startsWith("{")) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      text = match[0];
    }
  }

  try {
    const parsed = JSON.parse(text) as { prompt?: string; negative_prompt?: string };
    const finalPrompt = parsed.prompt?.trim() || fallbackPrompt;
    const negative = parsed.negative_prompt?.trim();
    return negative ? { prompt: finalPrompt, negativePrompt: negative } : { prompt: finalPrompt };
  } catch (error) {
    console.warn("[Imagen] Failed to parse prompt JSON", error, text);
    return { prompt: text.trim() || fallbackPrompt };
  }
}

function buildImagenFallbackPrompt(context: string, aspectRatio?: string, styleHint?: string) {
  const trimmed = context || "high-impact marketing visual";
  const pieces = [
    `Highly detailed scene illustrating ${trimmed}`,
    "rich lighting, strong composition, storytelling energy"
  ];
  if (styleHint) {
    pieces.push(`style: ${styleHint}`);
  }
  if (aspectRatio) {
    pieces.push(`framed for ${aspectRatio}`);
  }
  return pieces.join(", ");
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
