/**
 * OpenRouter client — OpenAI-compatible SDK configured for OpenRouter.
 *
 * OpenRouter provides access to 200+ LLMs through a single OpenAI-compatible API.
 * Migrate AI calls here to reduce costs by ~35% and enable model fallbacks.
 *
 * Usage:
 *   import { openRouter, OPENROUTER_MODELS } from '@/lib/openrouter-client';
 *   const res = await openRouter.chat.completions.create({ model: OPENROUTER_MODELS.hooks, messages: [...] });
 *
 * @see https://openrouter.ai/docs
 */

import OpenAI from 'openai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const SNIPRADAR_HTTP_REFERER = 'https://snipradar.app';
const SNIPRADAR_X_TITLE = 'SnipRadar';

export const HAS_OPENROUTER_KEY = Boolean(process.env.OPENROUTER_API_KEY);

/**
 * OpenRouter client — drop-in replacement for the OpenAI client.
 * Null when OPENROUTER_API_KEY is not set (falls back to OpenAI or mock).
 */
export const openRouterClient = HAS_OPENROUTER_KEY
  ? new OpenAI({
      baseURL: OPENROUTER_BASE_URL,
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': SNIPRADAR_HTTP_REFERER,
        'X-Title': SNIPRADAR_X_TITLE,
      },
      timeout: 60_000, // 60 second timeout
      maxRetries: 2,
    })
  : null;

/**
 * Recommended model routing for ViralSnipAI features.
 * Updated March 2026 — benchmarked against OpenRouter's live model catalog.
 * Override any default via the corresponding env var for A/B testing.
 *
 * Selection rationale:
 *   claude-sonnet-4.6  — frontier creative quality, 200K ctx, ~$3/$15 per 1M — default for prose/creative tasks
 *   gemini-2.5-flash   — 1M ctx window (ideal for long transcripts), best structured JSON, ~$0.15/$0.60 per 1M
 *   gemini-2.5-flash-lite — ultra-low latency, cheapest tier, sufficient for short-text tasks
 */
