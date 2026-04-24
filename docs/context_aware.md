# ViralSnipAI Context-Aware Product Baseline

Last scanned: 2026-04-25  
Repository: `clippers` pnpm monorepo  
Primary app: `apps/web`  
Purpose of this file: shared working context for future product and engineering work.

## Executive Summary

ViralSnipAI is a creator-growth SaaS built as a modular Next.js application. The product is organized into three launch bands across two product ecosystems:

1. **V1 Core Video Repurposing**: the current launch focus. It covers landing, auth, onboarding, dashboard, projects, video upload, AI clip detection, captions, brand kit, exports/downloads, billing, settings, and basic usage limits.
2. **V2 Creator Growth**: hook generation, platform captions, ranking, calendar, titles, thumbnails, keyword research, and basic creator analytics. These features exist or are partially scaffolded but are hidden by default.
3. **V3 Automation OS**: SnipRadar, X automation, scheduling, competitor tracking, CRM, API/webhooks, Imagen, Veo, voice cloning, advanced analytics, and advanced automation. These remain in the codebase and are hidden by default.

The codebase is a modular monolith: Next.js App Router for UI/API, Prisma for persistence, TanStack Query for client data orchestration, Inngest for scheduled/background product jobs, and an in-memory `@clippers/jobs` queue for transitional media processing.

Current repository state:

- The Prisma datasource is PostgreSQL and the production target is Supabase.
- The Prisma schema currently contains 62 models.
- Production setup is documented for the V1 core video-repurposing launch in `docs/PRODUCTION_SETUP.md`.
- `.env.v1.example` is the minimal production-launch env template; `.env.example` is the complete reference.

## Current Launch Posture

- **V1 video repurposing is now the default launch direction.** `NEXT_PUBLIC_V1_CORE_ENABLED=true` exposes the core ViralSnipAI workspace by default.
- **V2 creator growth is default-off.** `NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED=false` hides content calendar, title generation, thumbnail ideas, keyword research, and related creator-growth surfaces.
- **V3 automation OS is default-off.** `NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED=false` hides SnipRadar, X automation, scheduling, CRM, API/webhooks, Imagen, Veo, voice cloning, and advanced automation.
- **Production UI is intentionally V1-only unless flags are enabled.** The default sidebar shows Dashboard, Projects, Create Clip, Exports, Brand Kit, Billing, and Settings.
- **Disabled V2/V3 direct routes should not be treated as launch entry points.** Route gating redirects hidden ecosystem surfaces back to the V1 dashboard instead of exposing the module in navigation.
- **Production deployment docs target Supabase PostgreSQL, Inngest, Razorpay, OpenRouter, and Coolify/VPS.**
- **V1 production setup has a dedicated guide.** `docs/PRODUCTION_SETUP.md` documents Supabase PostgreSQL, NextAuth, Supabase/S3 storage, OpenRouter, OpenAI, Razorpay, Inngest, Vercel, Coolify/VPS, FFmpeg, and a production checklist.
- **V1 env template exists.** `.env.v1.example` keeps V1 launch flags on, V2/V3 flags off, storage set to S3, and Razorpay plan IDs scoped to starter/creator/studio.
- **Local Docker Compose is stale for current DB reality**: it still starts MySQL, while `apps/web/prisma/schema.prisma` uses PostgreSQL and docs/env point to Supabase.

Latest launch-split implementation:

- Central launch flag config lives at `apps/web/config/features.ts`.
- Legacy feature-flag helpers now resolve through the central launch-version config where relevant.
- `.env.example` contains the launch flags and individual V2/V3 module flags.
- `docs/LAUNCH_VERSIONS.md` is the dedicated launch-scope reference.
- README and root app metadata now position the product as: "ViralSnipAI turns long videos into viral-ready short clips with AI hooks, captions, and branded exports."
- A minimal workspace Settings route now exists so the V1 sidebar resolves cleanly.

## Monorepo Layout

```text
clippers/
├── apps/
│   ├── web/                  # Main Next.js 14 app
│   │   ├── app/              # App Router pages and API route handlers
│   │   ├── components/       # Feature and UI components
│   │   ├── hooks/            # React hooks
│   │   ├── lib/              # Business logic, services, integrations, queues
│   │   ├── prisma/           # Prisma schema, migrations, seed
│   │   ├── styles/           # Global styles and tokens
│   │   └── tests/            # Playwright E2E tests
│   └── browser-extension/    # Manifest V3 SnipRadar extension
├── packages/
│   ├── jobs/                 # In-memory render/job queue
│   └── types/                # Shared types and export presets
├── docs/                     # Product, architecture, launch, and planning docs
└── package.json              # pnpm workspace scripts
```

