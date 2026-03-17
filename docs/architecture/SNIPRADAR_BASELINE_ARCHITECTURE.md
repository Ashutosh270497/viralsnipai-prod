# SnipRadar Baseline Architecture (Phase 0)

Last updated: 2026-02-24
Owner: Super Agent (Codex)

## 1) Product Surface (Current)

SnipRadar currently ships as a multi-page workspace flow:
1. `overview`
2. `discover` (tracker, viral feed, engagement)
3. `create` (draft studio, templates, hooks, threads, style)
4. `publish` (scheduler + best-time)
5. `analytics`
6. `growth-planner`

Primary UI entrypoints:
1. `apps/web/app/(workspace)/snipradar/layout.tsx`
2. `apps/web/app/(workspace)/snipradar/overview/page.tsx`
3. `apps/web/app/(workspace)/snipradar/discover/page.tsx`
4. `apps/web/app/(workspace)/snipradar/create/page.tsx`
5. `apps/web/app/(workspace)/snipradar/publish/page.tsx`
6. `apps/web/app/(workspace)/snipradar/analytics/page.tsx`

Primary components:
1. `apps/web/components/snipradar/snipradar-context.tsx`
2. `apps/web/components/snipradar/growth-stats.tsx`
3. `apps/web/components/snipradar/engagement-finder.tsx`
4. `apps/web/components/snipradar/thread-composer.tsx`
5. `apps/web/components/snipradar/scheduler-calendar.tsx`
6. `apps/web/components/snipradar/analytics/post-performance-table.tsx`

## 2) Runtime Architecture

### Presentation Layer
1. Next.js App Router pages + client components.
2. TanStack Query for fetch/mutation orchestration and cache invalidation.
3. SnipRadar context as shared state contract for counts, stats, auth state.

### API Layer
1. Route handlers under `apps/web/app/api/snipradar/**`.
2. Route groups cover account auth, discovery, drafting, scheduling, analytics, maintenance.
3. Server timing and telemetry are emitted on critical paths.

### Domain/Service Layer
1. `apps/web/lib/snipradar/x-auth.ts`:
   - token refresh/retry wrappers for X API calls.
2. `apps/web/lib/snipradar/scheduler.ts`:
   - scheduled draft posting flow, retry behavior, run tracking.
3. `apps/web/lib/snipradar/maintenance.ts`:
   - metric hydration + data repair.
4. `apps/web/lib/snipradar/db-resilience.ts`:
   - defensive wrappers for transient DB failures.
5. `apps/web/lib/integrations/x-api.ts`:
   - upstream X API read/write integration.

### Data Layer
Primary Prisma models (SnipRadar):
1. `XAccount`
2. `XAccountSnapshot`
3. `XTrackedAccount`
4. `ViralTweet`
5. `TweetDraft`
6. `XStyleProfile`
7. `XSchedulerRun`
8. `XEngagementOpportunity`
9. `ViralTemplate`

Schema source:
1. `apps/web/prisma/schema.prisma` (SnipRadar block starts near `model XAccount`).

## 3) Core Execution Flows (Current)

### Flow A: Account Connect and Health
1. User connects X from SnipRadar layout/dialog.
2. OAuth callback stores account and tokens.
3. Layout renders auth status, reconnect guard when token is stale/invalid.
4. Summary/metrics APIs expose auth state for UI recovery.

### Flow B: Discover -> Analyze -> Generate
1. Track accounts (`/api/snipradar/accounts`).
2. Fetch viral tweets (`/api/snipradar/viral`).
3. Analyze patterns (`/api/snipradar/viral/analyze`).
4. Generate drafts/hooks/threads (`/api/snipradar/drafts`, `/hooks/generate`, `/threads/generate`).

### Flow C: Publish and Scheduler
1. Draft status transitions from `draft` -> `scheduled` -> `posted`.
2. Scheduler processor endpoint posts due drafts.
3. Scheduler run telemetry is persisted and queryable.
4. Maintenance endpoint repairs stale/partial state.

### Flow D: Analytics
1. Metrics endpoint aggregates posts/impressions/engagement.
2. Post-performance table uses persisted draft metrics and live hydration.
3. Best-time endpoint calculates scheduling windows.

## 4) Baseline Reliability Status (Today)

Validation completed:
1. `pnpm --filter web run snipradar:verify` passed (lint + typecheck + prisma validate).
2. `BASE_URL=http://localhost:3001 pnpm --filter web run snipradar:smoke` passed.
3. `BASE_URL=http://localhost:3001 pnpm --filter web exec node scripts/snipradar-auth-e2e.js` passed.

Coverage details:
1. Auth E2E now seeds deterministic posting fixtures for demo user before assertions.
2. Posting/thread branches are contract-tested (non-skip) with expected fallback path:
   - `single-post -> 403 OAUTH_REQUIRED`
   - `thread-post -> 403 OAUTH_REQUIRED`

## 5) Phase 2 Kickoff Contract (Transcript-Video Sync)

This phase is shared with Repurpose execution blockers and is now in progress.

1. Canonical timeline source:
   - Persisted clip timing (`Clip.startMs`, `Clip.endMs`) remains source of truth.
   - Transcript edits must produce deterministic timeline normalization without changing source media timestamps.
2. Edit invariants:
   - Removed transcript ranges must map to valid clip ranges.
   - No negative duration segments.
   - Monotonic time ordering after every edit mutation.
3. API behavior:
   - Transcript edit endpoints must return normalized clip/transcript payload in a single response.
   - Export pipeline consumes normalized payload only (no client-side recompute as source of truth).
4. Acceptance gate:
   - A transcript edit followed by preview/export must keep visible video timing and transcript state synchronized.

## 6) Gaps to Close (Phase 1+)

1. Consistent auth recovery UX across all route surfaces (no silent 401 paths).
2. Stronger DB session-pool protection for high fanout operations.
3. Post/reply analytics parity + live impression confidence controls.
4. Contract-level tests on critical APIs to prevent regressions.
5. Scheduler throughput hardening under concurrent users.
