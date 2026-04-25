/**
 * OpenRouter client — OpenAI-compatible SDK configured for OpenRouter.
 *
 * OpenRouter provides access to 200+ LLMs through a single OpenAI-compatible API.
 * ViralSnipAI routes text/model generation through OpenRouter only.
 *
 * Usage:
 *   import { openRouter, OPENROUTER_MODELS } from '@/lib/openrouter-client';
 *   const res = await openRouter.chat.completions.create({ model: OPENROUTER_MODELS.hooks, messages: [...] });
 *
 * @see https://openrouter.ai/docs
 */

import OpenAI from 'openai';
import { logger } from '@/lib/logger';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const SNIPRADAR_HTTP_REFERER = 'https://snipradar.app';
const SNIPRADAR_X_TITLE = 'SnipRadar';
const OPENROUTER_TIMEOUT_MS = Number.parseInt(process.env.OPENROUTER_TIMEOUT_MS ?? '45000', 10);
const OPENROUTER_MODEL_TIMEOUT_MS = Number.parseInt(process.env.OPENROUTER_MODEL_TIMEOUT_MS ?? '15000', 10);

export const HAS_OPENROUTER_KEY = Boolean(process.env.OPENROUTER_API_KEY);

/**
 * OpenRouter client — drop-in replacement for the OpenAI client.
 * Null when OPENROUTER_API_KEY is not set.
 */
export const openRouterClient = HAS_OPENROUTER_KEY
  ? new OpenAI({
      baseURL: OPENROUTER_BASE_URL,
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': SNIPRADAR_HTTP_REFERER,
        'X-OpenRouter-Title': SNIPRADAR_X_TITLE,
      },
      timeout: Number.isFinite(OPENROUTER_TIMEOUT_MS) ? OPENROUTER_TIMEOUT_MS : 45_000,
      maxRetries: 0,
    })
  : null;

/**
 * Recommended model routing for ViralSnipAI features.
 * Updated April 2026 against OpenRouter's live model catalog.
 * Override any default via the corresponding env var for A/B testing.
 *
 * Selection rationale:
 *   gemini-3.1-pro-preview        — best OpenRouter fit for long transcript/video reasoning and structured highlights.
 *   gemini-3-flash-preview        — balanced multimodal model for fast structured extraction and ingest metadata.
 *   qwen3.6-plus                  — cost-efficient video-capable alternative with long context.
 *   mimo-v2.5                     — native audio/video alternative for media-understanding experiments.
 *   gemini-3.1-flash-lite-preview — high-volume, low-latency transforms, captions, replies, and ingest metadata.
 *   claude-sonnet-4.6             — strongest default for polished creative writing and style transfer.
 *   gpt-5.5                       — premium transcript/file reasoning where correctness matters more than cost.
 */