## Tech Stack

- **Framework**: Next.js 14.2.3 App Router, React 18, TypeScript.
- **Package manager**: root `package.json` declares `pnpm@8.15.4`; production docs currently ask for pnpm 9 or later.
- **Styling/UI**: Tailwind CSS, shadcn/Radix primitives, lucide-react icons, custom tokens in `apps/web/styles`.
- **Database**: Prisma ORM with PostgreSQL provider in the live schema. Supabase is the production target in docs/env.
- **Auth**: NextAuth v4 JWT strategy with Google OAuth, credentials login, and development-only demo login.
- **State/data fetching**: TanStack Query v5, React Context for cross-route workflows.
- **Background jobs**: Inngest for product jobs and cron; `@clippers/jobs` in-memory queue for media render/ingest/voice translation.
- **AI providers**: OpenRouter-first routing for most text/transcript intelligence flows, direct OpenAI for Whisper/TTS/DALL-E-compatible flows, Google Gemini/Imagen/Veo, ElevenLabs for voice features.
- **OpenRouter model routing**: `apps/web/lib/openrouter-client.ts` is the source of truth; rationale is documented in `docs/OPENROUTER_MODEL_ROUTING.md`.
- **Media**: FFmpeg/ffprobe through `ffmpeg-static`, `ffprobe-static`, or env overrides.
- **Storage**: local disk or S3 via `apps/web/lib/storage.ts`; Supabase Storage helper for generated images.
- **Billing**: Razorpay subscription/checkout/webhooks; legacy Stripe fields remain in schema as placeholders.
- **Testing**: Jest unit tests, Playwright E2E/smoke, targeted smoke scripts for SnipRadar and RepurposeOS.

## Architecture

The app follows a partial Clean Architecture pattern:

```text
Presentation Layer
  app/, components/, route handlers
        |
Application Layer
  lib/application/use-cases/
        |
Domain Layer
  lib/domain/services, value-objects, repositories
        |
Infrastructure Layer
  lib/infrastructure/repositories, services, DI container
```

Important architectural patterns:

- **App Router route handlers** under `apps/web/app/api/**`.
- **Use cases** for complex workflows such as auto-highlights, clip updates, caption generation, export queueing, transcript translation, YouTube ingest, and composite clips.
- **Repository interfaces** in `lib/domain/repositories` with Prisma implementations in `lib/infrastructure/repositories`.
- **Inversify DI** in `lib/infrastructure/di`.
- **Standard API response builder** exists in `lib/api/response.ts`, though not every route necessarily uses it consistently.
- **Launch feature flags** are centralized in `config/features.ts`. Compatibility helpers still exist in `lib/feature-flags.ts` and metadata remains in `lib/feature-flag-registry.ts`.
- **Instrumentation hook** validates env, registers graceful shutdown, and recovers stalled exports at Node runtime startup.

## Product Ecosystem Model

The selected ecosystem is stored in cookie `clippers_ecosystem`.

- `x`: routes users to `/snipradar/overview`.
- `youtube`: routes users to `/dashboard`.

`apps/web/components/layout/ecosystem-route-gate.tsx` prevents users from navigating into the wrong ecosystem. Global routes like `/settings` and `/activity` are allowed in both.

The ecosystem selector lives at `/ecosystem/select`. The core ViralSnipAI video workspace is the default V1 entry. SnipRadar/Automation OS only appears when the V3 automation flag or its individual SnipRadar override is enabled.

If a user has an old `x` ecosystem cookie while SnipRadar is disabled, the workspace falls back to the YouTube/V1 ecosystem. The ecosystem API also rejects selecting `x` unless SnipRadar is enabled.

## SnipRadar / X Growth Platform

SnipRadar is a broad V3 automation surface. It remains in the codebase, but is hidden by default for the V1 launch.

### Navigation

