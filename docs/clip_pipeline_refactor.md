# Clip Pipeline Refactor Recall Notes

Last updated: 2026-05-06

Purpose: compact recall document for the 10-phase ViralSnipAI V1 clipping pipeline refactor. This summarizes what changed, why it changed, where the main files live, and what to remember before testing or continuing development.

## Final V1 Architecture

```txt
Video upload / YouTube ingest
  -> prepare media with FFmpeg
  -> OpenAI transcription and word/segment timing
  -> canonical transcript storage
  -> scene detection
  -> local timestamped candidate generation
  -> OpenRouter candidate reranking
  -> local boundary refinement
  -> OpenRouter virality / metadata / creative scoring
  -> clip persistence
  -> preview generation
  -> review / transcript edits / captions / layout / export / publishing
```

Provider rules now enforced:
- OpenAI is only for transcription, timing, word timestamps, segment timestamps, and diarization when needed.
- OpenRouter is only for reasoning, ranking, scoring, metadata, hooks, captions intelligence, social copy, and creative suggestions.
- Local deterministic services own candidate timestamps and final clip boundaries.
- LLM output can select candidate IDs or suggest creative metadata, but it must not create final clip timestamps.
- The active V1 path must not use percentage-based `startPercent` / `endPercent` clipping.

## Phase 1 — Core Clipping Engine Stabilization

Implemented a provider-boundary-first clipping pipeline.

Key changes:
- Added provider policy and separated provider responsibilities.
- Added transcription-only OpenAI provider/client.
- Added OpenRouter reasoning provider with structured JSON validation and fallback behavior.
- Added canonical transcript support with precision metadata.
- Added local candidate generation, OpenRouter reranking, local boundary refinement, and OpenRouter virality scoring.
- Replaced silent duration fallbacks with probe-or-fail behavior.
- Added safer preview failure analytics and concurrency limits.
- Added clip length presets end-to-end: `short`, `balanced`, `detailed`.
- Added global temp media cleanup with `try/finally` in auto-highlights.
- Added long-video transcription chunking by size and duration.
- Added provider boundary guard script.

Important files:
- `apps/web/lib/ai/provider-policy.ts`
- `apps/web/lib/ai/providers/openai-transcription-client.ts`
- `apps/web/lib/ai/providers/openai-transcription-provider.ts`
- `apps/web/lib/ai/providers/openrouter-reasoning-provider.ts`
- `apps/web/lib/domain/services/TranscriptionService.ts`
- `apps/web/lib/domain/services/ClipCandidateGenerationService.ts`
- `apps/web/lib/domain/services/ClipRerankingService.ts`
- `apps/web/lib/domain/services/ClipBoundaryRefinementService.ts`
- `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts`
- `apps/web/lib/repurpose/clip-policy.ts`
- `apps/web/scripts/repurpose-provider-boundary-check.ts`

## Phase 2 — Persistent Clip Review Workflow

Added a professional review queue so clip decisions survive refresh.

Key changes:
- Added persistent clip review status: `needs_review`, `approved`, `rejected`, `export_ready`.
- Added review status API.
- Upgraded editor review queue with status tabs, sort/filter controls, batch actions, and quality metadata.
- Connected export selection to review state so rejected clips are excluded by default.
- Added review/quality indicators for virality, transcript precision, boundary confidence, platform fit, and clip type.

Important files:
- `apps/web/app/api/clips/[id]/review-status/route.ts`
- `apps/web/components/repurpose/quality-indicators.tsx`
- `apps/web/components/repurpose/repurpose-context.tsx`
- `apps/web/app/(workspace)/repurpose/editor/page.tsx`
- `apps/web/app/(workspace)/repurpose/export/page.tsx`

Migration:
- `apps/web/prisma/migrations/20260505120000_add_clip_review_status/`

## Phase 3 — Transcript-Based Editing

Added non-destructive transcript editing foundations.