export const OPENROUTER_MODELS = {
  /**
   * Video ingest analysis — Gemini 2.5 Flash
   * Stable-first transcript metadata extraction for the ingest pipeline.
   */
  videoIngest: process.env.OPENROUTER_VIDEO_INGEST_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * Hook generation — Claude Sonnet 4.6
   * Short creative text (8-14 words). Anthropic frontier creative model.
   */
  hooks: process.env.OPENROUTER_HOOKS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * Script writing — Claude Sonnet 4.6
   * Long-form narrative prose.
   */
  scripts: process.env.OPENROUTER_SCRIPTS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * Highlight / timestamp detection — Gemini 3.1 Pro Preview
   * Best for long transcript/video context and structured JSON reasoning.
   */
  highlights: process.env.OPENROUTER_HIGHLIGHTS_MODEL ?? 'google/gemini-3.1-pro-preview',

  /**
   * Imagen prompt enhancement — Gemini 3.1 Flash Lite Preview
   * Fast prompt rewrite and structured JSON for image-generation prep.
   */
  imagenPrompt: process.env.OPENROUTER_IMAGEN_PROMPT_MODEL ?? 'google/gemini-3.1-flash-lite-preview',

  /**
   * Caption refinement — Gemini 3.1 Flash Lite Preview
   * Low latency structured extraction/translation.
   */
  captions: process.env.OPENROUTER_CAPTIONS_MODEL ?? 'google/gemini-3.1-flash-lite-preview',

  /**
   * Content calendar planning — Claude Sonnet 4.6
   * Complex multi-step planning with frontier reasoning.
   */
  contentCalendar: process.env.OPENROUTER_CONTENT_CALENDAR_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * Title / thumbnail copy — Gemini 3.1 Flash Lite Preview
   * Fast, structured short-copy generation.
   */
  titles: process.env.OPENROUTER_TITLES_MODEL ?? 'google/gemini-3.1-flash-lite-preview',

  /**
   * Thread / X post generation — Claude Sonnet 4.6
   * Structured multi-part output.
   */
  threads: process.env.OPENROUTER_THREADS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * Niche analysis — Gemini 3.1 Flash Lite Preview
   * Fast structured niche recommendation generation.
   */
  nicheAnalysis: process.env.OPENROUTER_NICHE_ANALYSIS_MODEL ?? 'google/gemini-3.1-flash-lite-preview',

  /**
   * SnipRadar browser extension source analysis — Gemini 3 Flash Preview
   * Fast structured extraction from short social posts.
   */
  extensionAnalysis:
    process.env.OPENROUTER_SNIPRADAR_EXTENSION_ANALYSIS_MODEL ?? 'google/gemini-3-flash-preview',

  /**
   * SnipRadar browser extension reply assist — Gemini 3.1 Flash Lite Preview
   * Best cost/quality for short, source-anchored reply variants.
   */
  extensionReply:
    process.env.OPENROUTER_SNIPRADAR_EXTENSION_REPLY_MODEL ?? 'google/gemini-3.1-flash-lite-preview',

  /**
   * SnipRadar browser extension remix assist — Gemini 3 Flash Preview
   * Strong enough for short-form remixes without Sonnet-level pricing.
   */
  extensionRemix:
    process.env.OPENROUTER_SNIPRADAR_EXTENSION_REMIX_MODEL ?? 'google/gemini-3-flash-preview',

  /**
   * SnipRadar Discover viral analysis — Gemini 3 Flash Preview
   * Strong structured reasoning for tweet pattern analysis and viral mechanics.
   */
  snipradarViralAnalysis:
    process.env.OPENROUTER_SNIPRADAR_VIRAL_ANALYSIS_MODEL ?? 'google/gemini-3-flash-preview',

  /**
   * SnipRadar draft generation — Claude Sonnet 4.6
   * Creative high-quality X post generation.
   */
  snipradarDraftGeneration:
    process.env.OPENROUTER_SNIPRADAR_DRAFT_GENERATION_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar tweet prediction — GPT-5.3 Chat
   * Premium reasoning for structured scoring.
   */
  snipradarPrediction:
    process.env.OPENROUTER_SNIPRADAR_PREDICTION_MODEL ?? 'openai/gpt-5.3-chat',

  /**
   * SnipRadar variant generation — Claude Sonnet 4.6
   * Creative reframing and multi-variant ideation.
   */
  snipradarVariantGeneration:
    process.env.OPENROUTER_SNIPRADAR_VARIANT_GENERATION_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar variant scoring — GPT-5.3 Chat
   * Premium structured evaluation of publish-ready alternatives.
   */
  snipradarVariantScoring:
    process.env.OPENROUTER_SNIPRADAR_VARIANT_SCORING_MODEL ?? 'openai/gpt-5.3-chat',

  /**
   * SnipRadar research brief synthesis — Claude Sonnet 4.6
   * High-context synthesis over grouped research evidence.
   */
  snipradarResearchBrief:
    process.env.OPENROUTER_SNIPRADAR_RESEARCH_BRIEF_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar research embeddings — text-embedding-3-small
   * Cheap semantic retrieval embeddings.
   */
  snipradarResearchEmbeddings:
    process.env.OPENROUTER_SNIPRADAR_RESEARCH_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small',

  /**
   * SnipRadar engagement replies — Gemini 3.1 Flash Lite Preview
   * Fast short-form reasoning for multiple reply options.
   */
  snipradarEngagementReplies:
    process.env.OPENROUTER_SNIPRADAR_ENGAGEMENT_REPLIES_MODEL ?? 'google/gemini-3.1-flash-lite-preview',

  /**
   * SnipRadar templates remix — Claude Sonnet 4.6
   * Creative personalization while preserving template structure.
   */
  snipradarTemplatesRemix:
    process.env.OPENROUTER_SNIPRADAR_TEMPLATES_REMIX_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar style analysis — Claude Sonnet 4.6
   * Voice extraction from historical post corpora.
   */
  snipradarStyleAnalysis:
    process.env.OPENROUTER_SNIPRADAR_STYLE_ANALYSIS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar style rewrite — Claude Sonnet 4.6
   * Creative but controlled voice transfer.
   */
  snipradarStyleRewrite:
    process.env.OPENROUTER_SNIPRADAR_STYLE_REWRITE_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar hooks — Claude Sonnet 4.6
   * Creative short-form ideation for high-performing hooks.
   */
  snipradarHooks:
    process.env.OPENROUTER_SNIPRADAR_HOOKS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar threads — Claude Sonnet 4.6
   * Multi-part coherent thread generation.
   */
  snipradarThreads:
    process.env.OPENROUTER_SNIPRADAR_THREADS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar Assistant (RAG chatbot) — Gemini 3 Flash Preview
   * Long-context grounding over KB chunks; 1M context window.
   */
  snipradarAssistant:
    process.env.OPENROUTER_SNIPRADAR_ASSISTANT_MODEL ?? 'google/gemini-3-flash-preview',

  /**
   * SnipRadar Growth Planner — GPT-5.3 Chat
   * Personalized 3-phase X growth roadmap with complex reasoning.
   */
  snipradarGrowthPlanner:
    process.env.OPENROUTER_SNIPRADAR_GROWTH_PLANNER_MODEL ?? 'openai/gpt-5.3-chat',

  /**
   * SnipRadar Winner Loop — Claude Sonnet 4.6
   * Follow-up thread expansions and repost variants.
   */
  snipradarWinnerLoop:
    process.env.OPENROUTER_SNIPRADAR_WINNER_LOOP_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar Growth Coach — GPT-5.3 Chat
   * Weekly performance analysis with data-driven recommendations.
   */
  snipradarGrowthCoach:
    process.env.OPENROUTER_SNIPRADAR_GROWTH_COACH_MODEL ?? 'openai/gpt-5.3-chat',

  /**
   * SnipRadar Inbox Enrichment — Gemini 3.1 Flash Lite Preview
   * Fast structured extraction of title, summary, labels from X captures.
   */
  snipradarInboxEnrichment:
    process.env.OPENROUTER_SNIPRADAR_INBOX_ENRICHMENT_MODEL ?? 'google/gemini-3.1-flash-lite-preview',

  /**
   * SnipRadar Profile Audit — GPT-5.3 Chat
   * Deep profile analysis, bio rewrites, and 7-day execution plans.
   */
  snipradarProfileAudit:
    process.env.OPENROUTER_SNIPRADAR_PROFILE_AUDIT_MODEL ?? 'openai/gpt-5.3-chat',
} as const;

