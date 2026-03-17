# ViralSnipAI — Master Product Requirements Document

> **Version:** 1.2 — March 2026
> **Status:** Active Development — audited against the codebase on 2026-03-08
> **Codebase:** `clippers` (pnpm monorepo)
> **Brand Name in UI:** ViralSnipAI
> **Builder:** Ashutosh

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Database Schema Summary](#4-database-schema-summary)
5. [Dual Ecosystem Model](#5-dual-ecosystem-model)
6. [YouTube Creator Platform](#6-youtube-creator-platform)
7. [X Growth Platform — SnipRadar](#7-x-growth-platform--snipradar)
8. [Browser Extension](#8-browser-extension)
9. [Subscription & Monetization](#9-subscription--monetization)
10. [Feature Flag System](#10-feature-flag-system)
11. [Privacy & Compliance Baseline](#11-privacy--compliance-baseline)
12. [Implementation Status](#12-implementation-status)
13. [Pending Roadmap](#13-pending-roadmap)
14. [Engineering Standards](#14-engineering-standards)
15. [Key File Reference](#15-key-file-reference)

---

## 1. Product Overview

ViralSnipAI is a dual-ecosystem SaaS platform for content creators:

1. **YouTube Creator Platform** — End-to-end toolchain covering niche discovery, keyword research, competitor tracking, content calendars, script generation, hook writing, video repurposing, AI image/video generation, and brand management.

2. **X Growth Platform (SnipRadar)** — An AI-native research, creation, scheduling, and analytics system for X/Twitter creators, with a Chrome browser extension for in-context capture and AI reply assistance.

### Target Users

| Persona | Primary Tools |
|---------|--------------|
| YouTube Creator (solo) | Niche Discovery, Keywords, Script Generator, Hooksmith, RepurposeOS |
| Content Team Lead | Content Calendar, Competitors, Projects, Brand Kit |
| X/Twitter Creator | SnipRadar — Discover, Create, Publish, Analytics |
| Video Editor | RepurposeOS (Editor + Export pages), Projects |
| Growth Marketer | SnipRadar Analytics, Competitors, Keyword Research |

### Core Value Proposition

- **YouTube side:** Compress the full creator content cycle — ideation to publish-ready short-form clips — without agency overhead.
- **X side:** Research → Decision → Distribution → Learning loop powered by AI, in one workspace.

---

## 2. Architecture

### 2.1 Overall Style

Modular monolith in Next.js (App Router) with strict module boundaries between feature domains. Clean Architecture with four layers:

```
Presentation Layer  (app/, components/, API routes)
        |
Application Layer  (lib/application/use-cases/)
        |
Domain Layer       (lib/domain/services/, value objects, interfaces)
        |
Infrastructure Layer (lib/infrastructure/repositories/, services/, DI)
```

### 2.2 Monorepo Layout

```
clippers/
├── apps/
│   ├── web/                         ← Main Next.js 14 app
│   │   ├── app/                     ← App Router pages + API routes
│   │   ├── components/              ← React components by feature
│   │   ├── lib/                     ← Business logic, services, utils
│   │   │   ├── ai/                  ← AI modules (snipradar, style, analyzer)
│   │   │   ├── application/         ← Use cases (SOLID pattern)
│   │   │   ├── domain/              ← Domain services + value objects
│   │   │   ├── infrastructure/      ← Prisma repos + DI container
│   │   │   ├── integrations/        ← X API, YouTube Data API, DataForSEO
│   │   │   ├── keywords/            ← Keyword research orchestrator + providers
│   │   │   ├── snipradar/           ← SnipRadar-specific business logic
│   │   │   └── services/            ← Feature services (caption, virality, etc.)
│   │   ├── hooks/                   ← React custom hooks
│   │   ├── types/                   ← TypeScript types (dashboard, title, thumbnail)
│   │   └── prisma/                  ← Prisma schema + migrations + seed
│   └── browser-extension/           ← Manifest V3 Chrome extension
├── packages/
│   ├── jobs/                        ← Inngest background job functions
│   └── types/                       ← Shared TypeScript types
└── docs/                            ← All documentation + PRDs
```

### 2.3 Data Flow Patterns

- **Server components by default** — `use client` only for interactivity.
- **TanStack Query v5** for all client-side data fetching with 30–60s stale times.
- **React Context** for cross-route shared state (RepurposeContext, SnipRadarContext).
- **Inngest** for all background/async workloads (YouTube sync, viral fetch, scheduled posting).
- **Zod** for all API contract validation (request bodies + response shapes).
- **InversifyJS DI container** for use case and service injection.

### 2.4 Media Processing Runtime

The platform currently uses a **transitional media-processing architecture**.

**Current state**
- FFmpeg binaries are resolved from `ffmpeg-static`, `ffprobe-static`, or explicit env overrides.
- FFmpeg-backed jobs are orchestrated through `@clippers/jobs`.
- Queue workers are currently booted from the web runtime for:
  - `apps/web/lib/render-queue.ts`
  - `apps/web/lib/youtube-ingest-queue.ts`
  - `apps/web/lib/voice-translation-queue.ts`

**What this means**
- This is acceptable for local development and transitional deployment.
- It is not the long-term production target for sustained media workloads.

**Production target**
- Dedicated worker or media-processing runtime
- Persistent storage access for source and output assets
- Explicit retry semantics and resource isolation from the main web runtime

**Known failure modes**
- Missing FFmpeg or ffprobe binary
- Missing or stale source asset path
- Output write failure or permissions issue
- Queue stall or worker unavailability

**Degraded behavior**
- Jobs should fail explicitly and record actionable error state.
- Silent hangs are treated as a bug.
- A unified user-visible job center is planned separately; Phase 1 documents the runtime, not the final user status UX.

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2.3 (App Router, no Pages dir) |
| Language | TypeScript (strict mode, no `any`) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL via Prisma ORM (hosted on Supabase) |
| Auth | NextAuth 4.24.x — JWT strategy, Google OAuth + Email/Password + Demo |
| State | TanStack Query v5 (server), React Context (cross-route), useState (local) |
| Background Jobs | Inngest (event-driven + cron functions) + `@clippers/jobs` (FFmpeg-backed media queue) |
| AI Models | OpenAI GPT-4/gpt-5-mini, Google Gemini 2.x/3.x, Google Imagen, Google Veo |
| Voice/Audio | ElevenLabs (voice cloning), OpenAI TTS (tts-1, tts-1-hd) |
| Video | FFmpeg (clip extraction, caption burn-in, export), YouTube Data API |
| Storage | AWS S3 (videos, exports, audio), Supabase Storage |
| Search/SEO | DataForSEO (keyword demand + trends), YouTube Data API (autocomplete) |
| X Integration | X/Twitter API v2 with OAuth 2.0 PKCE + refresh tokens for full-access accounts, plus manual username connect for read-only fallback |
| Forms | react-hook-form + zod |
| Icons | lucide-react only |
| Package Manager | pnpm (workspace) |
| Testing | Playwright (E2E smoke), Jest (unit) |
| Hosting | Vercel (web) + Supabase (DB) |

---

## 4. Database Schema Summary

Key Prisma models (PostgreSQL via Supabase):

### User & Auth
- `User` — id, email, plan, subscriptionTier, billingProvider, razorpayCustomerId, razorpaySubscriptionId, creditsRemaining, selectedNiche, onboardingCompleted, goalSelection
- `Account` / `Session` — NextAuth OAuth account links + sessions
- `UsageLog` — per-user credit tracking per feature

### YouTube Creator Models
- `Project` — Video project container (userId, title, description)
- `ProjectAsset` — Uploaded video or YouTube link attached to a project
- `Clip` — Extracted video clip (start/end times, virality score, captionStyle, overlayConfig)
- `Export` — Export job record (status: queued/processing/done/failed, preset, outputUrl)
- `BrandKit` — Per-user brand config (primaryColor, font, logoUrl, captionStyle, watermarkEnabled)
- `TranscriptJob` — Whisper transcription job (status, result JSON)
- `VoiceProfile` — ElevenLabs custom voice definition
- `VoiceRender` — Rendered voice audio for a clip/asset
- `ContentIdea` — AI-generated content idea (niche, format, score, title, hook, description)
- `ContentCalendar` — Calendar container grouping ideas by date range
- `GeneratedScript` — Full script (hook, intro, mainContent, conclusion, cta, fullScript, TipTap JSON state)
- `ScriptAudio` — Persisted TTS outputs per script/section/voice
- `ScriptVersion` — Historical version snapshots of scripts
- `ScriptShare` — Shareable script links with expiry + permissions
- `ScriptComment` — Inline comments on scripts
- `GeneratedTitle` — AI-generated YouTube titles (saved per user)
- `Thumbnail` — AI-generated thumbnail (prompt, imageUrl, style)
- `KeywordResearch` / `SavedKeyword` — Keyword research history and saved keywords
- `Competitor` — Tracked YouTube competitor channels
- `CompetitorSnapshot` — Periodic competitor snapshots
- `CompetitorVideo` — Synced videos from competitor channels (via Inngest cron)
- `CompetitorAlert` — Alert records and review state

### X Growth / SnipRadar Models
- `XAccount` — Connected X account (xUserId, xUsername, accessToken, refreshToken, tokenExpiresAt, followerCount)
- `XAccountSnapshot` — Follower/tweet snapshots over time
- `XProfileAuditSnapshot` — Stored profile audit score, recommendations, and trend history
- `XTrackedAccount` — Accounts the user monitors for viral content
- `ViralTweet` — Ingested viral tweets from tracked accounts (analyzed, scored)
- `TweetDraft` — AI-generated or manual tweet draft (status: draft/scheduled/posted/failed, metrics)
- `XStyleProfile` — Trained writing style for the user (tone, vocabulary, avgLength, emojiUsage)
- `ViralTemplate` — Curated template records used by the template library
- `XEngagementOpportunity` — Found engagement opportunities from browsing
- `XSchedulerRun` — Scheduled posting job run records
- `XResearchInboxItem` — Tweets/threads saved from the browser extension (text, authorUsername, generatedReply, status, labels, metadata)
- `XRelationshipLead` — Lead CRM entry linked from inbox replies
- `XRelationshipInteraction` — Relationship timeline entries across inbox/opportunities/tracked accounts
- `XResearchDocument` / `XResearchIndexRun` — Indexed research corpus and indexing runs
- `SnipRadarApiKey` — Public API keys with scopes and expiry
- `SnipRadarWebhookSubscription` / `SnipRadarWebhookEvent` / `SnipRadarWebhookDelivery` — Public webhook subscriptions, event log, and delivery attempts
- `xStyleProfile` — (Alternate form) Writing style config

### Shared Infrastructure
- `UsageLog` — Shared usage/credits accounting across products
- `Project` / `Asset` / `Export` primitives reused across creator workflows

---

## 5. Dual Ecosystem Model

After login, users select an ecosystem stored in cookie `clippers_ecosystem`:

| Ecosystem | Value | Home Route | Focus |
|-----------|-------|-----------|-------|
| YouTube Creator | `"youtube"` | `/dashboard` | Content creation for YouTube |
| X Growth | `"x"` | `/snipradar/overview` | X/Twitter growth system |

**Ecosystem selection** happens at `/ecosystem/select` after first login.
**Route gating** is handled by `apps/web/components/layout/ecosystem-route-gate.tsx`.
**Ecosystem switcher** in sidebar: `apps/web/components/layout/ecosystem-switcher.tsx`.

---

## 6. YouTube Creator Platform

### 6.1 Navigation Structure

```

### 6.2 Activation Model

**Activation event**
- `creator_first_script_generated`

**Aha moment**
- The user turns a content idea into a usable script, not just a filled profile.

**Success threshold**
- onboarding started
- onboarding completed
- first content idea created
- first script generated

**Additional funnel checkpoints**
- first title batch generated
- first thumbnail batch generated

**Instrumentation source of truth**
- `apps/web/lib/analytics/activation.ts`
- `UsageLog` entries with `activation:*` feature keys
- dashboard activation summary in `apps/web/lib/analytics/metrics.ts`
WORKFLOW
├── Dashboard              /dashboard            ← Overview + quick-access cards
├── Niche Discovery        /niche-discovery      ← Niche quiz + scored niche cards
├── Keyword Research       /keywords             ← Research, save, recommend
├── Competitors            /competitors          ← Track + sync competitor channels
├── Content Calendar       /dashboard/content-calendar  ← AI content ideas calendar
│
CONTENT CREATION
├── Script Generator       /dashboard/script-generator   ← Full AI script editor
├── Title Generator        /dashboard/title-generator    ← AI title suggestions
├── Thumbnail Generator    /dashboard/thumbnail-generator ← AI thumbnail images
├── Hooksmith              /hooksmith            ← Hook generation for video intros
│
PRODUCTION
├── RepurposeOS            /repurpose            ← 3-page video workflow
│   ├── Ingest & Detect    /repurpose            ← Upload + YouTube ingest + highlight detection
│   ├── Edit & Enhance     /repurpose/editor     ← Video preview, clips, captions, timeline
│   └── Export & Translate /repurpose/export     ← Export presets, translations, downloads
│
ASSETS
├── Brand Kit              /brand-kit            ← Logo, colors, caption style, watermark
└── Projects               /projects             ← Video project management
    └── Project Detail     /projects/[id]        ← Clips, exports, assets per project

FLAG-GATED
├── Transcribe             /transcribe           ← Manual Whisper transcription (flag off)
├── Imagen                 /imagen               ← Google Imagen image gen (flag off)
├── Video Lab              /video                ← Video generation tools
├── Voicer                 /voicer               ← ElevenLabs TTS workspace (flag on)
└── Veo                    /veo                  ← Google Veo video gen (flag + FORCE_VEO_ENABLED)
```

---

### 6.2 Feature Specifications

#### Dashboard
- Overview cards for active projects, recent scripts, content ideas, keyword searches.
- Quick-access buttons into each feature workflow.
- Server-rendered with `unstable_cache` (60s revalidation).

#### Niche Discovery
- User takes a niche selection quiz (goal, interests, channel type).
- AI generates niche cards with: competition score, monetization score, content ideas, community strength.
- Niche stored on `User.selectedNiche` — used across all AI features for personalization.
- API: `POST /api/niche-discovery/analyze`, `POST /api/niche-discovery/select`, `GET /api/niche-discovery/niches`

#### Keyword Research (`/keywords`)
Provider architecture with 5 layers:
1. **Discovery** — YouTube autocomplete expansion (question, intent, alphabet-soup variants)
2. **Demand** — DataForSEO Google Ads search volume (7-day cache)
3. **Trend** — DataForSEO Trends signal (24-hour cache)
4. **Competition** — Heuristic competition model
5. **Intelligence** — Opportunity scoring, intent classification, topic clustering

Opportunity score formula:
`Score = f(Demand×0.22, Trend×0.15, CompetitionInverse×0.20, PlatformFit×0.18, CreatorFit×0.15, ContentGap×0.10, ConfidencePenalty)`

UI: search results, saved keywords, recommendations, history.
APIs: `GET /api/keywords/search`, `GET /api/keywords/recommendations`, `GET /api/keywords/saved`, `POST /api/keywords/saved`, `GET /api/keywords/history`

#### Competitors (`/competitors`)
- Add YouTube channel URLs to track.
- Inngest cron job syncs latest videos + metadata.
- Per-channel detail page: video list, publish cadence, engagement analytics, title patterns.
- Alert system for notable changes.
- APIs: `GET /api/competitors`, `POST /api/competitors`, `POST /api/competitors/[id]/sync`, `GET /api/competitors/[id]/analytics`, `GET /api/competitors/alerts`, `GET /api/competitors/search`

#### Content Calendar (`/dashboard/content-calendar`)
- AI generates a calendar of content ideas with virality scores for a date range.
- Auto-schedule feature places ideas into optimal posting slots.
- Per-idea actions: regenerate, edit, delete, export to CSV/iCal, and send an idea into RepurposeOS as a seeded project.
- Idea metadata: title, hook, description, keywords, format, platform, estimatedViews.
- APIs: `POST /api/content-calendar/generate`, `GET/POST /api/content-calendar`, `PATCH/DELETE /api/content-calendar/[calendarId]`, `GET/PATCH/DELETE /api/content-calendar/ideas/[ideaId]`, `POST /api/content-calendar/ideas/[ideaId]/regenerate`, `POST /api/content-calendar/[calendarId]/auto-schedule`

#### Script Generator (`/dashboard/script-generator`)
- TipTap rich text editor with structured script sections: hook, intro, mainContent, conclusion, cta.
- AI generation from title/keyword/niche context.
- AI revision modes: "Make more engaging", "Make shorter", custom prompt revisions.
- Section-by-section regeneration.
- Version history with restore.
- Inline comments and shareable links (with permission levels + expiry).
- **TTS synthesis** — convert any section or full script to audio via OpenAI TTS (tts-1/tts-1-hd, 12 voices: alloy, verse, blossom, ballad, coral, ash, echo, fable, onyx, nova, sage, shimmer).
- Audio player UI with seek, volume, download.
- Export: PDF, text, script + audio ZIP.
- APIs: `GET/POST /api/scripts`, `GET/PATCH/DELETE /api/scripts/[scriptId]`, `POST /api/scripts/generate`, `POST /api/scripts/[scriptId]/revise`, `POST /api/scripts/[scriptId]/regenerate-section`, `GET/POST /api/scripts/[scriptId]/versions`, `POST /api/scripts/[scriptId]/versions/[versionId]/restore`, `GET/POST /api/scripts/[scriptId]/share`, `GET/POST /api/scripts/[scriptId]/comments`, `DELETE /api/scripts/[scriptId]/comments/[commentId]`, `POST /api/scripts/[scriptId]/synthesize`

#### Title Generator (`/dashboard/title-generator`)
- Input: niche, keyword, tone, style preferences.
- Output: 5–10 title variants with predicted CTR signals.
- Save titles per user; delete history.
- APIs: `GET/POST /api/titles`, `GET/PATCH/DELETE /api/titles/[titleId]`, `POST /api/titles/generate`

#### Thumbnail Generator (`/dashboard/thumbnail-generator`)
- Input: topic/title, style (photorealistic, illustrated, minimal, bold), aspect ratio.
- Generates AI thumbnails via Google Imagen (flag-gated).
- Save, regenerate, download.
- APIs: `GET/POST /api/thumbnails`, `GET/PATCH/DELETE /api/thumbnails/[thumbnailId]`, `POST /api/thumbnails/generate`

#### Hooksmith (`/hooksmith`)
- Input: topic, optional source URL, audience, tone.
- Output: 8–10 hook variants, selectable.
- Hook saved to project or used to seed Script Generator.
- Optional: AI-generated follow-on script from selected hook.
- APIs: `POST /api/hooksmith/hooks`, `POST /api/hooksmith/script`

#### RepurposeOS (`/repurpose`) — 3-Page Workflow

Shared state through `RepurposeContext` (project ID in URL `?projectId=xxx`), provided by `repurpose/layout.tsx`.

**Page 1 — Ingest & Detect (`/repurpose`)**
- YouTube URL ingest with progress polling (`POST /api/repurpose/ingest` → `GET /api/repurpose/ingest/[jobId]`)
- File upload via `<UploadDropzone>`
- Transcript display after ingest
- AI highlight detection with model selection:

  | Model | Accuracy | Cost/1M | Use Case |
  |-------|---------|---------|---------|
  | Gemini 3 Pro (default) | 87.6% (Video-MMMU) | ~$1.25 | Native video frame analysis |
  | GPT-5.2 (premium) | 90.5% | ~$1.25 | Highest accuracy |
  | Gemini 2.5 Flash (budget) | ~80% | $0.30 | Fast, cost-efficient |
  | Gemini 2.5 Pro (legacy) | 84.8% | ~$1.25 | Backward compat |

- AI prompt generator dialog (`POST /api/repurpose/generate-prompts`)
- Viral detection prompts: brief, audience, tone, CTA
- Auto-detect highlights (`POST /api/repurpose/auto-highlights`)
- CTA button: "Clips detected → Go to Editor" when clips exist

**Page 2 — Edit & Enhance (`/repurpose/editor`)**
- Two-column layout (desktop): preview left, tools right
- Left: `<PreviewCanvas>` (video player), `<Timeline>` (clip timeline with split/trim), `<AdvancedFeaturesPanel>` (4 lazy-loaded tabs)
- Right: `<ClipList>` (drag-drop, filter, sort, bulk actions, virality scores), `<CaptionTable>`, `<PropertiesPanel>` (aspect ratio), `<NotesPanel>`
- Advanced Features Panel tabs:
  1. NLP Search — natural language clip search
  2. Chapters — chapter-level timeline segmentation
  3. Composite Clips — multi-source clip builder
  4. Caption Styling — font, size, position, color, emphasis, highlight colors
- Caption overlay studio: timed hook overlays with layer/alignment/timing controls
- Clip operations: split, trim, generate captions
- APIs: `POST /api/clips/[id]/split`, `POST /api/clips/[id]/trim`, `POST /api/repurpose/captions`, `GET/PATCH/DELETE /api/clips/[id]`

**Page 3 — Export & Translate (`/repurpose/export`)**
- Export presets with polling:
  - Shorts (9:16, 1080×1920)
  - Square (1:1, 1080×1080)
  - Landscape (16:9, 1920×1080)
- Caption burn-in toggle + timed hook overlay rendering via FFmpeg
- Text transcript translation (6 languages) — `POST /api/translations/transcript`
- Voice dubbing/translation (3 languages) — ElevenLabs pipeline
- Download center: completed exports with file links
- APIs: `POST/GET /api/exports`, `GET/DELETE /api/exports/[id]`, `GET /api/translations/languages`, `POST /api/assets/[assetId]/translations`, `POST /api/voice-translations/translate`

#### Brand Kit (`/brand-kit`)
- Primary color, secondary color, font family, logo upload (Supabase Storage)
- Caption style: font, size, position, color scheme, background, outline
- Watermark toggle + positioning
- Rendering pipeline applies these settings to all previews and exports
- APIs: `GET/PATCH /api/brand-kit`, `POST /api/brand-kit/logo`

#### Projects (`/projects`)
- CRUD for video projects
- Attach scripts, assets, clips, and exports to a project
- Project detail page: asset list, clips grid, export history, script links
- APIs: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/[id]`, `GET/PATCH /api/projects/[id]/clip-order`, `GET/POST /api/projects/[id]/script`

#### Voicer (`/voicer`) — Flag-Gated
- ElevenLabs TTS workspace
- Custom voice creation from audio samples
- Voice profile storage in `VoiceProfile` table
- High-quality synthesis with format options
- APIs: `GET /api/voicer/voices`, `POST /api/voicer/speak`

#### Imagen (`/imagen`) — Flag-Gated
- Google Imagen image generation (text prompt + style + aspect ratio)
- Prompt enhancement via AI
- Transcribe audio → text prompt → generate image
- APIs: `POST /api/imagen`, `POST /api/imagen/prompt`, `POST /api/imagen/transcribe`

#### Veo (`/veo`) — Requires `FORCE_VEO_ENABLED=true`
- Google Veo video generation (6–30s cinematic clips)
- Duration and aspect ratio controls
- API: `POST /api/veo`

---

## 7. X Growth Platform — SnipRadar

### 7.1 Navigation Structure

```
X Ecosystem
├── Overview               /snipradar/overview        ← Hub: stats + growth coach + nav cards
│
RESEARCH & DISCOVERY
├── Discover               /snipradar/discover        ← Tabs: Tracker | Viral Feed | Engagement
│
CONTENT CREATION
├── Create                 /snipradar/create          ← Tabs: Drafts | Research | Predictor | Templates | Style | Threads | Hooks
│   └── [tab]              /snipradar/create/[tab]
│
PUBLISHING
├── Publish                /snipradar/publish         ← Tabs: Calendar | Scheduler | Best Times | Automations | API
│   └── [tab]              /snipradar/publish/[tab]
│
INTELLIGENCE
├── Research Inbox         /snipradar/inbox           ← Saved captures from extension
├── Relationships          /snipradar/relationships   ← Lead CRM + relationship graph
├── Analytics              /snipradar/analytics       ← Growth metrics + patterns + AI summary
│
PLANNING
└── Growth Planner         /snipradar/growth-planner  ← AI growth plan
    └── Fullscreen         /snipradar/growth-planner/fullscreen
```

Shared `SnipRadarContext` (account, stats, drafts, viral tweets, tracked accounts) provided by `snipradar/layout.tsx`. Polls scheduled drafts every 60s from any sub-page.

### 7.2 X Account Connection
- OAuth 2.0 PKCE is the recommended full-access connection path
- Manual username connection remains available as a read-only fallback
- OAuth-backed accounts store `accessToken`, `refreshToken`, and `tokenExpiresAt` in `XAccount`
- Read-only manual connections use a non-posting placeholder token path and disable posting features
- Connection gate in layout: if no account connected, shows `<ConnectXDialog>` CTA
- OAuth callback is implemented at `GET /api/snipradar/callback`

### 7.3 Overview Page
- 4 stat cards: follower growth (7d), posts (7d), avg engagement rate, avg impressions/post
- AI Growth Coach card (`POST /api/snipradar/coach`)
- Profile Health Score (from `XProfileAuditSnapshot` history)
- Workflow progress steps
- Feature navigation cards → Discover, Create, Publish, Analytics
- Profile disconnect control

### 7.4 Discover Page — 3 Tabs

**Tab 1: Tracker**
- Add tracked accounts (username lookup)
- Grid of tracked accounts with follower count, last synced
- Select accounts → "Fetch Viral" batch operation
- Account detail dialog: recent posts, follower trend
- Inngest cron: auto-fetches viral tweets every 6 hours

**Tab 2: Viral Feed**
- Filter by tracked account, search text, analyzed/unanalyzed, sort by score/likes/recency
- `<ViralTweetCard>` per tweet: text preview, engagement metrics, virality score, AI analysis badge
- "Analyze" button (runs AI pattern analysis), "Clear" to purge feed
- APIs: `GET /api/snipradar/discover-data`, `GET /api/snipradar/viral`, `POST /api/snipradar/viral/analyze`

**Tab 3: Engagement**
- `<EngagementFinder>` — discovers engagement opportunities in niche feeds
- Per-opportunity: tweet text, author, reply count, engagement metrics
- Status workflow per opportunity (pending → engaged → skip)

### 7.5 Create Page — 7 Tabs

**Tab 1: Drafts (AI Live Draft Studio)**
- Generate AI drafts from tracked viral patterns + user's style profile
- Draft status sections: Active | Scheduled | Posted
- `<TweetDraftCard>` per draft:
  - Edit text inline
  - **Predict** — virality predictor score by objective (reach, replies, follows, conversion)
  - **Rewrite** — AI rewrite with style matching (`POST /api/snipradar/rewrite`)
  - **Variant Lab** — generate 3–5 variants, side-by-side scored comparison
  - **Schedule** — pick datetime + best-time recommendations
  - **Post Now** — immediately post to X via API
- Rate limit indicator for draft generation
- APIs: `POST /api/snipradar/drafts`, `GET /api/snipradar/drafts`, `PATCH/DELETE /api/snipradar/drafts/[id]`, `POST /api/snipradar/drafts/predict`, `POST /api/snipradar/drafts/variants`

**Tab 2: Research**
- `Research Copilot` over viral tweets, engagement opportunities, drafts, templates, Hooksmith artifacts, and content ideas
- Indexed corpus refresh + grouped citations + AI brief synthesis
- APIs: `POST /api/snipradar/research/index`, `POST /api/snipradar/research/query`

**Tab 3: Predictor**
- Standalone objective-based draft prediction surface
- Scores by reach, replies, follows, conversion, plus suggestion hints
- API: `POST /api/snipradar/drafts/predict`

**Tab 4: Templates**
- `<TemplateLibrary>` — curated and user-saved tweet templates
- Search/filter by category (metric, story, contrarian, question, launch, tutorial)
- Remix template: AI fills in user's content + style
- Save custom templates
- APIs: `GET/POST /api/snipradar/templates`, `POST /api/snipradar/rewrite`

**Tab 5: Style Trainer**
- `<StyleTrainerCard>` — analyze user's top posts to build a style profile
- Extracted attributes: tone, vocabulary, avgLength, emojiUsage, hashtagStyle, sentencePattern
- Style profile stored in `XStyleProfile`, used by all AI generation features
- API: `POST /api/snipradar/style`

**Tab 6: Threads**
- Multi-tweet thread composer
- AI thread generation from a single idea or hook
- Post thread via X API (chained replies)
- APIs: `POST /api/snipradar/threads/generate`, `POST /api/snipradar/threads/post`

**Tab 7: Hooks**
- AI hook generation for X posts
- Multiple hook formats: curiosity, contrarian, metric, announcement, question
- API: `POST /api/snipradar/hooks/generate`

### 7.6 Publish Page — 5 Tabs

**Tab 1: Calendar**
- Week/month grid of scheduled posts
- Drag-drop reschedule
- Runs via `GET /api/snipradar/scheduled/runs`

**Tab 2: Scheduler**
- Calendar view of scheduled drafts
- Drag-and-drop reschedule
- Per-slot status: scheduled, posted, failed
- Retry failed posts
- Scheduler runs tracked in `XSchedulerRun`
- Process endpoint (cron): `POST /api/snipradar/scheduled/process`

**Tab 3: Best Times**
- Engagement heatmap by day and hour
- AI best-time analysis from user's posting history
- API: `GET /api/snipradar/scheduler/best-times`

**Tab 4: Automations**
- Winner Loop automation surface for follow-ups, thread expansion, repost variants, and derivative actions
- APIs: `GET /api/snipradar/winners`, `POST /api/snipradar/winners/automations`

**Tab 5: API**
- Developer-facing API keys and webhook subscription management panel
- APIs: `GET/POST /api/snipradar/developer/keys`, `PATCH/DELETE /api/snipradar/developer/keys/[id]`, `GET/POST /api/snipradar/developer/webhooks`, `PATCH/DELETE /api/snipradar/developer/webhooks/[id]`

### 7.7 Research Inbox (`/snipradar/inbox`)
- Receives captures from the browser extension
- Capture types: tweet, thread, profile
- Per-item actions:
  - Status update: `new → drafted → tracked → archived`
  - Label management (up to 8 labels per item)
  - Note editing (up to 2,000 chars)
  - **Reply Assist** — AI-generated contextual reply using `gpt-5-mini` model
  - **Remix** — AI-powered repurpose of captured content into original X post
  - **Hard delete** — permanently remove item
- Bulk actions:
  - Multi-select visible captures
  - Bulk archive / restore / status updates
  - Bulk add or replace labels
  - Bulk delete
- Reply generation pipeline:
  1. Analyze source tweet (`analyzeSnipRadarExtensionSource`)
  2. Generate structured candidate replies anchored to the cleaned source text
  3. Score candidates by: word count, anchor match, banned pattern avoidance, and specificity
  4. Cache `extensionSourceAnalysis` in `XResearchInboxItem.metadata`
- APIs: `GET/POST /api/snipradar/inbox`, `PATCH /api/snipradar/inbox/bulk`, `PATCH/DELETE /api/snipradar/inbox/[id]`, `POST /api/snipradar/extension/reply`, `POST /api/snipradar/extension/remix`
- Reply Assist AI model: `gpt-5-mini` (via `OPENAI_SNIPRADAR_EXTENSION_MODEL` env override)
- Timeout: 10s (configurable via `OPENAI_SNIPRADAR_EXTENSION_TIMEOUT_MS`)

### 7.8 Relationships (`/snipradar/relationships`)
- Lead CRM synced from inbox reply actions
- `XRelationshipLead` per author: username, display name, avatar, linked inbox items, notes
- `syncLeadFromInboxReply` auto-creates/updates lead on reply generation
- Lead lifecycle: discovery → engaged → qualified → partner
- Filter by status, search by username

### 7.9 Analytics (`/snipradar/analytics`)
- Live X metric ingestion for user's own posted drafts
- Metrics: impressions, likes, replies, reposts, bookmarks, engagement rate
- Time-window cards: posts tracked, replies tracked, total impressions, avg engagement
- Pattern breakdown: top formats (by engagement), best posting times heatmap, emotion signal distribution
- AI summary (`POST /api/snipradar/viral/analyze` on user's own posts)
- Analytics derivation centralized in `lib/snipradar/analytics.ts`
- API: `GET /api/snipradar/metrics`

### 7.10 Growth Planner (`/snipradar/growth-planner`)
- AI-generated multi-week growth plan personalized to niche and follower count
- Full-screen mode available
- Plan sections: content mix, posting cadence, engagement strategy, growth milestones

### 7.11 Winner Loop Automation
- Detect winners: threshold-based from posted draft metrics
- Auto-create derivatives: follow-up post, thread expansion, quote tweet angle, reply CTA
- Evergreen recycle suggestions with cooldown and audience-fatigue controls
- Integration with Publish scheduler for automated derivative distribution

### 7.12 Profile Audit + Growth Score
- `XProfileAuditSnapshot` table: score, recommendations, fingerprint, and snapshot timestamp
- AI audit of: bio, display name, header image, pinned post, CTA clarity, proof signals, topic clarity, content mix, posting cadence
- Prioritized fixes with estimated growth impact
- Re-audit after changes to show score movement delta
- Shown on Overview page with score history trend

### 7.13 Public API + Webhooks
- Public API key management via `SnipRadarApiKey`
- Outgoing webhook subscriptions for draft posted/failed, research ingested, winner detected, and profile audit score updates
- Webhook persistence via `SnipRadarWebhookSubscription`, `SnipRadarWebhookEvent`, and `SnipRadarWebhookDelivery`
- Session-auth management routes:
  - `GET/POST /api/snipradar/developer/keys`
  - `PATCH/DELETE /api/snipradar/developer/keys/[id]`
  - `GET/POST /api/snipradar/developer/webhooks`
  - `PATCH/DELETE /api/snipradar/developer/webhooks/[id]`
- Public API routes under `/api/snipradar/public/v1/` for drafts, metrics, inbox, winners, profile audit, and scheduled runs

### 7.14 Activation & Funnel Instrumentation

**Activation event**
- `snipradar_first_scheduled_post`

**Aha moment**
- The user moves from connected data to a first scheduled post in the X workflow.

**Success threshold**
- X account connected
- first tracked account added
- first scheduled post

**Earlier funnel checkpoints**
- first reply assist used

**Instrumentation source of truth**
- `apps/web/lib/analytics/activation.ts`
- summary payload in `GET /api/snipradar?scope=summary`
- overview activation card powered by `apps/web/components/snipradar/activation-card.tsx`

### 7.15 X API Unit Economics Guardrails

Supporting model:

- `docs/X_API_UNIT_ECONOMICS.md`

Current guardrail model lives in:

- `apps/web/lib/snipradar/x-unit-economics.ts`

Current baseline assumptions:

- tracked-account fetch cadence: `4` read cycles per day
- account-summary refresh pressure: `4` reads per day baseline
- tweet metrics hydration cap: `15` candidates per refresh cycle
- watch threshold: `12` tracked accounts
- high threshold: `25` tracked accounts

This model is used to keep packaging and fetch-frequency decisions grounded in expected X API load rather than intuition.

### 7.16 Unified Activity / Job Status Surface

The platform now exposes a shared operations surface at:

- `/activity`

Supporting source of truth:

- `apps/web/lib/activity-center.ts`

Primary UI surfaces:

- `apps/web/components/activity/activity-center-panel.tsx`
- `apps/web/app/(workspace)/activity/page.tsx`
- dashboard preview in `apps/web/app/(workspace)/dashboard/page.tsx`

Normalized user-facing status vocabulary:

- `queued`
- `processing`
- `succeeded`
- `failed`
- `needs_action`

Current coverage includes:

- Creator Studio content-generation completions from `UsageLog`
- RepurposeOS YouTube ingest jobs
- RepurposeOS export renders
- voice-translation jobs
- transcript jobs
- SnipRadar scheduled and posted draft activity
- SnipRadar scheduler runs
- SnipRadar profile audits
- SnipRadar research-index refresh runs

The goal of this surface is operational legibility. Users can see what the system is doing, what finished successfully, what failed, and where to go next to recover or continue the workflow.

---

## 8. Browser Extension

Chrome Manifest V3 extension for SnipRadar in-context X capture and AI assistance.

### 8.1 Architecture
- **`manifest.json`** — MV3 manifest with permissions: `storage`, `activeTab`, `scripting`, `notifications`, `alarms`, `commands`
- **`service-worker.js`** — Background service worker: base URL discovery, auth session checks, inbox badge polling, keyboard shortcuts, and auth popup flow
- **`content-script.js`** — Injected into `x.com` (twitter.com): DOM capture, UI injection, composer interaction
- **`popup.js` + `popup.html`** — Extension popup: session status, inbox preview, quick draft, and developer-only URL override
- **`content-script.css`** — Styles for injected UI (result panel, menus, toasts)

### 8.2 Core Actions (Content Script)

| Action | Trigger | Description |
|--------|---------|-------------|
| Save to Inbox | Menu button "Save" | Captures tweet text, author, metadata → `POST /api/snipradar/inbox` |
| Reply Assist | Menu button "Reply" | Calls `POST /api/snipradar/extension/reply` with `inboxItemId` → shows inline result panel |
| Remix | Menu button "Remix" | Calls `POST /api/snipradar/extension/remix` → shows inline result panel |
| Track Author | Menu button "Track" | Adds author to tracked accounts → `POST /api/snipradar/extension/track` |
| Post as Reply | Button in result panel | Opens the same-page X reply composer and injects generated text |
| Open Compose | Button in result panel (remix) | Opens the same-page X new-post composer and injects remixed text |
| Copy | Button in result panel | Copies text to clipboard |

### 8.3 Capture Types
- **Tweet** — Single tweet text, author, timestamp, engagement metrics
- **Thread** — Multi-post thread with ordered posts in `metadata.posts`
- **Profile** — Author profile metadata (bio, followers, following)

### 8.4 Result Panel (Inline UI)
- Editable `<textarea>` with character counter (280-char limit indicator)
- Close, Copy, Post as Reply / Open Compose buttons
- Positioned near the action toggle that triggered it
- Animated slide-in (`.is-visible` class toggle)
- Toast notifications for success/error

### 8.5 X Composer Text Injection
Strategies tried in order for Lexical editor (X's current editor framework):
1. `beforeinput` event with `inputType: "insertText"` — verified via `event.defaultPrevented`
2. `ClipboardEvent("paste")` with monkey-patched `getData` (bypasses Chrome protected mode)
3. `beforeinput` with `inputType: "insertFromPaste"` + `DataTransfer`
4. `document.execCommand("paste")` (reads pre-written clipboard)
5. `document.execCommand("insertText")`
6. Direct `textContent` + synthetic `input` event (last resort)

### 8.6 Keyboard Shortcuts
Defined in `manifest.json` commands:
- `Alt+S` — Open the extension popup (`_execute_action`)
- `Alt+Shift+S` — Save the focused tweet to the inbox (`save-focused-tweet`)

### 8.7 Session Model
- Cookie-based (`credentials: "include"`) — same session as web app
- Service worker discovers and persists a working web-app base URL across localhost/production candidates
- Auth login can open in an extension popup window, then refresh the extension session state
- Badge counter shows unread inbox count by polling `GET /api/snipradar/inbox?status=new&limit=1`

### 8.8 Implementation Status by Phase

| Phase | Status | Items |
|-------|--------|-------|
| P0 — UX fixes | QA Complete | Inline result panel, popup cleanup, saved-state feedback, notification icon |
| P1 — Parity | Built | Engagement metrics capture, full thread capture, badge counter, keyboard shortcuts |
| P2 — Productivity | Built | Quick Draft in popup (`POST /api/snipradar/extension/draft`), in-extension auth popup |
| P3 — Distribution | Deferred | Firefox support (webextension-polyfill), Chrome Web Store submission |

---

## 9. Subscription & Monetization

### 9.1 Plan Tiers

Commercial source of truth:
- Runtime: `apps/web/lib/billing/commercial-model.ts`
- Billing helpers: `apps/web/lib/billing/plans.ts`
- Human-readable matrix: `docs/COMMERCIAL_LIMITS_MATRIX.md`

| Tier | Current Commercial Definition |
|------|-----------|
| `free` | 5 ideas/mo, 3 scripts/mo, 5 titles/mo, 3 thumbnails/mo, 0 TTS, 2 content calendar generations, 3 niche analyses |
| `starter` | 50 ideas/mo, 30 scripts/mo, 100 titles/mo, 15 thumbnails/mo, 10 TTS, 1 workspace + 1 brand kit, core SnipRadar drafting |
| `creator` | Unlimited core generation, 3 brand kits, 10 scheduled posts/week, 10 tracked competitors, priority email support |
| `studio` | Unlimited core generation, unlimited scheduled posts, admin-managed team operations, API + webhooks, unlimited brand kits, priority support |

Current monthly pricing:
- Starter: `$9 / ₹699`
- Creator: `$18 / ₹1499`
- Studio: `$45 / ₹3599`

Studio packaging boundary:
- Studio is the current team-facing package for admin-managed workspace operations.
- It includes multi-operator packaging, developer entitlements, and support commitments.
- It does **not** claim full self-serve RBAC or approval workflows as GA yet.

### 9.2 Credits System
- `User.creditsRemaining` tracked in DB
- `UsageLog` table records per-feature credit consumption
- Features tracked: `script-generation`, `script-tts`, `hooksmith`, `keyword-search`, `thumbnail-generate`, `imagen-generate`, `veo-generate`, `snipradar-reply-assist`, `snipradar-remix`

### 9.3 Razorpay Integration
- `User.billingProvider`, `User.razorpayCustomerId`, and `User.razorpaySubscriptionId` store Razorpay linkage
- Subscription state tracked in `User.subscriptionStatus`, `User.subscriptionTier`, `User.billingCycle`, `User.subscriptionCurrentStart`, and `User.subscriptionCurrentEnd`
- Webhook delivery persisted in `RazorpayWebhookEvent`
- Upgrade prompts shown in-product when limits are hit

---

## 10. Feature Flag System

All flags in `apps/web/lib/feature-flags.ts`, read from environment variables:

| Flag | Env Var | Default | Controls |
|------|---------|---------|---------|
| `uiV2Enabled` | `UI_V2_ENABLED` | `false` | Legacy V1/V2 UI toggle |
| `transcribeUiEnabled` | `TRANSCRIBE_UI_ENABLED` | `false` | Transcribe workspace |
| `imagenEnabled` | `IMAGEN_ENABLED` | `false` | Google Imagen workspace |
| `veoEnabled` | `VEO_ENABLED` + `FORCE_VEO_ENABLED` | `false` | Google Veo (double-guarded) |
| `soraEnabled` | `SORA_ENABLED` | `false` | Sora integration (future) |
| `voicerEnabled` | `VOICER_ENABLED` | `true` | ElevenLabs Voicer |
| `snipRadarEnabled` | `SNIPRADAR_ENABLED` | `true` | Entire SnipRadar ecosystem |
| `snipRadarOverviewV2Enabled` | `SNIPRADAR_V2_OVERVIEW_ENABLED` | `true` | SnipRadar Overview v2 |
| `snipRadarAnalyticsV2Enabled` | `SNIPRADAR_V2_ANALYTICS_ENABLED` | `true` | Analytics v2 |
| `snipRadarCreateV2Enabled` | `SNIPRADAR_V2_CREATE_ENABLED` | `true` | Create page v2 |
| `snipRadarDiscoverV2Enabled` | `SNIPRADAR_V2_DISCOVER_ENABLED` | `true` | Discover page v2 |
| `snipRadarPublishV2Enabled` | `SNIPRADAR_V2_PUBLISH_ENABLED` | `true` | Publish page v2 |
| `snipRadarGrowthPlanV2Enabled` | `SNIPRADAR_V2_GROWTH_PLAN_ENABLED` | `true` | Growth Planner v2 |

---

### 10.1 Registry and Governance

The source-of-truth registry for env-driven app-shell flags is:

- `apps/web/lib/feature-flag-registry.ts`

Every registered flag has:
- owner
- stage
- default value
- description
- kill-switch behavior
- removal condition

### 10.2 Lifecycle Policy

Allowed flag stages:

- `experiment` — early validation; should graduate or be removed
- `beta` — limited rollout; still expected to move to GA or be retired
- `ga` — live by default; should be removed after stabilization unless there is a real need to keep it
- `kill_switch` — operational rollback control that may remain long term

Operational rules:
- GA flags should not stay in the system forever unless they still serve as real operational kill switches.
- Docs and `.env.example` must match the active registry-backed flag inventory.
- Supplemental guard envs such as `FORCE_VEO_ENABLED` are documented alongside the registry-backed flags, but the registry remains scoped to `apps/web/lib/feature-flags.ts`.

---

## 11. Privacy & Compliance Baseline

This PRD uses an **operational baseline** for privacy and compliance. It is the product-facing implementation contract, not a claim of full regulatory certification.

Supporting baseline:

- `docs/PRIVACY_COMPLIANCE_BASELINE.md`

### 11.1 Data Categories

- account identity and onboarding preferences
- connected-provider tokens and account identifiers
- uploaded media and creator project assets
- generated content such as scripts, titles, thumbnails, drafts, transcripts, translations, and replies
- billing identifiers and webhook reconciliation data
- usage logs, diagnostics, and job-status metadata

### 11.2 Third-Party Processors

The product may use:

- Supabase
- Vercel
- OpenRouter and routed model providers
- OpenAI direct APIs where still required
- Google APIs
- X
- Razorpay
- storage backends such as local storage, Supabase Storage, or S3-compatible object storage

### 11.3 Retention and Deletion Baseline

- Active account data is retained while the account remains active.
- User-managed assets and generated outputs are retained until the user deletes them, the related project is removed, or account-removal cleanup runs.
- Billing and webhook records may be retained longer for reconciliation, tax, fraud-prevention, and operational audit trails.
- Temporary FFmpeg and processing files are cleaned up on a best-effort basis after job completion or failure and may also be cleaned asynchronously.

### 11.4 Connected Account Consent

- Google, X, and other provider connections are user-initiated.
- Tokens are used only for enabled product workflows.
- Revoked or expired provider access requires re-authentication.
- Read-only/manual fallback flows should not store elevated credentials where they are not needed.

### 11.5 Account Removal Behavior

- Account removal should revoke or remove active product access and schedule cleanup of removable user-linked data.
- Some billing, reconciliation, fraud, or operational records may remain after account closure where legitimately required.
- Cleanup across storage and background-job artifacts may be asynchronous rather than instantaneous.

---

## 12. Implementation Status

### 12.1 Status Taxonomy

Allowed delivery statuses:

| Status | Meaning |
|--------|---------|
| `Scaffolded` | Structure exists, but the feature is not functionally complete. |
| `Built` | Core workflow works, but hardening, edge cases, or operational follow-up still remain. |
| `QA Complete` | Acceptance criteria and validation checks have passed, with failure states handled. |
| `Production Ready` | Rollback path, safeguards, and observability requirements are identified and no launch-blocking issues remain. |
| `Deferred` | Intentionally out of active scope. |

For this PRD, `Production Ready` requires:
- acceptance criteria met
- empty/error states handled
- rollback path known
- observability requirement identified
- no unresolved launch-blocking edge cases

### YouTube Creator Platform

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (Google OAuth, Email, Demo) | QA Complete | JWT strategy, signIn callback creates User + Account |
| Onboarding flow | QA Complete | Goal selection, niche interests, redirect to `/onboarding` |
| Activation instrumentation | QA Complete | UsageLog-backed checkpoints for onboarding, first idea, first script, first title, and first thumbnail |
| Dashboard | QA Complete | Server-rendered with unstable_cache |
| Niche Discovery | QA Complete | Quiz + niche cards with scores |
| Keyword Research | QA Complete | DataForSEO + YouTube API + heuristic fallback |
| Competitors | Built | Inngest sync, analytics, alerts |
| Content Calendar | QA Complete | AI generation + auto-schedule + per-idea CRUD |
| Script Generator | QA Complete | TipTap, versions, comments, sharing, TTS route exists |
| Script TTS (full UI) | QA Complete | Audio tab, voice selector, player, synthesize route, ScriptAudio persistence |
| Title Generator | QA Complete | AI titles, save/delete |
| Thumbnail Generator | Built | AI images (Imagen flag-gated) |
| Hooksmith | QA Complete | 8–10 hooks + script seed |
| RepurposeOS — Ingest | Built | YouTube ingest + file upload + highlight detection |
| RepurposeOS — Editor | Built | Preview, timeline, clips, captions, advanced features |
| RepurposeOS — Export | Built | 3 presets, caption burn-in, translations, voice dubbing |
| Brand Kit | QA Complete | Logo, colors, caption style, watermark |
| Projects | QA Complete | CRUD + asset/clip/export/script management |
| Voicer | Built | ElevenLabs TTS workspace (flag on) |
| Imagen | Built | Google Imagen (flag off by default) |
| Veo | Built | Google Veo (requires FORCE_VEO_ENABLED=true) |

### X Growth Platform (SnipRadar)

All 8 phases of the Vugola+ upgrade plan are implemented at `Built` or `QA Complete` status.

| Feature | Status | Notes |
|---------|--------|-------|
| X Account Connection | QA Complete | OAuth 2.0 PKCE + manual read-only fallback |
| Activation + cost instrumentation | QA Complete | Summary payload includes activation progression and X API guardrail model |
| Overview (hub) | QA Complete | Stats, coach, profile audit, nav cards |
| Discover — Tracker | QA Complete | Add/delete/fetch tracked accounts |
| Discover — Viral Feed | QA Complete | Filter, analyze, clear |
| Discover — Engagement | QA Complete | Opportunity finder + workflow |
| Create — Drafts | QA Complete | AI generation, predict, rewrite, schedule, post |
| Create — Thread Writer | QA Complete | AI threads, post to X |
| Create — Hook Generator | QA Complete | AI hook formats |
| Create — Templates | QA Complete | Library, remix, save |
| Create — Style Trainer | QA Complete | Profile analysis + storage |
| Publish — Scheduler | QA Complete | Calendar, drag-drop, retry |
| Publish — Best Times | QA Complete | AI heatmap |
| Analytics | QA Complete | Live metrics, patterns, AI summary |
| Research Inbox | QA Complete | Save, bulk triage, labels, reply/remix, author tracking |
| Relationships | QA Complete | Lead CRM auto-sync |
| Growth Planner | QA Complete | AI growth plan |
| Winner Loop Automation | Built | Derivative content generation |
| Profile Audit + Growth Score | QA Complete | AI audit + score delta |
| Public API + Webhooks | Built | Webhook CRUD + delivery log |
| SnipRadar Rate Limiting | QA Complete | In-memory rate limits + Retry-After headers |
| Scheduler reliability | QA Complete | Cron + retries + per-user fan-out |
| Analytics hardening | QA Complete | Centralized derivation, validated |
| Security hardening | QA Complete | Rate limits, constant-time secret comparison |
| UX Polish (Phase 8) | QA Complete | Empty states, recovery states, launch playbook |

### Browser Extension

| Feature | Status | Notes |
|---------|--------|-------|
| Save tweet to inbox | QA Complete | |
| Reply Assist (inline panel) | Built | AI via gpt-5-mini; same-page composer insertion is implemented and under live-X hardening |
| Remix (inline panel) | Built | |
| Track author | QA Complete | |
| Saved-state feedback | QA Complete | `data-snipradar-saved` attribute |
| Popup cleanup | QA Complete | Dev-only URL override via Shift+D |
| Notification icon | QA Complete | Real icons in manifest |
| Engagement metrics capture | Built | Scrapes DOM metrics and stores them in capture metadata |
| Full thread capture | Built | Multi-post structure stored in `metadata.posts` |
| Extension badge counter | QA Complete | Badge polling via service worker |
| Keyboard shortcuts | QA Complete | Manifest commands + content-script handler |
| Quick Draft in popup | Built | `POST /api/snipradar/extension/draft` |
| In-extension auth popup | Built | Popup auth window flow |
| Firefox support | Deferred | webextension-polyfill migration |
| Chrome Web Store | Deferred | Final icons, descriptions, packaging |

---

## 13. Pending Roadmap

### High Priority (Next Sprint)

#### 1. Browser Extension — Production Hardening
- Tighten same-page reply insertion reliability across X composer variants.
- Keep improving reply specificity/relevance selection from source-post analysis.
- Surface captured DOM engagement metrics and thread metadata in the Research Inbox UI.
- Add stronger live-X smoke coverage for extension capture/reply flows.

**Files**: `apps/browser-extension/content-script.js`, `apps/browser-extension/service-worker.js`, `apps/web/lib/ai/snipradar-extension.ts`, `apps/web/app/(workspace)/snipradar/inbox/page.tsx`

#### 2. Keyword Research Upgrade (v2)
- **Phase 1**: Richer expansion strategies (question, intent, alphabet-soup), freshness timestamps, cache policy by signal type.
- **Phase 2**: Weighted scoring model v2 with factor attribution (`scoreBreakdown`), confidence penalty.
- **Phase 3**: Cluster intelligence, cluster-first UI, one-click handoff to title/script/thumbnail/draft generators.
- **Phase 4**: Closed-loop learning from downstream post performance.
- **Phase 5**: Latency budgets, queuing for heavy requests, background refresh.
- **Phase 6**: Monetization gating (free/creator/studio limits), upgrade prompts.

#### 3. X-to-Content Flywheel (Deferred — strategic)
- Convert winning X posts → Hooksmith hooks, script briefs, content calendar entries, RepurposeOS clip prompts.
- Convert RepurposeOS clips + Hooksmith scripts → X threads and post sequences.
- Shared content entity linking `TweetDraft`, scripts, hooks, clips, and content ideas.
- Positioning shift: from "X tool + YouTube tool" to "full creator growth operating system."
### Medium Priority

#### 4. Browser Extension — P3 Distribution
- **Firefox support**: Add `webextension-polyfill`, migrate `chrome.*` → browser-compatible APIs.
- **Chrome Web Store**: Finalize icons, descriptions, screenshots, permissions review, packaging, submission.

### Low Priority / Future

#### 7. SnipRadar Phase 4 UX Enhancements
- Content Calendar V2 (week/month drag-drop grid).
- Engagement Finder V2 (ranking, saved opportunities, status workflow).
- Viral templates expansion (100+ curated templates).
- Unified platform switch shell (X / YouTube) with shared visual pattern.

#### 8. Multi-Language TTS (Script Generator)
- Extend TTS to 50+ languages via OpenAI TTS native support.
- Language selector in Voice tab of Script Generator.

#### 9. Sora Integration (Flag-Gated)
- Sora video generation workspace (`/video` route + `SORA_ENABLED` flag).
- Currently stubbed with flag but no active implementation.

#### 10. Additional Browser Extension UX Experiments
- Multi-option reply picker
- Collection/folder save flows from the timeline
- On-page profile intelligence overlays

---

## 14. Engineering Standards

### Code Quality
- TypeScript strict mode throughout — zero `any` types.
- Every form: `react-hook-form` + Zod schema.
- Server components by default; `use client` only for interactivity.
- API contracts validated with Zod on every endpoint.

### Data Fetching
- Skeleton loaders while fetching from server.
- Error handling with toast notifications on all mutations.
- TanStack Query v5 for all client-side fetching (30s stale time default).
- `unstable_cache` for server-side dashboard queries (60s revalidation).

### API Standards
- All routes enforce authentication (`getCurrentUser` / `getCurrentDbUser`).
- User-specific data isolation enforced in every query (`userId` filter).
- Standardized `ApiResponseBuilder` response format.
- Rate limiting for AI endpoints (`lib/snipradar/request-guards.ts` for SnipRadar).
- Structured error handling with typed `AppError` class.

### Database
- Prisma ORM as schema source of truth.
- All critical indexes defined in schema.
- DI container (`InversifyJS`) for clean dependency injection.
- Repository pattern with interface abstractions for all domain entities.

### Testing
- Jest unit tests: domain services, use cases, repositories, analytics.
- Playwright E2E: smoke tests for critical user paths.
- Browser extension: `node --check` syntax validation on all JS files.

### Background Jobs
- Product background work is currently split between Inngest and `@clippers/jobs`.
- Inngest handles event-driven and cron-oriented product workflows.
- `@clippers/jobs` currently handles FFmpeg-backed media processing in a transitional in-process runtime.
- Every job: status progression, retry logic, actionable failure messages.
- Cron endpoints protected with constant-time secret comparison.

### Security
- No hardcoded credentials; all secrets via `.env`.
- Input validation at all API boundaries with Zod.
- AI endpoints rate-limited with burst + daily window policies.
- `Retry-After` headers on rate-limited responses.
- Ownership guards on all mutations (user can only modify their own data).

### 14.1 Responsive Support Matrix

Canonical source of truth: `apps/web/lib/platform/responsive-support-matrix.ts`

| Surface | Support Level | Notes |
|---------|---------------|-------|
| Marketing + Pricing | Mobile Supported | Core acquisition surface; expected to convert cold mobile traffic |
| Creator Dashboard | Mobile Supported | Cards and activity panels collapse cleanly |
| Content Calendar | Mobile Degraded | Works on smaller widths, but planning density still favors desktop |
| Script Generator | Mobile Degraded | Generation works, but editor/revision workflows remain desktop-leaning |
| Thumbnail Generator | Mobile Supported | Single-column form/results flow remains usable |
| SnipRadar Overview | Mobile Supported | Overview cards and activation guidance stack vertically |
| SnipRadar Create | Mobile Degraded | Dense drafting/predictor flows still fit desktop better |
| SnipRadar Inbox | Mobile Degraded | Triage works; long capture review still needs more mobile polish |
| RepurposeOS Ingest | Mobile Degraded | Entry flow renders, but media-heavy ingest is still desktop-biased |
| RepurposeOS Editor | Desktop Only | Transcript editing, preview, and clip controls need desktop interaction density |
| RepurposeOS Export | Desktop Only | Export and translation configuration remain operationally desktop-first |

Desktop-only is an explicit product exception, not an accessibility exception.

### 14.2 Accessibility Baseline

Canonical source of truth: `apps/web/lib/platform/accessibility-standards.ts`

**Minimum target:** `WCAG 2.1 AA`

Before a feature is marked `QA Complete` or `Production Ready`, the relevant surface should account for:

- semantic landmarks and heading order
- keyboard navigation
- visible focus states
- color contrast
- form labels and accessible error messaging
- dialog and overlay focus management
- non-text alternatives for meaningful visuals
- reduced-motion support
- touch target spacing on mobile-supported surfaces

Desktop-only workflows are still expected to meet keyboard, focus, contrast, dialog, and semantic labeling requirements.

### 14.3 Performance Standards

Canonical source of truth: `apps/web/lib/platform/performance-standards.ts`

#### API latency budgets

| Class | p50 | p95 |
|-------|-----|-----|
| Marketing / pricing read | 300ms | 1000ms |
| Workspace summary read | 800ms | 2000ms |
| Keyword search read | 1000ms | 2500ms |
| SnipRadar summary read | 700ms | 1500ms |
| Interactive generation mutation | 1500ms | 5000ms |
| Job status refresh | 500ms | 1500ms |

#### Long-running job expectations

| Job | Mode | Ack | Target | Max |
|-----|------|-----|--------|-----|
| SnipRadar profile audit | Sync | N/A | 15s | 30s |
| Research Copilot query + brief | Sync | N/A | 8s | 15s |
| Script generation | Sync | N/A | 20s | 45s |
| Thumbnail generation | Sync | N/A | 30s | 90s |
| Research index refresh | Async | 5s | 90s | 5m |
| Export render | Async | 5s | 10m | 30m |
| Voice translation | Async | 5s | 15m | 40m |

If the p95 user wait exceeds 5 seconds, the workflow should acknowledge quickly and continue through a visible job/status flow rather than block silently.

### 14.4 Observability Standards

Canonical source of truth: `apps/web/lib/platform/observability-standards.ts`

The current platform observability stack is intentionally lightweight but explicit:

- **Error tracking:** structured server logs via `apps/web/lib/logger.ts` plus route/job failure logging
- **Performance monitoring:** `Server-Timing` headers, keyword runtime SLO collector, SnipRadar API telemetry, and load scripts
- **Product analytics:** `trackEvent(...)` plus `UsageLog`-backed activation checkpoints
- **Alert ownership:** named owners for platform, creator, growth, media-processing, and billing domains

`Production Ready` requires both an observability path and an alert owner for the relevant domain.

---

## 15. Key File Reference

### Entry Points
| Purpose | Path |
|---------|------|
| App layout | `apps/web/app/layout.tsx` |
| Workspace layout | `apps/web/app/(workspace)/layout.tsx` |
| Auth config | `apps/web/lib/auth.ts` |
| DB client | `apps/web/lib/prisma.ts` |
| DB schema | `apps/web/prisma/schema.prisma` |
| Feature flags | `apps/web/lib/feature-flags.ts` |
| Feature flag registry | `apps/web/lib/feature-flag-registry.ts` |
| Delivery status taxonomy | `apps/web/lib/platform/delivery-status.ts` |
| Media runtime profile | `apps/web/lib/platform/media-processing-runtime.ts` |
| Responsive support matrix | `apps/web/lib/platform/responsive-support-matrix.ts` |
| Accessibility baseline | `apps/web/lib/platform/accessibility-standards.ts` |
| Performance standards | `apps/web/lib/platform/performance-standards.ts` |
| Observability standards | `apps/web/lib/platform/observability-standards.ts` |
| Middleware (route protection) | `apps/web/middleware.ts` |
| Inngest client | `apps/web/lib/inngest/client.ts` |
| Inngest functions | `apps/web/lib/inngest/functions.ts` |

### YouTube Creator
| Purpose | Path |
|---------|------|
| Keyword orchestrator | `apps/web/lib/keywords/keyword-research-orchestrator.ts` |
| Repurpose context | `apps/web/components/repurpose/repurpose-context.tsx` |
| Caption service | `apps/web/lib/services/caption.service.ts` |
| Virality service | `apps/web/lib/services/virality.service.ts` |
| Auto-highlights use case | `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts` |
| DI container | `apps/web/lib/infrastructure/di/container.ts` |
| Video storage | `apps/web/lib/infrastructure/services/VideoStorageService.ts` |
| FFmpeg utils | `apps/web/lib/ffmpeg.ts` |

### SnipRadar / X
| Purpose | Path |
|---------|------|
| Activation model + logger | `apps/web/lib/analytics/activation.ts` |
| SnipRadar context | `apps/web/components/snipradar/snipradar-context.tsx` |
| AI extension module | `apps/web/lib/ai/snipradar-extension.ts` |
| Analytics derivation | `apps/web/lib/snipradar/analytics.ts` |
| Rate limiting guards | `apps/web/lib/snipradar/request-guards.ts` |
| Inbox business logic | `apps/web/lib/snipradar/inbox.ts` |
| Style profile | `apps/web/lib/snipradar/style-profile.ts` |
| Relationship graph | `apps/web/lib/snipradar/relationship-graph.ts` |
| X unit economics model | `apps/web/lib/snipradar/x-unit-economics.ts` |
| X API client | `apps/web/lib/integrations/x-api.ts` |
| SnipRadar constants | `apps/web/lib/constants/snipradar.ts` |

### Browser Extension
| Purpose | Path |
|---------|------|
| Content script | `apps/browser-extension/content-script.js` |
| Service worker | `apps/browser-extension/service-worker.js` |
| Popup | `apps/browser-extension/popup.js` + `popup.html` |
| Manifest | `apps/browser-extension/manifest.json` |
| Styles | `apps/browser-extension/content-script.css` + `popup.css` |

### Key API Route Groups
| Group | Base Path |
|-------|----------|
| Auth | `app/api/auth/` |
| Projects + Clips | `app/api/projects/`, `app/api/clips/` |
| Repurpose | `app/api/repurpose/` |
| Keywords | `app/api/keywords/` |
| Scripts | `app/api/scripts/` |
| Titles + Thumbnails | `app/api/titles/`, `app/api/thumbnails/` |
| Competitors | `app/api/competitors/` |
| Content Calendar | `app/api/content-calendar/` |
| SnipRadar | `app/api/snipradar/` |
| Voicer / Imagen / Veo | `app/api/voicer/`, `app/api/imagen/`, `app/api/veo/` |
| Translations | `app/api/translations/`, `app/api/voice-translations/` |
| Brand Kit | `app/api/brand-kit/` |
| Exports | `app/api/exports/` |
| Ecosystem | `app/api/ecosystem/` |
| Onboarding | `app/api/onboarding/` |

---

*Last updated: March 2026*
*Source: Full codebase analysis — `apps/web/`, `apps/browser-extension/`, `docs/`, `packages/`*
