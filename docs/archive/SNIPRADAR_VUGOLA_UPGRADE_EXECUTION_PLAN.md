# SnipRadar Upgrade Execution Plan (Vugola+ Baseline)

## Objective
Build SnipRadar into a production-grade, end-to-end creator platform that is more reliable, faster, and more actionable than VugolaAI across ingest, editing, exporting, scheduling, and analytics.

## Success Criteria
1. Unified creator workflow: ingest -> clip/edit -> caption/overlay -> export -> schedule -> analytics.
2. Reliable operations: no silent failures, no stuck jobs, clear failure recovery paths.
3. Accurate intelligence: live X metrics for posts/replies with trusted calculations.
4. Fast user experience: optimized API reads and stable async processing for heavy operations.

## Execution Status (Live)
1. Phase 0: Completed
2. Phase 1: Completed
3. Phase 2: Completed
4. Phase 3: Completed
5. Phase 4: Completed
6. Phase 5: Completed
7. Phase 6: Completed
8. Phase 7: Completed
9. Phase 8: Completed

## Phase-Wise Execution

### Phase 0: Product + Technical Baseline (3-4 days)
Scope:
1. Finalize scope and KPI definitions for each feature surface.
2. Lock screen-by-screen UX flow and handoff notes.
3. Define canonical domain model:
   - Project
   - Asset
   - Clip
   - TranscriptToken
   - Overlay
   - ExportJob
   - ScheduleJob
   - PostMetrics
4. Freeze API contracts and migration strategy.

Deliverables:
1. Master PRD + architecture baseline.
2. Prioritized backlog with clear owners and dependencies.

Acceptance:
1. Approved architecture doc.
2. Approved API/data contract map.

---

### Phase 1: Platform Core Hardening (1 week)
Scope:
1. Harden auth/session/token refresh for X.
2. Enforce strict input validation and typed API responses.
3. Add observability:
   - request IDs
   - job IDs
   - structured logs
   - error taxonomy
4. DB hardening:
   - critical indexes
   - connection pool safety
   - retry/backoff patterns

Deliverables:
1. Stable auth and API foundation.
2. Operational logs for all critical flows.

Acceptance:
1. No auth dead-end paths.
2. No DB max-client regressions in normal traffic.

---

### Phase 2: Transcript-Video Sync Engine (1.5 weeks)
Scope:
1. Implement token-level transcript timeline mapping.
2. Bidirectional sync guarantees:
   - timeline trim updates transcript scope
   - transcript word deletion updates clip timing map
3. Caption quality tiering with usable score thresholds.

Deliverables:
1. Professional transcript-video sync behavior.

Acceptance:
1. No abrupt transcript/video mismatch after edits.
2. Word-level edits persist and reflect in playback.

---

### Phase 3: AI Clipping + Reframing Engine (1.5 weeks)
Scope:
1. Viral moment scoring with explainable signals.
2. Speaker/face-aware auto-reframing for:
   - 9:16
   - 1:1
   - 16:9
3. Clip constraint enforcement (duration, pacing, hard-cut guardrails).

Deliverables:
1. High-quality auto-clips ready for repurposing.
2. Deterministic reframe behavior applied in actual preview/export renders.
3. Motion-aware subject-lock reframing for moving speakers within the current FFmpeg pipeline.

Acceptance:
1. Better clip coherence and relevance versus baseline.
2. No broken framing in standard talking-head content.
3. Preview and export outputs honor stored ratio-specific reframe plans.
4. Speaker-focused portrait renders no longer rely on a static crop center.

---

### Phase 4: Caption + Overlay Studio (1 week)
Scope:
1. Clean single-transcript editing surface (reduce segment clutter).
2. Caption style presets + advanced controls:
   - position
   - size
   - emphasis
   - highlight colors
3. Timed hook overlays with layer and timing controls.

Deliverables:
1. Creator-grade caption/overlay editing experience.

Acceptance:
1. Caption edits are predictable and export-safe.
2. Overlay timing behavior is accurate in output renders.

Delivered:
1. Added typed caption and timed-hook overlay configuration with normalization/safe defaults.
2. Wired `captionStyle` persistence through clip contracts, editor state, and clip update API.
3. Added creator-facing caption/overlay studio controls in the transcript editor:
   - theme
   - position
   - font size
   - color controls
   - outline/background toggles
   - timed hook overlays with alignment/timing controls
4. Added live in-editor preview for active caption and timed hook overlays.
5. Applied styled caption burn-in and timed hook overlay rendering in the FFmpeg export pipeline.
6. Updated export UX/status copy so caption-off exports can still accurately communicate hook-overlay rendering behavior.
7. Added focused tests for style normalization and FFmpeg caption/overlay filter generation.

---

### Phase 5: Export & Scheduling Unification (1.5 weeks)
Scope:
1. Unified export card with ratio dropdown and caption toggle.
2. Render queue resilience:
   - staged progress
   - retries
   - explicit error reasons
3. Multi-platform scheduling with per-platform post customization.
4. Drag/drop calendar update flows.

Deliverables:
1. Deterministic export and scheduling pipeline.

Acceptance:
1. Export completion/failure status always visible.
2. Scheduled jobs persist and execute predictably.

---