- `/snipradar/assistant`: AI assistant surface.
- `/snipradar/overview`: hub, stats, growth coach, activation state.
- `/snipradar/discover` and `/snipradar/discover/[tab]`: tracker, viral feed, engagement discovery.
- `/snipradar/inbox`: research captures from browser extension.
- `/snipradar/relationships`: CRM/relationship graph, gated by `RELATIONSHIPS_CRM_ENABLED`.
- `/snipradar/create` and `/snipradar/create/[tab]`: drafts, research, predictor, templates, style, threads, hooks.
- `/snipradar/publish` and `/snipradar/publish/[tab]`: scheduler, calendar, best times, automations, API/webhooks.
- `/snipradar/analytics`: post performance, engagement, patterns, follower growth.
- `/snipradar/growth-planner`: AI growth plan and fullscreen mode.

### Implemented Capabilities

- X account connection through OAuth callback at `/api/snipradar/callback`.
- X account summary, auth recovery state, stats, counts, and activation in `/api/snipradar`.
- Track accounts and fetch/analyze viral tweets.
- AI analysis of viral tweet patterns.
- Draft creation, editing, prediction, variants, rewrite/remix, scheduling, posting.
- Thread generation, posting, and scheduling routes.
- Hook generation and template library.
- Style profile training.
- Research Copilot and research indexing.
- Engagement opportunities and bulk status changes.
- Scheduler diagnostics, scheduled run tracking, best-time recommendations.
- Growth coach and profile audit.
- Research inbox with extension capture, labels, notes, reply assist, remix, bulk actions, and hard delete.
- Relationship leads/interactions model and routes.
- Auto-DM automation routes and worker hooks, gated by feature flag.
- Developer API keys, public API routes, and webhooks, gated by feature flag.
- Assistant/RAG session and KB chunk models/routes.

### Browser Extension

The Manifest V3 extension in `apps/browser-extension`:

- Injects SnipRadar controls into X/Twitter pages.
- Adds a floating launcher on profile pages.
- Saves tweets, threads, and profiles to SnipRadar Research Inbox.
- Generates reply assists and remixes through web APIs.
- Can add authors to tracked accounts.
- Reuses the authenticated SnipRadar web session.

### SnipRadar Background Jobs

Inngest jobs in `apps/web/lib/inngest/functions.ts` include:

- `snipRadarFetchViral`: every 6 hours, fetches viral tweets from tracked accounts.
- `snipRadarAnalyze`: triggered after fetch to analyze viral tweets.
- `snipRadarDailyDrafts`: daily draft generation.
- `snipRadarGrowthSnapshot`: daily X account snapshots.
- `snipRadarPostMetrics`: fetch post metrics 24 hours after posting.
- `snipRadarPostScheduled`: every minute, dispatches due scheduled drafts by user.
- `snipRadarPostScheduledPerUser`: posts due drafts and processes Auto-DM per user.
- `snipRadarMaintenanceCron`: every 2 hours, repairs/hydrates metrics and stale state.

## YouTube Creator Platform

The YouTube platform contains the V1 video repurposing workflow plus broader V2 creator-growth modules. V1 routes are visible by default; V2 routes are hidden until the creator-growth feature group or individual feature flags are enabled.

### Navigation

Visible in V1:

- `/dashboard`: overview and activation.
- `/projects`, `/projects/[id]`: video project management.
- `/repurpose`, `/repurpose/editor`, `/repurpose/export`: Create Clip workflow.
- `/brand-kit`: brand settings, logo, captions, watermark.
- `/billing`: subscription and plan management.
- `/settings`: workspace settings.

Hidden by V2/V3 launch flags:

- `/niche-discovery`: niche quiz and scored niche cards.
- `/keywords`: keyword research, saved keywords, recommendations, history.
- `/competitors`: YouTube competitor channel tracking and sync.
- `/dashboard/content-calendar`: AI content calendars and ideas.
- `/dashboard/script-generator`: script generation/editor.
- `/dashboard/title-generator`: title suggestions and saved history.
- `/dashboard/thumbnail-generator`: thumbnail generation workspace.
- `/hooksmith`: hook generation and script seeding.
- `/transcribe`: manual transcription.
- `/imagen`: image generation.
- `/video`: video lab/Sora placeholder.
- `/voicer`: voice workspace.
- `/veo`: Google Veo video generation.

### Implemented Capabilities

