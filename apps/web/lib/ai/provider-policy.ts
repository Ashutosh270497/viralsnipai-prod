/**
 * Provider boundary policy for the V1 precision clipping pipeline.
 *
 * OpenAI is used only where timestamp precision is required: speech-to-text,
 * word timestamps, segment timestamps, and optional diarization.
 *
 * OpenRouter is used only for reasoning, creativity, model routing, ranking,
 * metadata, captions, and structured intelligence.
 *
 * No provider should violate these boundaries. In particular:
 * - OpenRouter must never create final clip timestamps.
 * - OpenAI must never be used for general repurpose reasoning tasks.
 * - Final clip boundaries come from transcript timings, scene cuts, and local
 *   deterministic refinement.
 */
export const PROVIDER_POLICY = {
  transcription: "openai",
  diarization: "openai",
  candidateGeneration: "local",
  boundaryRefinement: "local",
  candidateReranking: "openrouter",
  viralityScoring: "openrouter",
  titleHookGeneration: "openrouter",
  captionCleanup: "openrouter",
  rendering: "local_ffmpeg",
} as const;

export type ProviderPolicy = typeof PROVIDER_POLICY;