### Phase 6: Analytics + Growth Intelligence (1 week)
Scope:
1. Live metric ingestion from X for posts and replies.
2. Date-range and type filters in post-performance analysis.
3. Insight modules:
   - top formats
   - best-time heatmap
   - AI summary

Deliverables:
1. Trustworthy analytics and recommendations.

Acceptance:
1. Impressions and engagement metrics match source expectations.
2. Filters return consistent results.

Execution Notes:
1. Shared analytics derivation is centralized in `apps/web/lib/snipradar/analytics.ts`.
2. `/api/snipradar/metrics` now derives hook, format, and emotion breakdowns from the creator's own post window rather than tracked-account viral-feed rows.
3. The analytics page uses practical window-level cards for posts tracked, replies tracked, total impressions, and average engagement rate.
4. AI summary and top post-type cards are server-derived instead of duplicated in the page.
5. Validation completed with:
   - `pnpm --filter web exec jest lib/snipradar/__tests__/analytics.test.ts --runInBand`
   - `pnpm --filter web run snipradar:verify`

---

### Phase 7: Scale, Security, and QA (1 week)
Scope:
1. Load testing for critical APIs and worker queues.
2. E2E automation for critical paths:
   - connect account
   - ingest/clip
   - export
   - schedule
   - analytics validation
3. Security hardening:
   - rate limits
   - secret handling
   - permission checks

Deliverables:
1. Launch-grade performance and reliability posture.

Acceptance:
1. Stable under target concurrent load.
2. No critical-severity security gaps in reviewed flows.

Execution Notes:
1. Shared SnipRadar route guards now back critical AI/write routes with consistent in-memory rate limiting and `Retry-After` headers.
2. Machine-only cron and maintenance endpoints now use constant-time secret comparison instead of plain string equality.
3. Smoke coverage now verifies protected cron behavior and includes more SnipRadar route families (`accounts`, `templates`, `style`).
4. Node load tooling now supports optional queue endpoint coverage through `SNIPRADAR_LOAD_INCLUDE_QUEUE=true`.
5. Focused validation completed:
   - `pnpm --filter web exec jest lib/snipradar/__tests__/request-guards.test.ts lib/snipradar/__tests__/analytics.test.ts lib/snipradar/__tests__/scheduler-recommendations.test.ts --runInBand`

---

### Phase 8: UX Polish + Launch Readiness (3-4 days)
Scope:
1. Final UX consistency pass across SnipRadar surfaces.
2. Improve empty states, recovery states, and onboarding clarity.
3. Remove debug artifacts from user-facing flows.
4. Produce launch, rollback, and monitoring checklist.

Deliverables:
1. Launch-grade empty/recovery states across the main SnipRadar workflow.
2. No visible debug artifacts in production flows.
3. Written release playbook for deploy, verification, rollback, and monitoring.

Acceptance:
1. No visible debug/perf artifacts in production build.
2. Core SnipRadar pages avoid flat placeholder copy for key no-data states.
3. Launch checklist exists and is actionable.

Execution Notes:
1. Removed the remaining OAuth debug log from `apps/web/app/api/snipradar/route.ts`.
2. Added reusable SnipRadar empty-state UI in `apps/web/components/snipradar/snipradar-empty-state.tsx`.
3. Upgraded no-data/recovery states on:
   - create
   - publish
   - discover
   - engagement
   - analytics
4. Added release operations playbook:
   - `docs/SNIPRADAR_LAUNCH_PLAYBOOK.md`
   - `pnpm --filter web run snipradar:verify`
   - `pnpm --filter web run snipradar:smoke`
   - `pnpm --filter web exec node scripts/snipradar-auth-e2e.js`
   - `SNIPRADAR_DEMO_LOGIN=true SNIPRADAR_LOAD_CONCURRENCY=5 SNIPRADAR_LOAD_ITERATIONS=2 SNIPRADAR_LOAD_INCLUDE_QUEUE=true pnpm --filter web exec node scripts/load/snipradar-api-load.js`

---

### Phase 8: UX Polish + Launch Readiness (4-5 days)
Scope:
1. Final UX consistency pass across SnipRadar surfaces.
2. Empty states, skeletons, and recovery states.
3. Remove debug artifacts and tighten onboarding clarity.
4. Launch playbook with rollback and monitoring checklist.

Deliverables:
1. Premium, launch-ready UX and operations pack.

Acceptance:
1. No visible debug/perf artifacts in production build.
2. Full launch checklist signed off.

## Parallel Delivery Model (4 Agents + Super Agent)
1. Agent A: Video, transcript, editing engine.
2. Agent B: Export pipeline, rendering, scheduler.
3. Agent C: Analytics and data ingestion reliability.
4. Agent D: UI/UX polish and QA automation.
5. Super Agent: Architecture guardrails, integration order, regression gates, release control.

## Global Quality Gates (Each Phase)
1. No breaking changes to existing critical user flows.
2. Typecheck, lint, and Prisma validation must pass.
3. Smoke + critical E2E paths must pass before merge.
4. Async jobs must provide status progression and actionable failure messages.

## Tracking Template (Per Phase)
Status: `Not Started | In Progress | Blocked | Completed`

1. Owner:
2. Start Date:
3. Target Date:
4. Dependencies:
5. Risks:
6. Validation Evidence:
7. Release Notes:
