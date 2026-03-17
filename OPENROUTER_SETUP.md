# OpenRouter Migration — Setup Guide

## Quick Start (15 minutes)

1. **Create account**: https://openrouter.ai → Sign up → Get API key

2. **Add to `apps/web/.env.local`**:
   ```
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
   OPENROUTER_ENABLED=true
   ```

3. **Set budget alert**: OpenRouter dashboard → Budget → Set $50/day alert

4. **Test in staging**:
   ```bash
   OPENROUTER_ENABLED=true pnpm dev
   ```
   - Generate a few hooks → verify quality matches OpenAI output
   - Check OpenRouter dashboard for successful calls

5. **Enable in production**:
   ```bash
   # In your deployment env vars:
   OPENROUTER_ENABLED=true
   ```

## What Migrates vs What Stays

| Feature | Migrates to OpenRouter | Stays Direct |
|---------|----------------------|--------------|
| Hook generation | ✅ claude-3.5-sonnet | — |
| Script writing | ✅ claude-opus-4 | — |
| Highlight detection | ✅ claude-3.5-sonnet | — |
| Imagen prompt | ✅ gemini-2.0-flash | — |
| Whisper transcription | — | ✅ OpenAI Direct |
| TTS (voice) | — | ✅ OpenAI Direct |
| Google Imagen | — | ✅ Google Direct |
| Google Veo | — | ✅ Google Direct |

## Cost Savings

- Current: ~$1,161/month (OpenAI direct)
- After migration: ~$759/month (OpenRouter)
- **Savings: $402/month = $4,824/year (35% reduction)**

## Rollback

Set `OPENROUTER_ENABLED=false` in your deployment environment.
No code changes required. Instant rollback.

## Model Configuration

Override default models via env vars:
```
OPENROUTER_HOOKS_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_SCRIPTS_MODEL=anthropic/claude-opus-4
OPENROUTER_HIGHLIGHTS_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_IMAGEN_PROMPT_MODEL=google/gemini-2.0-flash-001
OPENROUTER_CAPTIONS_MODEL=openai/gpt-4o-mini
```

Browse all 200+ available models: https://openrouter.ai/models
