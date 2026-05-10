# OpenRouter Model Routing

Last updated: 2026-05-10

The source of truth is `apps/web/lib/ai/model-policy.ts`. Normal users do not select raw model IDs. The product exposes simple controls:

- Clipping Quality: `fast`, `balanced`, `best`
- Clip Intent: `auto`, `viral_hooks`, `educational`, `contrarian`, `story`, `product_demo`, `funny`, `quotes`

Developer/admin model override is allowed only through debug paths.

## Provider Boundary

- OpenAI is used for transcription, timing, and word timestamps.
- OpenRouter is used for reasoning, ranking, scoring, metadata, captions, and prompt suggestions.
- Local deterministic code owns candidate timestamps and final clip boundaries.
- LLM output can select/rank known candidate IDs, but it must not create final clip timestamps.

## Current Defaults

| Task | Quality | Primary model | Fallbacks |
|---|---|---|---|
| Highlight rerank | Fast | `google/gemini-3-flash-preview` | `qwen/qwen3.6-plus` |
| Highlight rerank | Balanced | `google/gemini-3-flash-preview` | `anthropic/claude-sonnet-4.6`, `qwen/qwen3.6-plus` |
| Highlight rerank | Best | `anthropic/claude-sonnet-4.6` | `google/gemini-3-flash-preview`, `qwen/qwen3.6-plus` |
| Virality score | Fast/Balanced | `google/gemini-3.1-flash-lite-preview` | `google/gemini-3-flash-preview`, `qwen/qwen3.6-plus` |
| Virality score | Best | `anthropic/claude-sonnet-4.6` | `google/gemini-3-flash-preview`, `qwen/qwen3.6-plus` |
| Clip metadata | Fast/Balanced | `google/gemini-3.1-flash-lite-preview` | `google/gemini-3-flash-preview`, `qwen/qwen3.6-plus` |
| Clip metadata | Best | `anthropic/claude-sonnet-4.6` | `google/gemini-3-flash-preview`, `qwen/qwen3.6-plus` |
| Prompt goal suggestions | Fast | `google/gemini-3-flash-preview` | `qwen/qwen3.6-plus` |
| Prompt goal suggestions | Balanced | `openai/gpt-5.2` | `qwen/qwen3.6-plus` |
| Prompt goal suggestions | Best | `anthropic/claude-sonnet-4.6` | `qwen/qwen3.6-plus` |
| Caption cleanup/translate | All | `google/gemini-3.1-flash-lite-preview` | `google/gemini-3-flash-preview`, `qwen/qwen3.6-plus` |

## Environment Overrides

The defaults above can be overridden by environment variables:

```bash
OPENROUTER_FAST_MODEL="google/gemini-3-flash-preview"
OPENROUTER_HIGHLIGHT_RERANK_MODEL="google/gemini-3-flash-preview"
OPENROUTER_BEST_RERANK_MODEL="anthropic/claude-sonnet-4.6"
OPENROUTER_VIRALITY_MODEL="google/gemini-3.1-flash-lite-preview"
OPENROUTER_METADATA_MODEL="google/gemini-3.1-flash-lite-preview"
OPENROUTER_CAPTION_MODEL="google/gemini-3.1-flash-lite-preview"
OPENROUTER_PROMPT_GENERATOR_MODEL="openai/gpt-5.2"
OPENROUTER_PROMPT_GENERATOR_FALLBACK_MODELS="qwen/qwen3.6-plus"
OPENROUTER_PROMPT_GENERATOR_TIMEOUT_MS="90000"
OPENROUTER_TIMEOUT_MS="180000"
```

Local `.env.local` values can change runtime behavior. When debugging model selection, check analytics fields emitted by the clip-generation route.

## Reranking Reliability

Highlight reranking uses this fallback sequence:

1. Try the primary model with structured output.
2. Retry the same model with a less strict JSON mode when needed.
3. Try fallback models.
4. Fall back to deterministic local ranking if all models fail.

The deterministic fallback scores local candidates using transcript hooks, claims, question-answer structure, duration fit, boundary quality, filler density, scene alignment, and clip diversity.
