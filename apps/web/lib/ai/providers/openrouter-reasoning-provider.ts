import { z } from "zod";

import { logger } from "@/lib/logger";
import type { ClipCandidate } from "@/lib/domain/services/ClipCandidateGenerationService";
import type { TranscriptPrecision } from "@/lib/ai/providers/openai-transcription-provider";
import {
  bRollSuggestionsResponseSchema,
  type BrollSuggestion,
} from "@/lib/repurpose/creative-enhancements";

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const OPENROUTER_SITE_URL =
  process.env.OPENROUTER_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://viralsnipai.com";
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME ?? "ViralSnipAI";
const OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 180_000);
const OPENROUTER_MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES ?? 2);

const RerankResponseSchema = z
  .object({
    selected: z.array(
      z.object({
        candidateId: z.string(),
        rank: z.number().int().positive(),
        title: z.string().min(1).max(120),
        hook: z.string().min(1).max(240),
        callToAction: z.string().nullable().optional(),
        llmScore: z.number().min(0).max(100),
        viralReason: z.string().min(1).max(500),
        editingNotes: z.array(z.string()).default([]),
        platformFit: z.object({
          youtubeShorts: z.number().min(0).max(100),
          instagramReels: z.number().min(0).max(100),
          tiktok: z.number().min(0).max(100),
          x: z.number().min(0).max(100),
        }),
      }),
    ),
    overallWarnings: z.array(z.string()).default([]),
  })
  .passthrough();

const ViralitySchema = z.object({
  score: z.number().min(0).max(100),
  factors: z.object({
    hookStrength: z.number().min(0).max(100),
    emotionalPeak: z.number().min(0).max(100),
    storyArc: z.number().min(0).max(100),
    pacing: z.number().min(0).max(100),
    transcriptQuality: z.number().min(0).max(100),
    shareability: z.number().min(0).max(100).optional(),
  }),
  reasoning: z.string().default(""),
  improvements: z.array(z.string()).default([]),
});

const MetadataSchema = z.object({
  title: z.string().min(1).max(120),
  hook: z.string().min(1).max(240),
  callToAction: z.string().nullable().optional(),
  summary: z.string().max(500).optional(),
});

const CaptionCleanupSchema = z.object({
  text: z.string(),
  warnings: z.array(z.string()).default([]),
});

const RerankJsonSchema = {
  name: "clip_candidate_rerank",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["selected", "overallWarnings"],
    properties: {
      selected: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
          required: [
            "candidateId",
            "rank",
            "title",
            "hook",
            "llmScore",
            "viralReason",
            "platformFit",
          ],
          properties: {
            candidateId: { type: "string" },
            rank: { type: "integer", minimum: 1 },
            title: { type: "string" },
            hook: { type: "string" },
            callToAction: { type: ["string", "null"] },
            llmScore: { type: "number", minimum: 0, maximum: 100 },
            viralReason: { type: "string" },
            editingNotes: { type: "array", items: { type: "string" } },
            platformFit: {
              type: "object",
              additionalProperties: false,
              required: ["youtubeShorts", "instagramReels", "tiktok", "x"],
              properties: {
                youtubeShorts: { type: "number", minimum: 0, maximum: 100 },
                instagramReels: { type: "number", minimum: 0, maximum: 100 },
                tiktok: { type: "number", minimum: 0, maximum: 100 },
                x: { type: "number", minimum: 0, maximum: 100 },
              },
            },
          },
        },
      },
      overallWarnings: { type: "array", items: { type: "string" } },
    },
  },
} as const;

const ViralityJsonSchema = {
  name: "clip_virality_score",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["score", "factors", "reasoning", "improvements"],
    properties: {
      score: { type: "number", minimum: 0, maximum: 100 },
      factors: {
        type: "object",
        additionalProperties: false,
        required: [
          "hookStrength",
          "emotionalPeak",
          "storyArc",
          "pacing",
          "transcriptQuality",
          "shareability",
        ],
        properties: {
          hookStrength: { type: "number", minimum: 0, maximum: 100 },
          emotionalPeak: { type: "number", minimum: 0, maximum: 100 },
          storyArc: { type: "number", minimum: 0, maximum: 100 },
          pacing: { type: "number", minimum: 0, maximum: 100 },
          transcriptQuality: { type: "number", minimum: 0, maximum: 100 },
          shareability: { type: "number", minimum: 0, maximum: 100 },
        },
      },
      reasoning: { type: "string" },
      improvements: { type: "array", items: { type: "string" } },
    },
  },
} as const;

