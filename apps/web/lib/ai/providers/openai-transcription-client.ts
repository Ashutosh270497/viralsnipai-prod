import "openai/shims/node";
import OpenAI from "openai";

/**
 * Dedicated OpenAI client for transcription/timing only.
 *
 * Keep this separate from legacy `lib/openai.ts`, which still contains older
 * reasoning/highlight helpers. The V1 provider policy allows OpenAI only for
 * speech-to-text and timestamp precision, so transcription providers should
 * depend on this module instead of general LLM utilities.
 */
export const openAITranscriptionClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