export const OPENROUTER_MODELS = {
  /**
   * Hook generation — Claude Sonnet 4.6
   * Short creative text (8-14 words). Sonnet 4.6 is Anthropic's frontier creative model
   * at a fraction of Opus pricing. Replaces the older claude-3.5-sonnet.
   */
  hooks: process.env.OPENROUTER_HOOKS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * Script writing — Claude Sonnet 4.6
   * Long-form narrative prose. Opus 4.6 ($5/$25 per 1M) is overkill for scripts;
   * Sonnet 4.6 matches quality at ~3x lower cost. Replaces claude-opus-4.
   */
  scripts: process.env.OPENROUTER_SCRIPTS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * Highlight / timestamp detection — Gemini 2.5 Flash
   * Best choice for transcript analysis: 1M token context window eliminates truncation
   * on long videos, excellent structured JSON reliability, and significantly cheaper
   * than Claude. Replaces claude-3.5-sonnet.
   */
  highlights: process.env.OPENROUTER_HIGHLIGHTS_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * Imagen prompt enhancement — Gemini 2.5 Flash
   * Same Gemini family as the Imagen models — best prompt understanding.
   * Two generations newer than the previous gemini-2.0-flash-001.
   */
  imagenPrompt: process.env.OPENROUTER_IMAGEN_PROMPT_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * Caption refinement — Gemini 2.5 Flash Lite
   * Ultra-low latency and cheapest tier — sufficient for short caption text.
   * Replaces gpt-4o-mini.
   */
  captions: process.env.OPENROUTER_CAPTIONS_MODEL ?? 'google/gemini-2.5-flash-lite',

  /**
   * Content calendar planning — Claude Sonnet 4.6
   * Complex multi-step planning benefits from frontier reasoning.
   * Replaces claude-3.5-sonnet.
   */
  contentCalendar: process.env.OPENROUTER_CONTENT_CALENDAR_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * Title / thumbnail copy — Gemini 2.5 Flash Lite
   * Same speed tier as gpt-4o-mini, cheaper, sufficient for short title generation.
   */
  titles: process.env.OPENROUTER_TITLES_MODEL ?? 'google/gemini-2.5-flash-lite',

  /**
   * Thread / X post generation — Claude Sonnet 4.6
   * Structured multi-part output needs current frontier model.
   * Replaces claude-3.5-sonnet.
   */
  threads: process.env.OPENROUTER_THREADS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar browser extension source analysis — Gemini 2.5 Flash
   * Best fit for fast structured extraction from short social posts.
   */
  extensionAnalysis:
    process.env.OPENROUTER_SNIPRADAR_EXTENSION_ANALYSIS_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * SnipRadar browser extension reply assist — Gemini 2.5 Flash
   * Best cost / quality balance for short, source-anchored reply variants.
   */
  extensionReply:
    process.env.OPENROUTER_SNIPRADAR_EXTENSION_REPLY_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * SnipRadar browser extension remix assist — Gemini 2.5 Flash
   * Strong enough for short-form remixes without Sonnet-level pricing.
   */
  extensionRemix:
    process.env.OPENROUTER_SNIPRADAR_EXTENSION_REMIX_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * SnipRadar Discover viral analysis — Gemini 2.5 Flash
   * Strong structured reasoning for tweet pattern analysis and viral mechanics.
   */
  snipradarViralAnalysis:
    process.env.OPENROUTER_SNIPRADAR_VIRAL_ANALYSIS_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * SnipRadar draft generation — Claude Sonnet 4.6
   * Best fit for creative high-quality X post generation.
   */
  snipradarDraftGeneration:
    process.env.OPENROUTER_SNIPRADAR_DRAFT_GENERATION_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar tweet prediction — GPT-4.1 Mini
   * Fast reasoning and robust structured scoring for predictor use cases.
   */
  snipradarPrediction:
    process.env.OPENROUTER_SNIPRADAR_PREDICTION_MODEL ?? 'openai/gpt-4.1-mini',

  /**
   * SnipRadar variant generation — Claude Sonnet 4.6
   * Creative reframing and multi-variant ideation.
   */
  snipradarVariantGeneration:
    process.env.OPENROUTER_SNIPRADAR_VARIANT_GENERATION_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar variant scoring — GPT-4.1 Mini
   * Fast structured evaluation of publish-ready alternatives.
   */
  snipradarVariantScoring:
    process.env.OPENROUTER_SNIPRADAR_VARIANT_SCORING_MODEL ?? 'openai/gpt-4.1-mini',

  /**
   * SnipRadar research brief synthesis — Claude Sonnet 4.6
   * High-context synthesis over grouped research evidence.
   */
  snipradarResearchBrief:
    process.env.OPENROUTER_SNIPRADAR_RESEARCH_BRIEF_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar research embeddings — text-embedding-3-small
   * Cheap semantic retrieval embeddings with a dedicated embeddings endpoint.
   */
  snipradarResearchEmbeddings:
    process.env.OPENROUTER_SNIPRADAR_RESEARCH_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small',

  /**
   * SnipRadar engagement replies — GPT-4.1 Mini
   * Fast short-form reasoning for multiple reply options.
   */
  snipradarEngagementReplies:
    process.env.OPENROUTER_SNIPRADAR_ENGAGEMENT_REPLIES_MODEL ?? 'openai/gpt-4.1-mini',

  /**
   * SnipRadar templates remix — Claude Sonnet 4.6
   * Creative personalization while preserving proven template structure.
   */
  snipradarTemplatesRemix:
    process.env.OPENROUTER_SNIPRADAR_TEMPLATES_REMIX_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar style analysis — Claude Sonnet 4.6
   * Stronger voice extraction from historical post corpora.
   */
  snipradarStyleAnalysis:
    process.env.OPENROUTER_SNIPRADAR_STYLE_ANALYSIS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar style rewrite — Claude Sonnet 4.6
   * Creative but controlled voice transfer for rewrite flows.
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
   * Multi-part coherent thread generation with stronger creative control.
   */
  snipradarThreads:
    process.env.OPENROUTER_SNIPRADAR_THREADS_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar Assistant (RAG chatbot) — Gemini 2.5 Flash
   * Long-context grounding over KB chunks; structured, conversational answers.
   * Gemini 2.5 Flash's 1M context window ensures we never truncate retrieved chunks.
   */
  snipradarAssistant:
    process.env.OPENROUTER_SNIPRADAR_ASSISTANT_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * SnipRadar Growth Planner — Claude Sonnet 4.6
   * Personalized 3-phase X growth roadmap requiring complex multi-step reasoning
   * over account state, niche, and 30-day analytics. Frontier quality needed.
   */
  snipradarGrowthPlanner:
    process.env.OPENROUTER_SNIPRADAR_GROWTH_PLANNER_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar Winner Loop — Claude Sonnet 4.6
   * Generates follow-up thread expansions and repost variants from winning posts.
   * Creative generation needs reliable multi-step output quality.
   */
  snipradarWinnerLoop:
    process.env.OPENROUTER_SNIPRADAR_WINNER_LOOP_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar Growth Coach — Claude Sonnet 4.6
   * Weekly performance analysis with specific, data-driven recommendations.
   * Needs strong reasoning over engagement data patterns.
   */
  snipradarGrowthCoach:
    process.env.OPENROUTER_SNIPRADAR_GROWTH_COACH_MODEL ?? 'anthropic/claude-sonnet-4.6',

  /**
   * SnipRadar Inbox Enrichment — Gemini 2.5 Flash
   * Fast structured extraction of title, summary, labels from short X captures.
   * Speed and cost matter more than frontier quality for this background task.
   */
  snipradarInboxEnrichment:
    process.env.OPENROUTER_SNIPRADAR_INBOX_ENRICHMENT_MODEL ?? 'google/gemini-2.5-flash',

  /**
   * SnipRadar Profile Audit — Claude Sonnet 4.6
   * Deep profile analysis, bio rewrites, and 7-day execution plans.
   * High-signal output requires frontier reasoning and creative quality.
   */
  snipradarProfileAudit:
    process.env.OPENROUTER_SNIPRADAR_PROFILE_AUDIT_MODEL ?? 'anthropic/claude-sonnet-4.6',
} as const;