Key changes:
- Added canonical transcript UI utilities.
- Added word/segment-safe transcript reader functions.
- Added transcript search, filler word detection, and pause detection helpers.
- Added clip edit operation persistence for non-destructive edits.
- Added edit operation APIs for list/create/delete/reset.
- Added transcript selection clip creation route.
- Added word-boundary trim logic without LLM-generated timestamps.

Important files:
- `apps/web/lib/repurpose/transcript-ui.ts`
- `apps/web/components/repurpose/transcript-editor.tsx`
- `apps/web/app/api/clips/[id]/edit-operations/*`
- `apps/web/app/api/repurpose/clips/from-transcript-selection/route.ts`

Migration:
- `apps/web/prisma/migrations/20260505133000_add_clip_edit_operations/`

## Phase 4 — Caption Studio

Added caption styling, cue editing, translation tracks, and render-plan support.

Key changes:
- Added caption style model and presets.
- Added cue-level editing helpers and validation.
- Added AI caption assist routes using OpenRouter while preserving local timing.
- Added translated caption track persistence.
- Added caption style/render-plan integration for preview/export paths.

Important files:
- `apps/web/lib/captions/*`
- `apps/web/app/api/repurpose/captions/*`
- `apps/web/components/repurpose/transcript-editor.tsx`
- `apps/web/lib/srt-utils.ts`
- `apps/web/lib/domain/services/VideoExtractionService.ts`

Migration:
- `apps/web/prisma/migrations/20260505150000_add_caption_translation_tracks/`

## Phase 5 — Reframe / Layout Engine

Added platform layout and crop configuration foundations.

Key changes:
- Added layout presets such as full-screen crop, center crop, speaker focus, split screen, picture-in-picture, square letterbox, and manual crop.
- Added aspect ratio support for `9:16`, `1:1`, `16:9`, `4:5`, and `original`.
- Added auto reframe confidence/reasons and manual crop persistence.
- Updated preview/export render planning to consume layout config.

Important files:
- `apps/web/components/repurpose/framing-panel.tsx`
- `apps/web/lib/repurpose/clip-optimization.ts`
- `apps/web/lib/repurpose/scene-detection.ts`
- `apps/web/lib/domain/services/VideoExtractionService.ts`
- `apps/web/lib/ffmpeg.ts`

## Phase 6 — Export Center

Added async export job architecture and platform-ready export workflow.

Key changes:
- Extended export job persistence with status, progress, phase, platform preset, aspect ratio, captions, layout, output path, and error metadata.
- Added export job create/get/cancel/retry APIs.
- Added platform export presets for Shorts, Reels, TikTok, X, LinkedIn, Square, and Landscape YouTube.
- Added batch export support for selected, approved, and export-ready clips.
- Updated render plan to consume boundaries, edit operations, caption style/track, layout config, aspect ratio, and export preset.

Important files:
- `apps/web/app/api/repurpose/exports/jobs/*`
- `apps/web/app/(workspace)/repurpose/export/page.tsx`
- `apps/web/lib/domain/services/VideoExtractionService.ts`
- `apps/web/lib/ffmpeg.ts`

Migration:
- `apps/web/prisma/migrations/20260505170000_extend_export_jobs/`

## Phase 7 — Creative Enhancements

Added non-destructive enhancement architecture.

Key changes:
- Added clip enhancement persistence for B-roll, overlays, emoji, keyword highlights, CTA cards, sound effects, and music beds.
- Added OpenRouter-backed B-roll and creative suggestion flow where timing is validated locally.
- Added overlay and keyword highlight render-plan support.
- Added basic audio polish options in export/render planning.

Important files:
- `apps/web/app/api/repurpose/enhancements/*`
- `apps/web/lib/repurpose/enhancements.ts`
- `apps/web/lib/ai/providers/openrouter-reasoning-provider.ts`
- `apps/web/lib/domain/services/VideoExtractionService.ts`

Migration:
- `apps/web/prisma/migrations/20260505183000_add_clip_enhancements/`

