# Codex Feature Improvement PRD

## Document Control
- Name: `codex_feature_improve.md`
- Product: ViralSnipAI
- Date: February 11, 2026
- Author: Codex
- Context: Competitive replication and improvement plan inspired by VugolaAI public positioning

## Executive Summary
ViralSnipAI already has most of the infrastructure needed to surpass VugolaAI. The gap is not core capability; it is workflow unification and automation. This PRD defines a single publish pipeline that unifies clip creation, captioning, scheduling, posting, and post-performance feedback loops.

## Product Goals
1. Reduce time from source video to first published short to under 10 minutes.
2. Convert current feature silos into one connected publishing workflow.
3. Add reliable scheduled auto-posting (not just manual post from drafts).
4. Replace opaque virality scoring with explainable, actionable scoring.
5. Expand from X-only posting to a platform adapter architecture.

## Non-Goals
1. Building a full social media analytics suite in v1.
2. Supporting all platforms at launch.
3. Rewriting existing repurpose UI from scratch.

## Current State (Already in Codebase)
1. Clip + caption pipeline exists in repurpose stack.
2. X OAuth and posting exist.
3. Background workers exist via Inngest.
4. Scheduling primitives exist (`scheduledFor`) but no automated dispatcher for due posts.

### Key Existing Files
- `apps/web/components/repurpose/repurpose-workspace.tsx`
- `apps/web/lib/ffmpeg.ts`
- `apps/web/lib/youtube-ingest-queue.ts`
- `apps/web/app/api/x-radar/callback/route.ts`
- `apps/web/app/api/x-radar/drafts/[id]/post/route.ts`
- `apps/web/lib/inngest/functions.ts`
- `apps/web/prisma/schema.prisma`

## Problem Statement
Current implementation is feature-complete in parts but fragmented across separate routes and models. Users can generate, edit, and post, but cannot execute a unified end-to-end publishing pipeline with deterministic status and automated scheduling.

## Proposed Solution
Build a unified `Publish Pipeline` domain that tracks each item from asset to posted content with per-channel job states.

## Core Feature Set

### 1) Unified Publish Pipeline
1. Introduce a `PublishJob` model to represent a single publishable unit.
2. Introduce `PublishTarget` rows per platform/channel.
3. Standardize statuses across stages: `draft`, `queued`, `processing`, `ready`, `scheduled`, `posting`, `posted`, `failed`.
4. Persist structured failure reason and retry metadata.

### 2) Scheduled Auto-Posting Dispatcher
1. Add Inngest cron function to scan due `PublishTarget` rows.
2. For each due item, call provider adapter `publish()`.
3. Retry transient failures with capped exponential backoff.
4. Write idempotency keys to avoid duplicate posting.

### 3) Explainable Virality Scoring
1. Add composite scoring with weighted components:
2. `hookScore`
3. `retentionScore`
4. `ctaScore`
5. `platformFitScore`
6. `trendScore`
7. Persist score breakdown JSON and top recommendations.

### 4) Multi-Platform Provider Adapters
1. Define provider interface: `publish`, `refreshAuth`, `fetchMetrics`, `validatePayload`.
2. Keep X provider as first adapter implementation.
3. Add YouTube Shorts provider second.
4. Leave Instagram/TikTok as phase-gated adapters.

### 5) Prompt Packs + Brand-Aware Templates
1. Store reusable prompt packs per niche and platform.
2. Support team-level prompt pack defaults.
3. Auto-apply Brand Kit and tone presets in generation requests.

### 6) Onboarding to First Publish in <10 Minutes
1. Add onboarding wizard flow:
2. Connect account.
3. Import one source asset.
4. Generate 3 clips.
5. Approve one draft.
6. Publish or schedule.

## Functional Requirements
1. User can create a publish job from clip editor in one action.
2. User can add one or more targets (`x`, `youtube_shorts`) to same job.
3. User can schedule per target with timezone-safe timestamps.
4. System auto-posts due targets without manual action.
5. User can monitor pipeline state from one status view.
6. System fetches post metrics and backfills actual performance.
7. Virality score shows breakdown and improvement suggestions.
8. Prompt packs can be created, versioned, and reused.

## Non-Functional Requirements
1. Posting reliability target: 99% success for valid payloads.
2. Scheduling jitter: less than 2 minutes for due jobs.
3. Idempotent post attempts per target.
4. Full audit log for posting attempts and token refresh events.
5. P95 API read latency for pipeline dashboard under 500ms.

## Data Model Changes (Prisma)

### New Models
1. `PublishJob`
2. `PublishTarget`
3. `PublishAttempt`
4. `PromptPack`
5. `PromptPackVersion`

