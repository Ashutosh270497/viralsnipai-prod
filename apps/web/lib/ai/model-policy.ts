import type { TranscriptPrecision } from "@/lib/ai/providers/openai-transcription-provider";
import {
  CLIP_INTENT_OPTIONS,
  type ClipIntent,
  type QualityMode,
} from "@/lib/ai/model-routing-options";

export type AIModelTask =
  | "highlight_rerank"
  | "virality_score"
  | "clip_metadata"
  | "caption_cleanup"
  | "caption_translate"
  | "prompt_clip_intent"
  | "visual_frame_analysis";

export type UserPlan = "free" | "plus" | "pro" | "agency" | "internal";

export type ModelPolicy = {
  task: AIModelTask;
  qualityMode: QualityMode;
  userPlan: UserPlan;
  provider: "openrouter" | "openai" | "local";
  primaryModel: string;
  fallbackModels: string[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  structuredOutputMode: "json_schema" | "json_object" | "auto";
  costTier: "low" | "medium" | "high";
  modelSelectionReason: string;
};

export type ResolveModelPolicyInput = {
  task: AIModelTask;
  qualityMode?: QualityMode;
  userPlan?: string | null;
  videoDurationSec?: number | null;
  transcriptPrecision?: TranscriptPrecision | null;
  requestedOverrideModel?: string | null;
  isAdmin?: boolean;
  isDev?: boolean;
};

const DEFAULT_MODELS = {
  fast: process.env.OPENROUTER_FAST_MODEL ?? "google/gemini-3-flash-preview",
  balanced: process.env.OPENROUTER_HIGHLIGHT_RERANK_MODEL ?? "google/gemini-3-flash-preview",
  best: process.env.OPENROUTER_BEST_RERANK_MODEL ?? process.env.OPENROUTER_BEST_MODEL ?? "anthropic/claude-sonnet-4.6",
  virality: process.env.OPENROUTER_VIRALITY_MODEL ?? "google/gemini-3.1-flash-lite-preview",
  metadata: process.env.OPENROUTER_METADATA_MODEL ?? "google/gemini-3.1-flash-lite-preview",
  caption: process.env.OPENROUTER_CAPTION_MODEL ?? "google/gemini-3.1-flash-lite-preview",
  promptGenerator: process.env.OPENROUTER_PROMPT_GENERATOR_MODEL ?? "openai/gpt-5.2",
};

const BEST_QUALITY_FALLBACK_MODELS = [
  "google/gemini-3-flash-preview",
  "qwen/qwen3.6-plus",
];

const HIGHLIGHT_RERANK_BALANCED_FALLBACK_MODELS = [
  "anthropic/claude-sonnet-4.6",
  "qwen/qwen3.6-plus",
];

const PROMPT_GENERATOR_TIMEOUT_MS = Number(process.env.OPENROUTER_PROMPT_GENERATOR_TIMEOUT_MS ?? 90_000);

export function resolveModelPolicy(input: ResolveModelPolicyInput): ModelPolicy {
  const isDev = input.isDev ?? process.env.NODE_ENV !== "production";
  const isAdmin = Boolean(input.isAdmin);
  const qualityMode = normalizeQualityMode(input.qualityMode);
  const userPlan = normalizeUserPlan(input.userPlan);
  const effectiveQuality = capQualityForPlan(qualityMode, userPlan);
  const override = input.requestedOverrideModel?.trim();

  if (override) {
    if (!isDev && !isAdmin) {
      throw new Error("Model overrides are restricted to developer/admin contexts.");
    }
    return buildPolicy({
      task: input.task,
      qualityMode: effectiveQuality,
      userPlan,
      primaryModel: normalizePolicyOpenRouterModel(override),
      fallbackModels: fallbackModelsFor(input.task, effectiveQuality).filter((model) => model !== override),
      costTier: effectiveQuality === "best" ? "high" : effectiveQuality === "balanced" ? "medium" : "low",
      reason: "Developer/admin override selected.",
    });
  }

  const longVideo = typeof input.videoDurationSec === "number" && input.videoDurationSec >= 30 * 60;
  const lowPrecision = input.transcriptPrecision && input.transcriptPrecision !== "word";
  const reasonParts = [
    `Resolved ${input.task} from ${effectiveQuality} quality mode.`,
    userPlan !== "free" ? `${userPlan} plan can access higher-quality routing.` : "Free plan uses cost-safe routing.",
    longVideo ? "Long video detected; favoring reliable long-context models." : null,
    lowPrecision ? "Transcript is below word precision; favoring conservative structured reasoning." : null,
  ].filter(Boolean);

  if (input.task === "highlight_rerank") {
    const primaryModel = modelForQuality(effectiveQuality);
    return buildPolicy({
      task: input.task,
      qualityMode: effectiveQuality,
      userPlan,
      primaryModel,
      fallbackModels: fallbackModelsFor(input.task, effectiveQuality, primaryModel),
      maxTokens: effectiveQuality === "fast" ? 3200 : 5000,
      temperature: intentTemperature(effectiveQuality),
      costTier: effectiveQuality === "best" ? "high" : effectiveQuality === "balanced" ? "medium" : "low",
      reason: reasonParts.join(" "),
    });
  }

  if (input.task === "virality_score") {
    return buildPolicy({
      task: input.task,
      qualityMode: effectiveQuality,
      userPlan,
      primaryModel: effectiveQuality === "best" ? DEFAULT_MODELS.best : DEFAULT_MODELS.virality,
      fallbackModels: effectiveQuality === "best"
        ? BEST_QUALITY_FALLBACK_MODELS
        : [DEFAULT_MODELS.virality, DEFAULT_MODELS.fast, "qwen/qwen3.6-plus"],
      maxTokens: 2200,
      temperature: 0.2,
      costTier: effectiveQuality === "best" ? "high" : "low",
      reason: reasonParts.join(" "),
    });
  }

  if (input.task === "prompt_clip_intent") {
    const fallbackModels = promptGeneratorFallbackModels(effectiveQuality);
    return buildPolicy({
      task: input.task,
      qualityMode: effectiveQuality,
      userPlan,
      primaryModel: effectiveQuality === "best"
        ? DEFAULT_MODELS.best
        : effectiveQuality === "fast"
          ? DEFAULT_MODELS.fast
          : DEFAULT_MODELS.promptGenerator,
      fallbackModels,
      maxTokens: 1600,
      temperature: 0.3,
      timeoutMs: Number.isFinite(PROMPT_GENERATOR_TIMEOUT_MS)
        ? PROMPT_GENERATOR_TIMEOUT_MS
        : 90_000,
      costTier: effectiveQuality === "best" ? "high" : effectiveQuality === "balanced" ? "medium" : "low",
      reason: `${reasonParts.join(" ")} Prompt generation uses task-specific routing and timeout.`,
    });
  }

  if (input.task === "clip_metadata") {
    return buildPolicy({
      task: input.task,
      qualityMode: effectiveQuality,
      userPlan,
      primaryModel: effectiveQuality === "best"
        ? DEFAULT_MODELS.best
        : effectiveQuality === "fast"
          ? DEFAULT_MODELS.virality
          : DEFAULT_MODELS.metadata,
      fallbackModels: effectiveQuality === "best"
        ? BEST_QUALITY_FALLBACK_MODELS
        : [DEFAULT_MODELS.virality, DEFAULT_MODELS.fast, "qwen/qwen3.6-plus"],
      maxTokens: 1600,
      temperature: 0.35,
      costTier: effectiveQuality === "best" ? "high" : "low",
      reason: reasonParts.join(" "),
    });
  }

  return buildPolicy({
    task: input.task,
    qualityMode: effectiveQuality,
    userPlan,
    primaryModel: DEFAULT_MODELS.caption,
    fallbackModels: [DEFAULT_MODELS.virality, DEFAULT_MODELS.fast, "qwen/qwen3.6-plus"],
    maxTokens: 1600,
    temperature: 0.25,
    costTier: "low",
    reason: reasonParts.join(" "),
  });
}

function splitModelList(value?: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function promptGeneratorFallbackModels(qualityMode: QualityMode) {
  const envFallbacks = splitModelList(process.env.OPENROUTER_PROMPT_GENERATOR_FALLBACK_MODELS);
  if (envFallbacks.length > 0) return envFallbacks;

  return ["qwen/qwen3.6-plus"];
}

export function canUseModelDebug(params?: {
  userEmail?: string | null;
  isAdmin?: boolean;
  isDev?: boolean;
}) {
  if (params?.isDev ?? process.env.NODE_ENV !== "production") return true;
  if (process.env.NEXT_PUBLIC_ENABLE_MODEL_DEBUG === "true") return true;
  if (process.env.ENABLE_MODEL_DEBUG === "true") return true;
  if (params?.isAdmin) return true;

  const email = params?.userEmail?.trim().toLowerCase();
  const adminEmails = (process.env.INTERNAL_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && adminEmails.includes(email));
}

export function normalizeQualityMode(value?: string | null): QualityMode {
  return value === "fast" || value === "balanced" || value === "best" ? value : "balanced";
}

export function normalizeClipIntent(value?: string | null): ClipIntent {
  return CLIP_INTENT_OPTIONS.some((option) => option.value === value)
    ? (value as ClipIntent)
    : "auto";
}

export function normalizeUserPlan(value?: string | null): UserPlan {
  if (value === "agency" || value === "internal") return value;
  if (value === "studio") return "agency";
  if (value === "creator") return "pro";
  if (value === "starter") return "plus";
  if (value === "pro" || value === "plus") return value;
  return "free";
}

export function normalizePolicyOpenRouterModel(model: string): string {
  const trimmed = model.trim();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.:-]+$/i.test(trimmed)) {
    throw new Error(`OpenRouter model "${model}" must use provider/model format.`);
  }
  return trimmed;
}