## Phase 8 — Brand Templates

Added reusable brand template support for creators and agencies.

Key changes:
- Added `BrandTemplate` persistence.
- Added built-in templates such as Minimal Clean, Hormozi Bold, Podcast Pro, Founder/Business, Educational, Gaming/Reaction, and News Explainer.
- Added template management UI and apply actions for current clip, selected clips, and whole project.
- Applied default brand template during auto-highlights when present.
- Stored applied template metadata on generated clips/export plans.

Important files:
- `apps/web/lib/repurpose/brand-templates.ts`
- `apps/web/app/api/brand-templates/*`
- `apps/web/components/brand-kit/brand-template-manager.tsx`
- `apps/web/components/repurpose/brand-template-apply-panel.tsx`
- `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts`

Migration:
- `apps/web/prisma/migrations/20260505200000_add_brand_templates/`

## Phase 9 — Social Publishing Foundation

Added social post drafts, scheduling architecture, share links, and adapter interfaces.

Key changes:
- Added `SocialPost`, `ScheduledPublishJob`, `ShareLink`, and `SocialAccount`.
- Added post composer UI for platform-specific metadata and caption generation.
- Added OpenRouter social copy generation for captions, hashtags, titles, and CTA suggestions.
- Added scheduler adapter interface with working mock adapter and placeholders for YouTube, TikTok, Instagram, X, and LinkedIn.
- Added token-based share/review links with approve flow.
- Added social account foundation without storing plain tokens.

Important files:
- `apps/web/lib/repurpose/social-publishing.ts`
- `apps/web/app/api/repurpose/social/*`
- `apps/web/app/api/repurpose/share-links/*`
- `apps/web/app/share/repurpose/[token]/page.tsx`
- `apps/web/components/repurpose/social-publish-composer.tsx`
- `apps/web/components/repurpose/share-approve-button.tsx`

Migration:
- `apps/web/prisma/migrations/20260505213000_add_social_publishing_foundation/`

## Phase 10 — Platform API and Quality Learning Loop

Added agency/API foundations and quality analytics.

Key changes:
- Added API key model with hash-only storage and one-time raw key display.
- Added public API v1 endpoints for projects, assets, clip generation, jobs, clips, and exports.
- Added workspace/team foundation with roles: owner, admin, editor, reviewer, client.
- Added clip comments, share-link comments, and approval hooks.
- Added clip feedback model for accepted/rejected/edited/exported/published events.
- Added quality analytics aggregation for acceptance rate, manual trim delta, virality, candidate type performance, transcript precision, boundary confidence, preview/export failures, and rejection reasons.
- Added learning-loop placeholders for future scoring personalization.
- Added API documentation and platform QA coverage.

Important files:
- `apps/web/lib/platform/api-keys.ts`
- `apps/web/lib/platform/public-api.ts`
- `apps/web/lib/platform/workspaces.ts`
- `apps/web/lib/repurpose/quality-analytics.ts`
- `apps/web/app/api/settings/api-keys/*`
- `apps/web/app/api/workspaces/*`
- `apps/web/app/api/v1/*`
- `apps/web/app/api/clips/[id]/comments/route.ts`
- `apps/web/app/api/clips/[id]/feedback/route.ts`
- `apps/web/app/api/repurpose/quality/analytics/route.ts`
- `docs/api/VIRALSNIPAI_PUBLIC_API_V1.md`

Migration:
- `apps/web/prisma/migrations/20260505230000_add_platform_api_quality_foundation/`

## Database Migration Recall

Safe command for Supabase/production-like DBs:

```bash
pnpm --filter web exec prisma migrate deploy
pnpm --filter web exec prisma generate
```

Use `migrate deploy`, not `migrate reset`, for a database with existing content. The phase migrations are additive/non-destructive: they add tables, nullable fields, indexes, relations, and defaults. They should not erase existing rows.