### Suggested Fields
1. `PublishJob`: `id`, `userId`, `projectId`, `clipId`, `status`, `viralityBreakdown`, `createdAt`, `updatedAt`
2. `PublishTarget`: `id`, `publishJobId`, `platform`, `accountRef`, `scheduledFor`, `status`, `externalPostId`, `lastError`, `retryCount`
3. `PublishAttempt`: `id`, `publishTargetId`, `attemptedAt`, `success`, `errorCode`, `errorMessage`, `requestSnapshot`, `responseSnapshot`
4. `PromptPack`: `id`, `userId`, `name`, `niche`, `platform`, `isDefault`, `createdAt`
5. `PromptPackVersion`: `id`, `promptPackId`, `version`, `systemPrompt`, `userPromptTemplate`, `weightsJson`, `createdAt`

## API Surface

### New Endpoints
1. `POST /api/publish-jobs`
2. `GET /api/publish-jobs`
3. `GET /api/publish-jobs/[id]`
4. `PATCH /api/publish-jobs/[id]`
5. `POST /api/publish-jobs/[id]/targets`
6. `PATCH /api/publish-targets/[id]`
7. `POST /api/publish-targets/[id]/retry`
8. `POST /api/prompt-packs`
9. `GET /api/prompt-packs`
10. `PATCH /api/prompt-packs/[id]`

### Existing Endpoints to Refactor
1. `POST /api/x-radar/drafts/[id]/post` should call adapter via publish service.
2. `POST /api/x-radar/drafts` should optionally create `PublishJob` records.

## Background Jobs (Inngest)
1. `publish-dispatcher-cron` every 1 minute.
2. `publish-target-post` event-driven worker.
3. `publish-target-metrics-backfill` at +24h from posting.
4. `auth-token-refresh` preflight worker for near-expiry targets.

## UX Requirements
1. Single “Publish Pipeline” tab in workspace.
2. Status timeline per job.
3. Per-target chips with schedule and retry.
4. Inline error states with one-click retry.
5. Score breakdown card with recommended actions.
6. Prompt pack selector in generation dialogs.

## Rollout Plan

### Phase 1 (Week 1)
1. Schema changes + migrations.
2. Publish domain services and status enums.
3. Basic pipeline API read/write.

### Phase 2 (Week 2)
1. X adapter extraction.
2. Scheduled dispatcher + retries.
3. Pipeline status UI.

### Phase 3 (Week 3)
1. Virality breakdown model and UI.
2. Metrics feedback loop integration.
3. Prompt pack CRUD + apply flow.

### Phase 4 (Week 4)
1. YouTube Shorts adapter.
2. Onboarding-first-publish flow.
3. Load and reliability hardening.

## Success Metrics
1. Time to first publish median under 10 minutes.
2. Scheduled posts success rate over 95% in first release and over 99% after hardening.
3. Percentage of active users using scheduling over 40% within 30 days.
4. Percentage of generated drafts that become posted over 25%.
5. Week-4 retention lift for publishing users over baseline.

## Risks and Mitigations
1. API policy/rate limits across social platforms.
2. Mitigation: queue backpressure, exponential retry, platform-specific throttling.
3. Token expiry and revoked auth.
4. Mitigation: preflight refresh + reconnect UX + attempt audit logs.
5. Duplicate post hazards.
6. Mitigation: strict idempotency key enforcement on `PublishTarget`.

## Open Questions
1. Which second platform should be prioritized after X: YouTube Shorts or Instagram Reels?
2. Should prompt packs be workspace-scoped or user-scoped by default?
3. What plan tiers should unlock multi-platform scheduling and advanced score analytics?

## Implementation Touchpoints
1. `apps/web/prisma/schema.prisma` for new models and enums.
2. `apps/web/lib/inngest/functions.ts` for cron dispatcher and post workers.
3. `apps/web/lib/integrations/x-api.ts` for adapter compliance.
4. `apps/web/app/api/x-radar/drafts/[id]/post/route.ts` for service migration.
5. `apps/web/components/repurpose/repurpose-workspace.tsx` for publish job creation entry.
6. `apps/web/app/(workspace)/x-radar/page.tsx` for pipeline states migration.

## Definition of Done
1. User can create, schedule, and auto-post from one pipeline UI.
2. Due jobs are posted automatically without manual API trigger.
3. Failed targets can be retried with full visibility of failure reason.
4. Virality score explains component breakdown and recommendations.
5. Metrics are backfilled and connected to future draft generation.
6. End-to-end tests cover create -> schedule -> dispatch -> posted lifecycle.