- Creator onboarding and selected niche stored on `User`.
- Niche discovery with AI analysis/select APIs.
- Keyword research provider architecture:
  - YouTube discovery/autocomplete.
  - DataForSEO demand/trend providers.
  - Proxy/heuristic providers.
  - Runtime metrics, search queue, limits, saved keywords.
- Competitor tracking:
  - Add/search YouTube channels.
  - Sync competitors through Inngest.
  - Channel analytics, videos, alerts.
- Content calendar:
  - Generate calendars/ideas.
  - Auto-schedule.
  - Regenerate/edit/delete ideas.
  - Export helpers for calendar/script formats.
- Script generator:
  - Structured script records.
  - Rich editor components.
  - AI generation, revision, section regeneration.
  - Versions, comments, share links.
  - Script TTS via OpenAI audio.
- Title generator:
  - Batches of scored/generated titles.
  - Favorite/primary status and history.
- Thumbnail generator:
  - Prompted generation and persisted image records.
  - Provider docs mention DALL-E/Imagen transition.
- Brand kit:
  - Primary color, font, logo path/storage path, caption style, watermark toggle.
- Project system:
  - Projects contain scripts, assets, clips, exports, YouTube ingest jobs.

## RepurposeOS

RepurposeOS is a three-page workflow:

1. `/repurpose`: ingest and detect.
2. `/repurpose/editor`: edit and enhance.
3. `/repurpose/export`: export and translate.

Shared state is handled by `components/repurpose/repurpose-context.tsx`, which persists `projectId` in the query string and loads project detail with React Query.

Implemented or scaffolded capabilities:

- File upload and YouTube URL ingest.
- YouTube ingest background job with progress metadata.
- Transcript display and translations.
- AI auto-highlights with model selection.
- AI prompt generator for viral detection.
- Clip list with ordering, filters, virality scores, bulk selection.
- Clip split, trim, captions.
- Caption overlay/style configuration.
- Natural language clip search, chapters, composite clips, advanced panels.
- Export presets and status polling.
- Voice translation/dubbing pipeline.

Current media-processing state:

- FFmpeg work runs from the web runtime through `@clippers/jobs`.
- Active media queues:
  - `apps/web/lib/render-queue.ts`
  - `apps/web/lib/youtube-ingest-queue.ts`
  - `apps/web/lib/voice-translation-queue.ts`
- This is acceptable for development/transitional deployment, but production should move sustained media workloads to a dedicated worker/runtime with persistent storage access and stronger retry/isolation semantics.

## Billing And Monetization

Runtime commercial plan source of truth: `apps/web/lib/billing/commercial-model.ts`.

Plans:

- `free`
- `starter`
- `creator`
- `studio`

Billing capabilities:

- Razorpay checkout/subscriptions/cancel/verify/webhook routes.
- Razorpay webhook idempotency model.
- Subscription bootstrap and access helpers.
- Usage tracking and usage logs.
- Commercial limits for ideas, scripts, titles, thumbnails, TTS, calendar generations, niche analyses, competitors, SnipRadar scheduling, API/webhooks.

Important state:

- Runtime plans use `starter`, `creator`, `studio`.
- Launch-facing copy may still talk about free/plus/pro packaging, but runtime billing currently uses `free`, `starter`, `creator`, and `studio`.
- `.env.example` and `.env.v1.example` use `RAZORPAY_PLAN_ID_STARTER_INR`, `RAZORPAY_PLAN_ID_CREATOR_INR`, `RAZORPAY_PLAN_ID_STUDIO_INR`, and optional USD equivalents in the full env reference.
- Stripe fields remain in Prisma schema as legacy placeholders.

## Data Model Summary

Prisma schema source: `apps/web/prisma/schema.prisma`.

Database provider:

- PostgreSQL via `datasource db { provider = "postgresql" }`.
- `DATABASE_URL` is required and should use the direct Supabase PostgreSQL URL for Prisma.

Core/auth:

- `User`, `Account`, `Session`, `VerificationToken`
- `Subscription`, `UsageTracking`, `UsageLog`, `RazorpayWebhookEvent`

Project/media:

- `Project`, `Script`, `Asset`, `Clip`, `Export`, `BrandKit`
- `TranscriptJob`, `VoiceProfile`, `VoiceRender`
- `TranscriptTranslation`, `CaptionTranslation`, `VoiceTranslation`
- `YouTubeIngestJob`