Recent phase migrations to remember:
- `20260505120000_add_clip_review_status`
- `20260505133000_add_clip_edit_operations`
- `20260505150000_add_caption_translation_tracks`
- `20260505170000_extend_export_jobs`
- `20260505183000_add_clip_enhancements`
- `20260505200000_add_brand_templates`
- `20260505213000_add_social_publishing_foundation`
- `20260505230000_add_platform_api_quality_foundation`

## Environment Variables

Important V1 provider split:

```bash
# OpenAI timing only
OPENAI_API_KEY=""
OPENAI_TRANSCRIBE_MODEL="whisper-1"
OPENAI_TRANSCRIBE_CHUNK_SECONDS="720"
OPENAI_TRANSCRIBE_TIMEOUT_MS="180000"
OPENAI_TRANSCRIBE_MAX_RETRIES="2"

# OpenRouter reasoning only
OPENROUTER_API_KEY=""
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
OPENROUTER_SITE_URL="http://localhost:3000"
OPENROUTER_APP_NAME="ViralSnipAI"
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
OPENROUTER_MAX_RETRIES="2"

# Social publishing foundation
SOCIAL_PUBLISHER_MODE="mock"
```

Check `.env.example` for the full list.

## Validation Commands

Recommended checks:

```bash
pnpm --filter web exec prisma validate
pnpm --filter web exec prisma generate
pnpm --filter web run repurpose:boundary-check
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web test:unit
pnpm --filter web test
pnpm --filter web run repurpose:smoke
```

Known local caveats from the implementation pass:
- `repurpose:boundary-check` can require escalated shell permissions in the sandbox because `tsx` IPC may fail with `EPERM`.
- Full Playwright tests can fail in the sandbox because Chromium cannot launch due macOS MachPort permissions.
- `repurpose:smoke` requires the web app running on the configured `BASE_URL`; otherwise it fails with `ECONNREFUSED`.
- Some full `test:unit` failures were pre-existing and unrelated to the clipping phases, including billing price expectations, translation route environment issues, stale repository mocks, legacy AIAnalysisService imports, and Jest ESM transform configuration.

## Manual QA Checklist

Core clipping:
- Run migrations and Prisma generate.
- Start the web app.
- Upload or ingest a 3-5 minute video.
- Generate clips with `short`, `balanced`, and `detailed` presets.
- Confirm analytics include provider fields, transcript precision, candidate counts, clip policy, boundary confidence, and preview failures.
- Confirm invalid reasoning model and invalid clip length preset return validation errors.

Review workflow:
- Approve, reject, and mark clips export-ready.
- Refresh the page and confirm statuses persist.
- Confirm rejected clips are hidden from export by default.

Transcript editing:
- Open transcript editor on a word-level transcript.
- Set start/end using transcript words.
- Mark filler words or pauses for removal.
- Create a clip from transcript search.

Captions:
- Apply caption presets.
- Edit/split/merge cues.
- Translate or clean captions using AI assist.
- Confirm timestamps remain monotonic.

Layout/export:
- Change aspect ratio and layout preset.
- Apply manual crop.
- Queue single and batch exports.
- Confirm export status survives refresh.

Social/platform:
- Create a social draft.
- Generate platform-specific caption/hashtags.
- Create a share link and approve from the share page.

API/quality:
- Create and revoke an API key.
- Use public API v1 with the generated key.
- Submit feedback/comment events.
- Review quality analytics aggregation.

## Current Known Limitations

- Public API v1 is a foundation; file/binary upload handling is still minimal and expects existing asset paths or storage references.
- Public clip generation is synchronous in the current API route and may need async job orchestration for long videos.
- Social publishing uses a working mock adapter; real social network adapters are placeholders until OAuth/token infrastructure is production-ready.
- Workspace support is foundational; deeper UI and permission coverage can be expanded later.
- Creative enhancement and B-roll support are render-plan oriented first; complete asset marketplace/search integration is still future work.
- Existing unrelated test debt should be cleaned before treating full test suite failure as a release blocker.
