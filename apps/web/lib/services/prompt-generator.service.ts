/**
 * AI Prompt Generator Service
 *
 * Optional helper for auto-filling clipping goals from transcript content.
 * It uses the current model-policy architecture and never generates timestamps.
 */

import { z } from "zod";

import { logger } from "@/lib/logger";
import {
  resolveModelPolicy,
  type UserPlan,
} from "@/lib/ai/model-policy";
import type { ClipIntent, QualityMode } from "@/lib/ai/model-routing-options";
import type { TranscriptPrecision } from "@/lib/ai/providers/openai-transcription-provider";
import { openRouterJson } from "@/lib/ai/providers/openrouter-reasoning-provider";

const MAX_TRANSCRIPT_SAMPLE_CHARS = 10_000;

export const GeneratedPromptsSchema = z.object({
  brief: z.string().min(40).max(700),
  audience: z.string().min(20).max(250),
  tone: z.string().min(10).max(180),
  callToAction: z.string().min(10).max(180),
  reasoning: z.string().min(30).max(800),
});

const GeneratedPromptsJsonSchema = {
  name: "repurpose_clip_goal_prompts",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief", "audience", "tone", "callToAction", "reasoning"],
    properties: {
      brief: { type: "string", minLength: 40, maxLength: 700 },
      audience: { type: "string", minLength: 20, maxLength: 250 },
      tone: { type: "string", minLength: 10, maxLength: 180 },
      callToAction: { type: "string", minLength: 10, maxLength: 180 },
      reasoning: { type: "string", minLength: 30, maxLength: 800 },
    },
  },
} as const;

export interface TranscriptPromptInput {
  transcript: string;
  videoTitle?: string;
  platform?: string;
  customInstructions?: string;
  qualityMode?: QualityMode;
  clipIntent?: ClipIntent;
  userPlan?: UserPlan | string | null;
  videoDurationSec?: number | null;
  transcriptPrecision?: TranscriptPrecision | null;
  requestedOverrideModel?: string | null;
  isAdmin?: boolean;
  isDev?: boolean;
}

export type GeneratedPrompts = z.infer<typeof GeneratedPromptsSchema>;

export type PromptGenerationResult = {
  prompts: GeneratedPrompts;
  source: "ai" | "local_fallback";
  model?: string;
  warning?: string;
};