function capQualityForPlan(qualityMode: QualityMode, userPlan: UserPlan): QualityMode {
  if (qualityMode !== "best") return qualityMode;
  if (userPlan === "pro" || userPlan === "agency" || userPlan === "internal") return "best";
  return "balanced";
}

function modelForQuality(qualityMode: QualityMode) {
  if (qualityMode === "fast") return DEFAULT_MODELS.fast;
  if (qualityMode === "best") return DEFAULT_MODELS.best;
  return DEFAULT_MODELS.balanced;
}

function fallbackModelsFor(task: AIModelTask, qualityMode: QualityMode, primary?: string) {
  const models =
    task === "highlight_rerank" && qualityMode === "best"
      ? BEST_QUALITY_FALLBACK_MODELS
      : task === "highlight_rerank" && qualityMode === "balanced"
        ? HIGHLIGHT_RERANK_BALANCED_FALLBACK_MODELS
        : ["qwen/qwen3.6-plus"];
  return Array.from(new Set(models.map((model) => normalizePolicyOpenRouterModel(model))))
    .filter((model) => model !== primary);
}

function intentTemperature(qualityMode: QualityMode) {
  if (qualityMode === "fast") return 0.15;
  if (qualityMode === "best") return 0.3;
  return 0.22;
}

function buildPolicy(params: {
  task: AIModelTask;
  qualityMode: QualityMode;
  userPlan: UserPlan;
  primaryModel: string;
  fallbackModels: string[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  costTier: "low" | "medium" | "high";
  reason: string;
}): ModelPolicy {
  return {
    task: params.task,
    qualityMode: params.qualityMode,
    userPlan: params.userPlan,
    provider: "openrouter",
    primaryModel: normalizePolicyOpenRouterModel(params.primaryModel),
    fallbackModels: Array.from(new Set(params.fallbackModels.map((model) => normalizePolicyOpenRouterModel(model))))
      .filter((model) => model !== params.primaryModel),
    maxTokens: params.maxTokens ?? 2200,
    temperature: params.temperature ?? 0.2,
    timeoutMs: params.timeoutMs ?? Number(process.env.OPENROUTER_TIMEOUT_MS ?? 180_000),
    structuredOutputMode: "auto",
    costTier: params.costTier,
    modelSelectionReason: params.reason,
  };
}