YouTube creator:

- `Niche`, `ContentIdea`, `ContentCalendar`
- `GeneratedScript`, `ScriptVersion`, `ScriptShare`, `ScriptComment`, `ScriptAudio`
- `GeneratedTitle`, `Thumbnail`
- `KeywordResearch`, `SavedKeyword`
- `Competitor`, `CompetitorSnapshot`, `CompetitorVideo`, `CompetitorAlert`

SnipRadar:

- `XAccount`, `XAccountSnapshot`, `XProfileAuditSnapshot`
- `XTrackedAccount`, `ViralTweet`, `TweetDraft`, `XStyleProfile`
- `XSchedulerRun`, `XEngagementOpportunity`
- `XAutoDmAutomation`, `XAutoDmDelivery`
- `XResearchInboxItem`
- `XRelationshipLead`, `XRelationshipInteraction`
- `ViralTemplate`
- `XResearchDocument`, `XResearchIndexRun`
- `SnipRadarApiKey`, `SnipRadarWebhookSubscription`, `SnipRadarWebhookEvent`, `SnipRadarWebhookDelivery`
- `SnipRadarKbChunk`, `SnipRadarChatSession`, `SnipRadarChatMessage`

Other:

- `WaitlistLead` is intentionally kept to avoid accidental data loss.

Schema notes:

- `User` carries both legacy YouTube creator fields and V1 onboarding fields: `creatorType`, `primaryPlatform`, and `contentGoal`.
- `Project` carries V1 project context fields: `targetPlatform` and `contentGoal`.
- `Subscription` and user-level billing fields preserve Razorpay as the active provider while retaining Stripe placeholders for compatibility.
- SnipRadar/X models remain present even while V3 is hidden in production.

## API Surface

The app has a large API surface under `apps/web/app/api`.

Major groups:

- Auth: `/api/auth/**`
- Ecosystem: `/api/ecosystem`
- Billing: `/api/billing/**`, `/api/webhooks/razorpay`
- Projects/assets/clips/exports: `/api/projects/**`, `/api/assets/**`, `/api/clips/**`, `/api/exports/**`, `/api/upload`, `/api/uploads/**`
- RepurposeOS: `/api/repurpose/**`, `/api/translations/**`, `/api/voice-translations/**`
- YouTube creator: `/api/niche-discovery/**`, `/api/keywords/**`, `/api/competitors/**`, `/api/content-calendar/**`, `/api/scripts/**`, `/api/titles/**`, `/api/thumbnails/**`, `/api/hooksmith/**`
- Media AI: `/api/imagen/**`, `/api/veo`, `/api/sora`, `/api/transcribe/**`, `/api/voicer/**`
- SnipRadar: `/api/snipradar/**`
- Inngest: `/api/inngest`
- Health/OG: `/api/health`, `/api/og`

Route surface notes:

- Workspace pages exist for V1, V2, and V3 modules, but navigation visibility is launch-flag controlled.
- Marketing routes live under `apps/web/app/(marketing)` and include landing, pricing, templates, revenue templates, and submit-template pages.
- Auth/onboarding/billing/ecosystem routes live outside the workspace route group and remain part of the V1 launch shell.

## Production Setup State

Primary production guide: `docs/PRODUCTION_SETUP.md`.

V1 production baseline:

