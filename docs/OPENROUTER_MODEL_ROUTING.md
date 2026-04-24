# OpenRouter Model Routing

Last updated: 2026-04-25

This is the current model-routing baseline for ViralSnipAI. The source of truth in code is `apps/web/lib/openrouter-client.ts`; this document explains why each default is used.

## Source Of Truth

- Runtime registry: `apps/web/lib/openrouter-client.ts`
- V1 highlight selector options: `apps/web/lib/constants/repurpose.ts`
- Complete env reference: `.env.example`
- V1 production env template: `.env.v1.example`

## Current OpenRouter Defaults

| Product task | Env override | Default model | Why |
|---|---|---|---|
| Video/audio ingest metadata | `OPENROUTER_VIDEO_INGEST_MODEL` | `google/gemini-3.1-flash-lite-preview` | Fast, low-cost multimodal model for future direct ingest metadata and extraction. |
| Auto-highlight detection | `OPENROUTER_HIGHLIGHTS_MODEL` | `google/gemini-3.1-pro-preview` | Best fit for long transcript/video reasoning, 1M context, multimodal input, and structured clip JSON. |
| Caption refinement | `OPENROUTER_CAPTIONS_MODEL` | `google/gemini-3.1-flash-lite-preview` | High-volume transform task where speed and cost matter. |
| Hooks | `OPENROUTER_HOOKS_MODEL` | `anthropic/claude-sonnet-4.6` | Strong creative copy quality. |
| Scripts | `OPENROUTER_SCRIPTS_MODEL` | `anthropic/claude-sonnet-4.6` | Strong long-form writing and tone control. |
| Content calendar | `OPENROUTER_CONTENT_CALENDAR_MODEL` | `anthropic/claude-sonnet-4.6` | Multi-step creative planning. |
| Titles | `OPENROUTER_TITLES_MODEL` | `google/gemini-3.1-flash-lite-preview` | Short high-volume copy generation. |
| Imagen prompt rewrite | `OPENROUTER_IMAGEN_PROMPT_MODEL` | `google/gemini-3.1-flash-lite-preview` | Fast structured prompt improvement. |

## Highlight Model Selector

The V1 Create Clip flow now accepts OpenRouter model IDs directly:

- `google/gemini-3.1-pro-preview`
- `google/gemini-3-flash-preview`
- `google/gemini-3.1-flash-lite-preview`
- `openai/gpt-5.3-chat`
- `openai/gpt-5.3-codex`

When one of these IDs is selected, the auto-highlight API sends that exact model to OpenRouter. Older direct Google Gemini model names still route through the direct Google Gemini path when `GOOGLE_GEMINI_API_KEY` is configured.

## Practical Routing Guidance

- Use `google/gemini-3.1-pro-preview` for the default V1 highlight detector because wrong clip timestamps waste user time.
- Use `google/gemini-3-flash-preview` when latency matters but the task still needs multimodal/context reasoning.
- Use `google/gemini-3.1-flash-lite-preview` for ingest metadata, captions, short transforms, reply assist, and high-volume background enrichment.
- Use `anthropic/claude-sonnet-4.6` for polished creative writing, style transfer, hooks, scripts, threads, and template remix.
- Use `openai/gpt-5.3-chat` for premium scoring, prediction, audits, and strategic planning.
- Reserve `openai/gpt-5.3-codex` for expensive deep QA or manual debugging of highlight quality, not as the default production path.

## Current Limitation

The V1 media pipeline still uploads and transcribes video through the existing app media flow. OpenRouter is currently used for transcript/highlight/caption intelligence, not as a direct raw-video ingestion replacement. The `OPENROUTER_VIDEO_INGEST_MODEL` key is in place for future direct multimodal ingest work.