const MetadataJsonSchema = {
  name: "clip_metadata",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "hook", "callToAction", "summary"],
    properties: {
      title: { type: "string" },
      hook: { type: "string" },
      callToAction: { type: ["string", "null"] },
      summary: { type: "string" },
    },
  },
} as const;

const CaptionCleanupJsonSchema = {
  name: "caption_cleanup",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["text", "warnings"],
    properties: {
      text: { type: "string" },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
} as const;

const BrollSuggestionJsonSchema = {
  name: "broll_suggestions",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["suggestions", "warnings"],
    properties: {
      suggestions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["searchQuery", "startMs", "endMs", "reason", "visualStyle", "priority"],
          properties: {
            searchQuery: { type: "string" },
            startMs: { type: "integer", minimum: 0 },
            endMs: { type: "integer", minimum: 1 },
            reason: { type: "string" },
            visualStyle: { type: "string" },
            priority: { type: "number", minimum: 0, maximum: 100 },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
} as const;

export type ClipRerankSelection = z.infer<typeof RerankResponseSchema>["selected"][number] & {
  finalScore: number;
};

export type ClipRerankResult = {
  selected: ClipRerankSelection[];
  overallWarnings: string[];
  model: string;
};

export type ViralityReasoningResult = z.infer<typeof ViralitySchema> & {
  model: string;
};

export async function openRouterJson<T>(params: {
  model: string;
  system: string;
  user: unknown;
  schema: z.ZodType<T>;
  jsonSchema?: Record<string, unknown>;
  structuredMode?: "json_schema" | "json_object" | "auto";
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ data: T; model: string; latencyMs: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for reasoning tasks.");
  }

  let lastError: unknown = null;
  const attempts = Math.max(1, OPENROUTER_MAX_RETRIES + 1);
  const modes = getStructuredModes(params.structuredMode ?? "auto", params.jsonSchema);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    for (const mode of modes) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const requestTimeoutMs =
        typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs)
          ? params.timeoutMs
          : OPENROUTER_TIMEOUT_MS;
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": OPENROUTER_SITE_URL,
            "X-OpenRouter-Title": OPENROUTER_APP_NAME,
          },
          body: JSON.stringify({
            model: params.model,
            messages: [
              { role: "system", content: params.system },
              {
                role: "user",
                content:
                  typeof params.user === "string" ? params.user : JSON.stringify(params.user),
              },
            ],
            response_format: buildResponseFormat(mode, params.jsonSchema),
            temperature: params.temperature ?? 0.2,
            max_tokens: params.maxTokens ?? 4000,
            stream: false,
          }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = payload?.error?.message ?? response.statusText;
          const error = new OpenRouterReasoningError(message, response.status, mode);
          if (
            mode === "json_schema" &&
            isJsonSchemaUnsupported(error) &&
            modes.includes("json_object")
          ) {
            logger.warn("OpenRouter JSON schema mode unsupported; falling back to json_object", {
              model: params.model,
              status: response.status,
              error: message,
            });
            continue;
          }
          throw error;
        }

        const raw = extractMessageContent(payload);
        const parsed = parseJsonObject(raw);
        const data = params.schema.parse(parsed);
        const latencyMs = Date.now() - startedAt;
        logger.info("OpenRouter reasoning completed", {
          model: params.model,
          structuredMode: mode,
          latencyMs,
        });
        return { data, model: params.model, latencyMs };
      } catch (error) {
        lastError = error;
        const retryable = isRetryableOpenRouterError(error);
        logger.warn("OpenRouter reasoning attempt failed", {
          model: params.model,
          structuredMode: mode,
          attempt: attempt + 1,
          retryable,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!retryable || attempt >= attempts - 1) break;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (attempt < attempts - 1) await sleep(650 * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter reasoning failed.");
}

export async function rerankClipCandidates(params: {
  candidates: ClipCandidate[];
  targetClipCount: number;
  audience?: string;
  tone?: string;
  brief?: string;
  callToAction?: string;
  transcriptPrecision: TranscriptPrecision;
  sourceDurationSec: number;
  clipPolicy?: {
    minMs: number;
    idealMs: number;
    maxMs: number;
  };
  model?: string;
}): Promise<ClipRerankResult> {
  const model = normalizeOpenRouterModel(
    params.model ?? process.env.OPENROUTER_HIGHLIGHT_RERANK_MODEL ?? "google/gemini-2.5-pro",
  );
  const candidateIds = new Set(params.candidates.map((candidate) => candidate.id));

  const result = await openRouterJson({
    model,
    schema: RerankResponseSchema,
    jsonSchema: RerankJsonSchema,
    system: [
      "You rerank precomputed short-video clip candidates.",
      "You may only select candidate IDs from the provided list.",
      "Never create, infer, modify, or output final timestamps.",
      "If you include timestamps, they will be ignored and logged.",
      "Return fewer clips when candidates are weak. Do not force filler clips.",
    ].join("\n"),
    user: {
      targetClipCount: params.targetClipCount,
      audience: params.audience,
      tone: params.tone,
      brief: params.brief,
      callToAction: params.callToAction,
      transcriptPrecision: params.transcriptPrecision,
      sourceDurationSec: params.sourceDurationSec,
      clipPolicy: params.clipPolicy,
      candidates: params.candidates.map((candidate) => ({
        id: candidate.id,
        startMs: candidate.startMs,
        endMs: candidate.endMs,
        durationSec: Math.round((candidate.endMs - candidate.startMs) / 1000),
        text: candidate.text.slice(0, 1800),
        firstWords: candidate.firstWords,
        lastWords: candidate.lastWords,
        candidateType: candidate.candidateType,
        deterministicScore: candidate.deterministicScore,
        qualitySignals: candidate.qualitySignals,
        reasons: candidate.reasons,
      })),
    },
    maxTokens: 5000,
  });

  const selected = result.data.selected
    .filter((selection) => {
      const valid = candidateIds.has(selection.candidateId);
      if (!valid) {
        logger.warn("OpenRouter selected unknown candidate ID; dropping", {
          candidateId: selection.candidateId,
          model,
        });
      }
      return valid;
    })
    .map((selection) => {
      const candidate = params.candidates.find((item) => item.id === selection.candidateId)!;
      const record = selection as unknown as Record<string, unknown>;
      if ("startMs" in record || "endMs" in record || "startSec" in record || "endSec" in record) {
        logger.warn("OpenRouter returned timestamps in rerank response; ignoring them", {
          candidateId: selection.candidateId,
          model,
        });
      }
      return {
        ...selection,
        editingNotes: selection.editingNotes ?? [],
        finalScore: Math.round(candidate.deterministicScore * 0.45 + selection.llmScore * 0.55),
      };
    })
    .sort((a, b) => a.rank - b.rank || b.finalScore - a.finalScore)
    .slice(0, params.targetClipCount);

  return {
    selected,
    overallWarnings: result.data.overallWarnings ?? [],
    model: result.model,
  };
}

export async function scoreClipVirality(params: {
  text: string;
  firstThreeSecondsText?: string;
  durationSec: number;
  candidateType?: string;
  deterministicQualitySignals?: unknown;
  pacing?: unknown;
  transcriptPrecision?: TranscriptPrecision;
  boundaryConfidence?: "high" | "medium" | "low";
  model?: string;
}): Promise<ViralityReasoningResult> {
  const model = normalizeOpenRouterModel(
    params.model ?? process.env.OPENROUTER_VIRALITY_MODEL ?? "google/gemini-3.1-flash-lite-preview",
  );
  const result = await openRouterJson({
    model,
    schema: ViralitySchema,
    jsonSchema: ViralityJsonSchema,
    system: [
      "You score short-form clip virality from provided transcript text and quality signals.",
      "Do not create, infer, modify, or discuss clip timestamps.",
      "Return only JSON matching the requested schema.",
    ].join("\n"),
    user: params,
    maxTokens: 2200,
  });
  return {
    ...result.data,
    reasoning: result.data.reasoning ?? "",
    improvements: result.data.improvements ?? [],
    model: result.model,
  };
}

export async function generateClipMetadata(params: {
  text: string;
  audience?: string;
  tone?: string;
  callToAction?: string;
  model?: string;
}) {
  const model = normalizeOpenRouterModel(
    params.model ?? process.env.OPENROUTER_METADATA_MODEL ?? "google/gemini-3.1-flash-lite-preview",
  );
  const result = await openRouterJson({
    model,
    schema: MetadataSchema,
    jsonSchema: MetadataJsonSchema,
    system: "Generate short-video metadata. Never output timestamps.",
    user: params,
    maxTokens: 1200,
  });
  return { ...result.data, model: result.model };
}

export async function cleanupCaptionText(params: { text: string; model?: string }) {
  const model = normalizeOpenRouterModel(
    params.model ?? process.env.OPENROUTER_CAPTION_MODEL ?? "google/gemini-3.1-flash-lite-preview",
  );
  const result = await openRouterJson({
    model,
    schema: CaptionCleanupSchema,
    jsonSchema: CaptionCleanupJsonSchema,
    system: "Clean caption text for readability without changing meaning. Never output timestamps.",
    user: params,
    maxTokens: 1200,
  });
  return { ...result.data, model: result.model };
}

export async function suggestBrollMoments(params: {
  clipTranscript: string;
  clipDurationMs: number;
  candidateType?: string | null;
  platform?: string | null;
  tone?: string | null;
  audience?: string | null;
  model?: string;
}): Promise<{ suggestions: BrollSuggestion[]; warnings: string[]; model: string }> {
  const model = normalizeOpenRouterModel(
    params.model ?? process.env.OPENROUTER_METADATA_MODEL ?? "google/gemini-3.1-flash-lite-preview",
  );
  const result = await openRouterJson({
    model,
    schema: bRollSuggestionsResponseSchema,
    jsonSchema: BrollSuggestionJsonSchema,
    system: [
      "You suggest creative b-roll moments for a short-form clip.",
      "Return search queries and relative moment windows only.",
      "You do not control final clip boundaries or source timestamps.",
      "Keep startMs/endMs inside the provided clip duration; local code will validate them.",
    ].join("\n"),
    user: {
      clipTranscript: params.clipTranscript.slice(0, 4000),
      clipDurationMs: params.clipDurationMs,
      candidateType: params.candidateType,
      platform: params.platform,
      tone: params.tone,
      audience: params.audience,
    },
    maxTokens: 1800,
  });
  return {
    suggestions: result.data.suggestions.map((suggestion) => ({
      searchQuery: suggestion.searchQuery,
      startMs: suggestion.startMs,
      endMs: suggestion.endMs,
      reason: suggestion.reason ?? "",
      visualStyle: suggestion.visualStyle ?? "editorial b-roll",
      priority: suggestion.priority ?? 50,
    })),
    warnings: result.data.warnings ?? [],
    model: result.model,
  };
}

export function normalizeOpenRouterModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed.includes("/")) {
    throw new Error(`OpenRouter model "${model}" must use provider/model format.`);
  }
  return trimmed;
}

class OpenRouterReasoningError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly structuredMode?: string,
  ) {
    super(message);
    this.name = "OpenRouterReasoningError";
  }
}