export type OpenRouterModelKey = keyof typeof OPENROUTER_MODELS;

/**
 * Get the active AI client based on feature flags.
 * Priority: OpenRouter → OpenAI → null (mock mode)
 *
 * @param openAIClient - Fallback OpenAI client
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

  if (openAIClient) {
    return {
      client: openAIClient,
      model: null, // caller uses their default model
      provider: 'openai',
    };
  }

  return { client: null, model: null, provider: 'mock' };
}

/**
 * Helper: Make a chat completion with automatic OpenRouter/OpenAI routing.
 * Uses chat.completions API (standard OpenAI-compatible endpoint).
 *
 * Note: The current openai.ts uses the `responses` API (Responses API).
 * OpenRouter does NOT support the Responses API — it only supports chat.completions.
 * This helper uses chat.completions which is compatible with both.
 */
export async function routedChatCompletion(
  openAIClient: OpenAI | null,
  feature: OpenRouterModelKey,
  openAIModel: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const { client, model, provider } = getActiveClient(openAIClient, feature);

  if (!client) {
    throw new Error('No AI provider configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY.');
  }

  const selectedModel = model ?? openAIModel;

  const response = await client.chat.completions.create({
    model: selectedModel,
    messages,
    max_tokens: options?.maxTokens ?? 2048,
    temperature: options?.temperature ?? 0.7,
  });

  const content = response.choices[0]?.message?.content ?? '';
  return content;
}
