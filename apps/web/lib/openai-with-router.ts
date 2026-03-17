/**
 * OpenAI + OpenRouter unified interface.
 *
 * This wrapper adds OpenRouter support to hook/script/highlight generation.
 * When OPENROUTER_ENABLED=true AND OPENROUTER_API_KEY is set, requests
 * are routed through OpenRouter instead of OpenAI directly.
 *
 * OpenRouter uses chat.completions (not the Responses API), so we use
 * the standard messages format here.
 */

import OpenAI from 'openai';
import { openRouterClient, OPENROUTER_MODELS, HAS_OPENROUTER_KEY } from './openrouter-client';

// Feature flag — set OPENROUTER_ENABLED=true to enable
const OPENROUTER_ENABLED = process.env.OPENROUTER_ENABLED === 'true';
const USE_OPENROUTER = OPENROUTER_ENABLED && HAS_OPENROUTER_KEY && openRouterClient !== null;

/**
 * Generate hooks via OpenRouter (chat.completions compatible)
 */
export async function generateHooksViaOpenRouter(payload: {
  topic: string;
  sourceUrl?: string;
  audience?: string;
  tone?: string;
}): Promise<string[] | null> {
  if (!USE_OPENROUTER || !openRouterClient) return null;

  try {
    const response = await openRouterClient.chat.completions.create({
      model: OPENROUTER_MODELS.hooks,
      messages: [
        {
          role: 'system',
          content: 'You are Hooksmith, a sharp social strategist. Reply only with compact JSON in the exact shape {"hooks":["hook 1", ...]}. Each hook must be 8-14 words, lead with tension, avoid clichés, and feel distinct. No additional prose, explanations, or markdown.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            topic: payload.topic,
            sourceUrl: payload.sourceUrl,
            audience: payload.audience ?? 'creators',
            tone: payload.tone ?? 'energetic',
          }),
        },
      ],
      max_tokens: 1024,
      temperature: 0.8,
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const cleanText = text.trim().startsWith('{') ? text : (text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    const parsed = JSON.parse(cleanText);
    if (Array.isArray(parsed.hooks) && parsed.hooks.length > 0) {
      return parsed.hooks.slice(0, 10);
    }
  } catch (error) {
    // Log and return null so caller falls back to OpenAI
    console.warn('[OpenRouter] Hook generation failed, falling back to OpenAI:', error instanceof Error ? error.message : error);
  }
  return null;
}

/**
 * Generate script via OpenRouter (chat.completions compatible)
 */
export async function generateScriptViaOpenRouter(payload: {
  hook: string;
  audience?: string;
  tone?: string;
  durationSec?: number;
}): Promise<string | null> {
  if (!USE_OPENROUTER || !openRouterClient) return null;

  try {
    const response = await openRouterClient.chat.completions.create({
      model: OPENROUTER_MODELS.scripts,
      messages: [
        {
          role: 'user',
          content: `Write a ${payload.durationSec ?? 120}-second YouTube Short script in 3 beats (Hook–Value–CTA). Sentences short, spoken tone, timestamp markers optional. End with a crisp CTA. Hook: ${payload.hook}. Audience: ${payload.audience ?? 'creators'}. Tone: ${payload.tone ?? 'energetic'}.`,
        },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.warn('[OpenRouter] Script generation failed, falling back to OpenAI:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Check if OpenRouter is active (for observability/metrics)
 */
export function isOpenRouterActive(): boolean {
  return USE_OPENROUTER;
}

export { OPENROUTER_MODELS, openRouterClient };