export type OpenRouterModelKey = keyof typeof OPENROUTER_MODELS;

const OPENROUTER_BACKUP_MODELS: Partial<Record<OpenRouterModelKey, string[]>> = {
  videoIngest: [
    'openai/gpt-4o-mini',
    'qwen/qwen3.6-plus',
    'google/gemini-3-flash-preview',
  ],
  highlights: [
    'google/gemini-2.5-pro',
    'qwen/qwen3.6-plus',
    'openai/gpt-5.5',
  ],
  captions: [
    'google/gemini-2.5-flash-lite',
    'qwen/qwen3.6-plus',
  ],
  imagenPrompt: [
    'google/gemini-2.5-flash-lite',
    'qwen/qwen3.6-plus',
  ],
};

export type OpenRouterFailure = {
  model: string;
  status?: number;
  code?: string | number;
  message: string;
  provider?: string;
  metadata?: unknown;
};

export class OpenRouterUpstreamError extends Error {
  readonly feature: OpenRouterModelKey;
  readonly failures: OpenRouterFailure[];

  constructor(feature: OpenRouterModelKey, failures: OpenRouterFailure[]) {
    super(
      `OpenRouter failed for feature "${feature}". All fallback models failed. ` +
        `Failures: ${JSON.stringify(summarizeOpenRouterFailures(failures))}`
    );
    this.name = 'OpenRouterUpstreamError';
    this.feature = feature;
    this.failures = failures;
  }
}

/**
 * Get the active AI client based on feature flags.
 * Priority: OpenRouter only.
 *
 * @param openAIClient - Deprecated; ignored. Kept for compatibility with existing callers.
 * @param feature - Feature key for model routing (used when OpenRouter is active)
 */