- Database: Supabase PostgreSQL, using the direct Prisma connection string as `DATABASE_URL`.
- Schema apply path: `pnpm --filter web exec prisma generate` then `pnpm --filter web exec prisma db push`; `prisma migrate deploy` is preferred once migration history is formalized.
- Auth: NextAuth with `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, Google OAuth, and production redirect URI.
- Storage: Supabase Storage through S3-compatible variables is recommended for V1 production.
- AI: OpenRouter for text/transcript intelligence flows, OpenAI for Whisper/TTS/DALL-E-compatible paths.
- Current V1 OpenRouter defaults: `google/gemini-3.1-pro-preview` for auto-highlight detection, `google/gemini-3.1-flash-lite-preview` for caption refinement and future ingest metadata, and `anthropic/claude-sonnet-4.6` for hooks/scripts.
- Billing: Razorpay live keys, webhook secret, and starter/creator/studio subscription plan IDs.
- Background jobs: Inngest event and signing keys, endpoint at `/api/inngest`.
- Deployment targets: Vercel or Coolify/VPS.
- FFmpeg: static binaries are bundled, with `FFMPEG_PATH` available as a server override.

V1 required env is split between `.env.v1.example` and the complete `.env.example`. Production should keep:

- `NEXT_PUBLIC_V1_CORE_ENABLED=true`
- `NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED=false`
- `NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED=false`
- `STORAGE_DRIVER=s3`
- `UI_V2_ENABLED=true`
- `NEXT_PUBLIC_UI_V2_ENABLED=true`

## Feature Flags

Central source of truth: `apps/web/config/features.ts`.

Compatibility and metadata files:

- `apps/web/lib/feature-flags.ts`
- `apps/web/lib/feature-flag-registry.ts`

Launch groups:

- `V1_FEATURES`
- `V2_FEATURES`
- `V3_FEATURES`
- `isFeatureEnabled(featureName)`

V1/V2/V3 launch flags:

- `NEXT_PUBLIC_V1_CORE_ENABLED`
- `NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED`
- `NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED`

Individual V2 flags:

- `NEXT_PUBLIC_FEATURE_VIRAL_HOOK_GENERATOR_ENABLED`
- `NEXT_PUBLIC_FEATURE_PLATFORM_CAPTION_GENERATOR_ENABLED`
- `NEXT_PUBLIC_FEATURE_CLIP_RANKING_DASHBOARD_ENABLED`
- `NEXT_PUBLIC_FEATURE_CONTENT_CALENDAR_ENABLED`
- `NEXT_PUBLIC_FEATURE_YOUTUBE_TITLE_GENERATOR_ENABLED`
- `NEXT_PUBLIC_FEATURE_THUMBNAIL_IDEAS_ENABLED`
- `NEXT_PUBLIC_FEATURE_BASIC_CREATOR_ANALYTICS_ENABLED`
- `NEXT_PUBLIC_FEATURE_KEYWORD_RESEARCH_ENABLED`

Individual V3 flags:

- `NEXT_PUBLIC_FEATURE_SNIPRADAR_ENABLED`
- `NEXT_PUBLIC_FEATURE_X_AUTOMATION_ENABLED`
- `NEXT_PUBLIC_FEATURE_AUTO_SCHEDULING_ENABLED`
- `NEXT_PUBLIC_FEATURE_COMPETITOR_TRACKING_ENABLED`
- `NEXT_PUBLIC_FEATURE_RELATIONSHIP_CRM_ENABLED`
- `NEXT_PUBLIC_FEATURE_API_WEBHOOKS_ENABLED`
- `NEXT_PUBLIC_FEATURE_IMAGEN_ENABLED`
- `NEXT_PUBLIC_FEATURE_VEO_ENABLED`
- `NEXT_PUBLIC_FEATURE_ADVANCED_AUTOMATION_ENABLED`
- `NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS_ENABLED`
- `NEXT_PUBLIC_FEATURE_VOICE_CLONING_ENABLED`

Legacy/compatibility SnipRadar flags now resolve through the V3 automation posture:

- `snipRadarEnabled`
- `snipRadarOverviewV2Enabled`
- `snipRadarAnalyticsV2Enabled`
- `snipRadarCreateV2Enabled`
- `snipRadarDiscoverV2Enabled`
- `snipRadarPublishV2Enabled`
- `snipRadarGrowthPlanV2Enabled`

Default-off or experimental/gated features:

- `winnerLoopEnabled`
- `relationshipsCrmEnabled`
- `apiWebhooksEnabled`
- `autoDmEnabled`
- `youtubeRepurposeOsEnabled`
- `youtubeVoicerEnabled`
- `youtubeThumbnailGeneratorEnabled`
- `transcribeUiEnabled`
- `imagenEnabled`
- `veoEnabled` plus `FORCE_VEO_ENABLED`
- `soraEnabled`

Important policy:

- Flags should have owner, stage, default, description, kill-switch behavior, and removal condition.
- Docs should not present flagged-off features as fully live without noting the guard.

## Integrations And Provider Dependencies

- **X/Twitter API**: OAuth 2.0 PKCE, posting, tweet/user lookups, metrics.
- **OpenRouter**: primary text-model gateway for many AI flows.
- **OpenAI**: Whisper transcription, TTS, some direct model/image fallback paths.
- **Google Gemini/Imagen/Veo**: AI analysis, image generation, video generation.
- **ElevenLabs**: voice profile/render/Voicer-related features.
- **YouTube Data API**: keyword discovery and competitor channel/video data.
- **DataForSEO**: search volume and trend enrichment.
- **Razorpay**: billing, subscriptions, checkout, webhooks.
- **Supabase**: PostgreSQL and storage target.
- **S3-compatible storage**: optional upload/export storage driver.
- **Inngest**: scheduled and event-driven background jobs.

## Testing And Verification

Available scripts:

- Root:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm start`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm seed`
- Web:
  - `pnpm --filter web test`
  - `pnpm --filter web test:unit`
  - `pnpm --filter web snipradar:verify`
  - `pnpm --filter web snipradar:smoke`
  - `pnpm --filter web repurpose:smoke`
  - `pnpm --filter web repurpose:test`

Test coverage present:

- Jest unit tests for billing, analytics, feature flags, platform standards, Repurpose helpers, SnipRadar services, domain services, repositories, and use cases.
- Playwright tests for auth, smoke flow, and Repurpose flow.
- Node smoke/load scripts for SnipRadar and Repurpose.

Latest verification after the launch-version split:

- `pnpm --filter web lint` passed with warnings only.
- `pnpm --filter web build` passed.
- `pnpm --filter web exec tsc --noEmit` still fails on existing broader repo/test type errors unrelated to the launch gating work.

## Known Drift And Risks

- **Database docs drift**: README and `docker-compose.yml` still reference MySQL, but Prisma schema uses PostgreSQL and deployment docs target Supabase.
- **Package manager docs drift**: root `package.json` declares `pnpm@8.15.4`, while production setup asks for pnpm 9 or later.
- **Docs index drift**: some docs reference `apps/web/docs`, while current technical docs are under `docs/architecture`.
- **Feature status drift**: older PRDs describe some YouTube/Repurpose/SnipRadar capabilities as fully live; actual navigation and flags show several are gated or experimental.
- **Media runtime risk**: FFmpeg jobs run inside the web app process through an in-memory queue. This is fragile for production media workloads.
- **API response consistency**: standardized response helpers exist, but the large API surface likely has mixed response shapes.
- **Billing naming drift**: current runtime plans are `starter`, `creator`, `studio`, while some launch/business language may still mention plus/pro packaging.
- **Typecheck debt**: full `tsc --noEmit` currently fails because test/service type errors exist outside the V1 launch-gating change set, even though the web build passes.
- **Secrets hygiene risk**: `.env.example` contains placeholder and public-looking sample values; real secrets must stay outside git and deployment env must be audited.
- **Large product surface**: the app has many features and route groups. Future work should avoid adding more standalone surfaces without tightening launch scope.

## Product State To Build From

Recommended near-term working assumption:

- Treat **V1 Core Video Repurposing** as the primary product for launch/hardening.
- Treat **SnipRadar** and other automation surfaces as V3 unless explicitly unlocked.
- Treat **creator growth tools** such as content calendar, title generation, thumbnail ideas, and keyword research as V2 unless explicitly unlocked.
- Preserve the ecosystem split; do not mix X-only and YouTube-only workflows.
- For new features, start with the existing feature domain folders and route patterns before creating new architecture.
- For SnipRadar, prefer adding to existing route tabs/components and shared `SnipRadarProvider`.
- For RepurposeOS, preserve the three-step flow and shared `RepurposeProvider`.
- For complex server behavior, prefer use-case/service layers over large route handlers.
- For provider-dependent surfaces, add or reuse a feature flag and document kill-switch behavior.

## High-Value Next Engineering Moves

1. Align database setup docs with PostgreSQL/Supabase or restore a valid local Postgres compose setup.
2. Run `pnpm --filter web snipradar:verify` and capture the actual current build/type/lint state.
3. Audit the V1 video repurposing flow end to end: upload, detect, captions, brand kit, export, billing.
4. Normalize critical API response envelopes and auth failure shapes on the V1 path.
5. Keep V2/V3 modules hidden in production unless their launch flags are explicitly enabled.
6. Move media processing toward a dedicated worker plan before scaling RepurposeOS.
7. Review `.env.example` for secret hygiene and stale provider names.
8. Keep this file updated after major feature, schema, or launch-scope changes.