function getStructuredModes(
  mode: "json_schema" | "json_object" | "auto",
  jsonSchema?: Record<string, unknown>,
) {
  if (mode === "json_schema")
    return jsonSchema ? ["json_schema" as const] : ["json_object" as const];
  if (mode === "json_object") return ["json_object" as const];
  return jsonSchema ? ["json_schema" as const, "json_object" as const] : ["json_object" as const];
}

function buildResponseFormat(
  mode: "json_schema" | "json_object",
  jsonSchema?: Record<string, unknown>,
) {
  if (mode === "json_schema" && jsonSchema) {
    return {
      type: "json_schema",
      json_schema: jsonSchema,
    };
  }
  return { type: "json_object" };
}

function extractMessageContent(body: unknown): string {
  const content = (body as any)?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : (part?.text ?? ""))).join("\n");
  }
  return "";
}

function parseJsonObject(raw: string): unknown {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(repairJson(stripped.slice(start, end + 1)));
    try {
      return JSON.parse(repairJson(stripped));
    } catch {
      // Throw the clearer domain-specific error below.
    }
    throw new Error("OpenRouter response did not contain valid JSON.");
  }
}

function repairJson(value: string) {
  return value.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001F]+/g, " ");
}

function isJsonSchemaUnsupported(error: OpenRouterReasoningError) {
  const message = error.message.toLowerCase();
  return (
    error.status === 400 &&
    (message.includes("response_format") ||
      message.includes("json_schema") ||
      message.includes("schema") ||
      message.includes("unsupported"))
  );
}

function isRetryableOpenRouterError(error: unknown): boolean {
  if (error instanceof OpenRouterReasoningError && error.status) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof z.ZodError) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") || message.includes("abort") || message.includes("rate limit")
    );
  }
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