export function getActiveClient(
  openAIClient: OpenAI | null,
  feature?: OpenRouterModelKey
): { client: OpenAI | null; model: string | null; provider: 'openrouter' | 'openai' | 'mock' } {
  const useOpenRouter = HAS_OPENROUTER_KEY && openRouterClient !== null;

  if (useOpenRouter && feature) {
    return {
      client: openRouterClient,
      model: OPENROUTER_MODELS[feature],
      provider: 'openrouter',
    };
  }

  // Keep the legacy provider value so older hidden V2/V3 surfaces still type-check,
  // but model generation helpers fail when provider is not OpenRouter.
  return { client: null, model: null, provider: 'mock' };
}

/**
 * Plan-tiered AI model routing for SnipRadar.
 *
 * Free/Starter  → google/gemini-3.1-flash-lite-preview  (fast, low-cost)
 * Creator/Plus  → google/gemini-3-flash-preview          (balanced quality + speed)
 * Studio/Pro    → anthropic/claude-sonnet-4.6            (frontier creative quality)
 *
 * Used for user-facing generative features (draft generation, hooks, threads)
 * where model quality is a plan differentiator.
 */
export function getSnipRadarModelForPlan(planId: string): string {
  if (planId === 'studio' || planId === 'pro') {
    return process.env.OPENROUTER_PLAN_STUDIO_MODEL ??
      process.env.OPENROUTER_PLAN_PRO_MODEL ??
      'anthropic/claude-sonnet-4.6';
  }
  if (planId === 'creator' || planId === 'plus') {
    return process.env.OPENROUTER_PLAN_CREATOR_MODEL ??
      process.env.OPENROUTER_PLAN_PLUS_MODEL ??
      'google/gemini-3-flash-preview';
  }
  return process.env.OPENROUTER_PLAN_STARTER_MODEL ??
    process.env.OPENROUTER_PLAN_FREE_MODEL ??
    'google/gemini-3.1-flash-lite-preview';
}

/**
 * Helper: Make a chat completion through OpenRouter only.
 * Uses chat.completions API (standard OpenAI-compatible endpoint).
 */
export async function routedChatCompletion(
  openAIClient: OpenAI | null,
  feature: OpenRouterModelKey,
  openAIModel: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: { maxTokens?: number; temperature?: number; json?: boolean; disableReasoning?: boolean }
): Promise<string> {
  if (!HAS_OPENROUTER_KEY) {
    throw new Error('OpenRouter is not configured. Set OPENROUTER_API_KEY and OPENROUTER_ENABLED=true.');
  }

  const selectedModel = OPENROUTER_MODELS[feature];
  if (!selectedModel) {
    throw new Error(`No OpenRouter model configured for feature "${feature}".`);
  }

  const candidateModels = getOpenRouterCandidateModels(feature, selectedModel);
  const failures: OpenRouterFailure[] = [];

  for (const candidateModel of candidateModels) {
    const result = await callOpenRouterModelWithTimeout(candidateModel, messages, {
      maxTokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
    });

    if (result.ok) {
      return result.content;
    }

    failures.push(result.failure);
    logger.warn('[OpenRouter] model failed', {
      feature,
      model: result.failure.model,
      status: result.failure.status,
      code: result.failure.code,
      provider: result.failure.provider,
      message: result.failure.message,
    });
  }

  throw new OpenRouterUpstreamError(feature, failures);
}