export class PromptGeneratorService {
  /**
   * Generate goal prompts by analyzing transcript content. If OpenRouter is
   * unavailable, return a deterministic local fallback so clipping can continue.
   */
  async generateFromTranscript(input: TranscriptPromptInput): Promise<PromptGenerationResult> {
    const plainTranscript = extractPlainTranscriptText(input.transcript);
    const transcriptSample = buildPromptGeneratorTranscriptSample(
      plainTranscript,
      MAX_TRANSCRIPT_SAMPLE_CHARS,
    );
    const modelPolicy = resolveModelPolicy({
      task: "prompt_clip_intent",
      qualityMode: input.qualityMode ?? "balanced",
      userPlan: input.userPlan ?? "free",
      videoDurationSec: input.videoDurationSec,
      transcriptPrecision: input.transcriptPrecision,
      requestedOverrideModel: input.requestedOverrideModel,
      isAdmin: input.isAdmin,
      isDev: input.isDev,
    });

    logger.info("Generating clip goal prompts from transcript", {
      transcriptLength: plainTranscript.length,
      sampleLength: transcriptSample.length,
      videoTitle: input.videoTitle,
      platform: input.platform,
      model: modelPolicy.primaryModel,
      task: modelPolicy.task,
    });

    const failures: string[] = [];
    for (const model of Array.from(new Set([modelPolicy.primaryModel, ...modelPolicy.fallbackModels]))) {
      try {
        const result = await openRouterJson({
          model,
          schema: GeneratedPromptsSchema,
          jsonSchema: GeneratedPromptsJsonSchema,
          structuredMode: modelPolicy.structuredOutputMode,
          system: getTranscriptSystemPrompt(),
          user: buildTranscriptUserPayload({
            ...input,
            transcript: transcriptSample,
            clipIntent: input.clipIntent ?? "auto",
          }),
          temperature: modelPolicy.temperature,
          maxTokens: modelPolicy.maxTokens,
          timeoutMs: modelPolicy.timeoutMs,
        });

        logger.info("Transcript-based prompt suggestions generated", {
          model: result.model,
          fallbackUsed: result.model !== modelPolicy.primaryModel,
          briefLength: result.data.brief.length,
        });

        return {
          prompts: result.data,
          source: "ai",
          model: result.model,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${model}: ${reason}`);
        logger.warn("Prompt generator model failed", {
          model,
          task: modelPolicy.task,
          reason,
        });
      }
    }

    logger.warn("Prompt generator OpenRouter routing failed; using local fallback", {
      failures,
    });
    return {
      prompts: generateLocalPromptFallback({
        transcript: plainTranscript,
        videoTitle: input.videoTitle,
        platform: input.platform,
        customInstructions: input.customInstructions,
      }),
      source: "local_fallback",
      warning:
        "AI prompt generation was unavailable, so we generated a safe fallback you can edit.",
    };
  }
}

export const promptGeneratorService = new PromptGeneratorService();

function getTranscriptSystemPrompt(): string {
  return [
    "You are an expert short-form video strategist for ViralSnipAI.",
    "Analyze transcript content and suggest clipping goals only.",
    "Do not create, infer, modify, or output clip timestamps.",
    "Return JSON only. The output must be grounded in the transcript and useful for finding clip-worthy moments.",
  ].join("\n");
}

function buildTranscriptUserPayload(input: TranscriptPromptInput & { transcript: string }) {
  return {
    videoTitle: input.videoTitle,
    platform: input.platform ?? "All Platforms",
    clipIntent: input.clipIntent ?? "auto",
    customInstructions: input.customInstructions,
    transcriptSample: input.transcript,
    outputGuidance: {
      brief:
        "Specific moments to find in this video. Mention concrete topics, claims, questions, examples, or advice from the transcript.",
      audience: "Who would find this specific content valuable.",
      tone: "How the selected clips should feel based on the speaker/content.",
      callToAction: "A concise CTA connected to the video topic.",
      reasoning: "Why these goals fit the transcript.",
    },
  };
}

export function extractPlainTranscriptText(transcript: string): string {
  const trimmed = transcript.trim();
  if (!trimmed) throw new Error("Transcript is empty.");

  try {
    const parsed = JSON.parse(trimmed) as {
      text?: unknown;
      segments?: Array<{ text?: unknown }>;
    };
    if (typeof parsed.text === "string" && parsed.text.trim()) {
      return normalizeText(parsed.text);
    }
    if (Array.isArray(parsed.segments)) {
      const text = parsed.segments
        .map((segment) => (typeof segment.text === "string" ? segment.text : ""))
        .filter(Boolean)
        .join(" ");
      if (text.trim()) return normalizeText(text);
    }
  } catch {
    // Legacy transcripts are plain text; keep parsing permissive.
  }

  const normalized = normalizeText(trimmed);
  if (!normalized) throw new Error("Transcript is empty.");
  return normalized;
}

export function buildPromptGeneratorTranscriptSample(
  transcript: string,
  maxChars = MAX_TRANSCRIPT_SAMPLE_CHARS,
): string {
  const normalized = normalizeText(transcript);
  if (!normalized) throw new Error("Transcript is empty.");
  if (normalized.length <= maxChars) return normalized;

  const topicHints = extractTopicHints(normalized, Math.floor(maxChars * 0.1));
  const remaining = Math.max(1200, maxChars - topicHints.length - 120);
  const introLength = Math.floor(remaining * 0.35);
  const middleLength = Math.floor(remaining * 0.35);
  const endingLength = Math.max(800, remaining - introLength - middleLength);
  const middleStart = Math.max(0, Math.floor(normalized.length / 2 - middleLength / 2));

  return [
    topicHints ? `Topic hints: ${topicHints}` : null,
    "Transcript beginning:",
    normalized.slice(0, introLength),
    "Transcript middle:",
    normalized.slice(middleStart, middleStart + middleLength),
    "Transcript ending:",
    normalized.slice(-endingLength),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, maxChars);
}

export function generateLocalPromptFallback(input: {
  transcript: string;
  videoTitle?: string;
  platform?: string;
  customInstructions?: string;
}): GeneratedPrompts {
  const transcript = extractPlainTranscriptText(input.transcript);
  const keywords = extractKeywords(transcript).slice(0, 6);
  const questions = (transcript.match(/\b(why|how|what|when|where|should|can)\b[^.?!]{15,120}[?]/gi) ?? [])
    .slice(0, 2)
    .map((item) => item.trim());
  const numbers = (transcript.match(/\b\d+(?:[.,]\d+)?\s*(?:%|percent|x|times|days|weeks|months|years|minutes|hours)?\b/gi) ?? [])
    .slice(0, 4);
  const topic = keywords.length > 0 ? keywords.join(", ") : input.videoTitle || "the video's main topic";
  const evidence = [
    keywords.length > 0 ? `recurring topics like ${keywords.join(", ")}` : null,
    questions.length > 0 ? "clear questions or problem statements" : null,
    numbers.length > 0 ? `specific numbers such as ${numbers.join(", ")}` : null,
    input.customInstructions ? `your instruction: ${input.customInstructions}` : null,
  ].filter(Boolean).join("; ");

  return GeneratedPromptsSchema.parse({
    brief:
      `Find clear, self-contained moments about ${topic}. Prioritize strong openings, specific claims, actionable advice, questions with satisfying answers, and complete thoughts that can stand alone as short clips.`,
    audience:
      `Creators, founders, professionals, learners, and viewers interested in ${topic} who want practical, high-signal takeaways.`,
    tone:
      "Clear, practical, high-signal, concise, and confident while preserving the speaker's natural style.",
    callToAction:
      `Follow for more practical insights${input.platform ? ` on ${input.platform}` : ""} and watch the full video for the complete context.`,
    reasoning:
      `AI prompt generation was unavailable, so ViralSnipAI prepared editable fallback goals from transcript structure${evidence ? `, including ${evidence}` : ""}. These prompts avoid timestamps and keep the clip search focused on complete, useful moments.`,
  });
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTopicHints(text: string, maxChars: number): string {
  return extractKeywords(text).slice(0, 12).join(", ").slice(0, maxChars);
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "about", "after", "again", "also", "because", "before", "could", "every", "from",
    "have", "just", "like", "more", "much", "really", "right", "should", "some",
    "that", "their", "there", "these", "they", "this", "those", "through", "very",
    "what", "when", "where", "which", "while", "with", "would", "your", "youre",
  ]);
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) ?? []) {
    const clean = word.replace(/'s$/, "");
    if (stopWords.has(clean)) continue;
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word);
}