async function callOpenRouterModelWithTimeout(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: { maxTokens: number; temperature: number }
): Promise<{ ok: true; content: string } | { ok: false; failure: OpenRouterFailure }> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number.isFinite(OPENROUTER_MODEL_TIMEOUT_MS) ? OPENROUTER_MODEL_TIMEOUT_MS : 15_000
  );

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SNIPRADAR_HTTP_REFERER,
        'X-OpenRouter-Title': SNIPRADAR_X_TITLE,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        provider: { allow_fallbacks: true },
        stream: false,
      }),
      signal: controller.signal,
    });

    const parsed = await safeParseOpenRouterJson(response);
    if (!response.ok) {
      return {
        ok: false,
        failure: buildOpenRouterFailure(model, response.status, response.statusText, parsed),
      };
    }

    if (parsed?.error) {
      return {
        ok: false,
        failure: buildOpenRouterFailure(model, response.status, response.statusText, parsed),
      };
    }

    const content = extractOpenRouterContent(parsed);
    if (!content) {
      return {
        ok: false,
        failure: {
          model,
          status: response.status,
          message: parsed === null ? 'OpenRouter returned non-JSON response' : 'Empty response content',
          provider: readProvider(parsed),
          metadata: readProviderMetadata(parsed),
        },
      };
    }

    return { ok: true, content };
  } catch (error) {
    return {
      ok: false,
      failure: {
        model,
        message: error instanceof Error && error.name === 'AbortError'
          ? 'Request timed out'
          : error instanceof Error
            ? error.message
            : 'OpenRouter request failed',
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeParseOpenRouterJson(response: Response): Promise<any | null> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildOpenRouterFailure(
  model: string,
  status: number,
  statusText: string,
  body: any | null
): OpenRouterFailure {
  const error = body?.error;
  return {
    model,
    status,
    code: error?.code,
    message: error?.message ?? statusText ?? 'OpenRouter request failed',
    provider: readProvider(body),
    metadata: error?.metadata ?? readProviderMetadata(body),
  };
}

function readProvider(body: any | null): string | undefined {
  return body?.provider ?? body?.error?.metadata?.provider_name ?? body?.error?.metadata?.provider;
}

function readProviderMetadata(body: any | null): unknown {
  return body?.error?.metadata ?? body?.metadata;
}

export function summarizeOpenRouterFailures(failures: OpenRouterFailure[]) {
  return failures.map((failure) => ({
    model: failure.model,
    status: failure.status,
    code: failure.code,
    message: failure.message,
    provider: failure.provider,
  }));
}

export function getOpenRouterFailureSummary(error: unknown) {
  if (error instanceof OpenRouterUpstreamError) {
    return summarizeOpenRouterFailures(error.failures);
  }

  return undefined;
}

export function getSafeOpenRouterErrorMessage(error: unknown): string {
  if (error instanceof OpenRouterUpstreamError) {
    return (
      `OpenRouter failed for feature "${error.feature}". All fallback models failed. ` +
      `Failures: ${JSON.stringify(summarizeOpenRouterFailures(error.failures))}`
    );
  }

  return error instanceof Error ? error.message : 'OpenRouter request failed';
}

function getOpenRouterCandidateModels(feature: OpenRouterModelKey, primaryModel: string): string[] {
  const fallbacksEnabled = process.env.OPENROUTER_MODEL_FALLBACKS_ENABLED !== 'false';
  if (!fallbacksEnabled) {
    return [primaryModel];
  }

  const featureEnvName = toEnvFeatureName(feature);
  const envFallbacks = splitModelList(process.env[`OPENROUTER_${featureEnvName}_FALLBACK_MODELS`]);
  const globalFallbacks = splitModelList(process.env.OPENROUTER_FALLBACK_MODELS);
  const codedFallbacks = OPENROUTER_BACKUP_MODELS[feature] ?? [];

  return Array.from(new Set([primaryModel, ...envFallbacks, ...codedFallbacks, ...globalFallbacks].filter(Boolean)));
}

function splitModelList(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean)
    : [];
}

function toEnvFeatureName(feature: OpenRouterModelKey): string {
  return feature.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase();
}

export function extractOpenRouterContent(response: unknown): string {
  const choice = (response as any)?.choices?.[0];
  const message = choice?.message;
  const content = message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

export function buildEmptyOpenRouterContentError(model: string, response: unknown): Error {
  const responseError = (response as any)?.error;
  if (responseError) {
    const code = responseError.code ? ` (code: ${responseError.code})` : '';
    const metadata = responseError.metadata ? ` Metadata: ${JSON.stringify(responseError.metadata)}.` : '';
    return new Error(
      `OpenRouter model "${model}" failed: ${responseError.message ?? 'Unknown OpenRouter error'}${code}.${metadata}`
    );
  }

  const choice = (response as any)?.choices?.[0];
  const message = choice?.message;
  const details = {
    finishReason: choice?.finish_reason,
    nativeFinishReason: choice?.native_finish_reason,
    hasReasoning: typeof message?.reasoning === 'string' && message.reasoning.length > 0,
    reasoningLength: typeof message?.reasoning === 'string' ? message.reasoning.length : 0,
    refusal: message?.refusal,
    responseId: (response as any)?.id,
    provider: (response as any)?.provider,
  };

  return new Error(
    `OpenRouter model "${model}" returned no content. ` +
      `Details: ${JSON.stringify(details)}. ` +
      `Check model access, provider availability, and max token settings.`
  );
}
