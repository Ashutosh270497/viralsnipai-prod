# SnipRadar Execution Board (Active)

Single source of truth for the Vugola+ upgrade execution.

## Sprint Meta

- Sprint Name: `SnipRadar Vugola+ Upgrade`
- Start Date: `2026-02-24`
- Super Agent: `Codex`
- Release Target: `SnipRadar Production Upgrade RC`

## Phase Status

| Phase | Name | Status | Owner | Target |
| --- | --- | --- | --- | --- |
| 0 | Product + Technical Baseline | Completed | Super Agent | 2026-02-24 |
| 1 | Platform Core Hardening | Completed | Agent A + C | 2026-03-03 |
| 2 | Transcript-Video Sync Engine | Completed | Agent A + B | 2026-03-10 |
| 3 | AI Clipping + Reframing Engine | Completed | Agent A | 2026-03-17 |
| 4 | Caption + Overlay Studio | Completed | Agent B | 2026-03-24 |
| 5 | Export & Scheduling Unification | Completed | Agent C + B | 2026-03-31 |
| 6 | Analytics + Growth Intelligence | Completed | Agent C | 2026-04-07 |
| 7 | Scale, Security, and QA | Completed | Agent D | 2026-04-14 |
| 8 | UX Polish + Launch Readiness | Completed | Agent B + D | 2026-04-18 |

## Phase 8 Progress (Current)

1. Removed the remaining user-facing OAuth debug artifact from the SnipRadar connect route:
   - `apps/web/app/api/snipradar/route.ts`
2. Added a reusable polished empty-state component for SnipRadar recovery/no-data screens:
   - `apps/web/components/snipradar/snipradar-empty-state.tsx`
3. Upgraded flat no-data states in core launch surfaces:
   - `apps/web/app/(workspace)/snipradar/create/page.tsx`
   - `apps/web/app/(workspace)/snipradar/publish/page.tsx`
   - `apps/web/app/(workspace)/snipradar/discover/page.tsx`
   - `apps/web/components/snipradar/engagement-finder.tsx`
   - `apps/web/components/snipradar/analytics/post-performance-table.tsx`
   - `apps/web/components/snipradar/best-time-chart.tsx`
4. Added the launch/rollback/monitoring checklist:
   - `docs/SNIPRADAR_LAUNCH_PLAYBOOK.md`
5. Validation completed:
   - `pnpm --filter web run snipradar:verify` -> passed.
   - `pnpm --filter web exec jest lib/snipradar/__tests__/analytics.test.ts lib/snipradar/__tests__/request-guards.test.ts --runInBand` -> passed.

## Phase 0 Tasks

| ID | Task | Status | Output |
| --- | --- | --- | --- |
| SR-P0-001 | Create live execution tracking board | Completed | `docs/SNIPRADAR_EXECUTION_BOARD.active.md` |
| SR-P0-002 | Baseline architecture snapshot from live code | Completed | `docs/architecture/SNIPRADAR_BASELINE_ARCHITECTURE.md` |
| SR-P0-003 | API contract map freeze (current routes) | Completed | `docs/architecture/SNIPRADAR_API_CONTRACT_MAP.md` |
| SR-P0-004 | Baseline verification run (verify + smoke + auth e2e) | Completed | Validation evidence section |
| SR-P0-005 | Define Phase 1 hardening backlog with acceptance gates | Completed | Backlog section below |

## Validation Evidence (2026-02-24)

1. `pnpm --filter web run snipradar:verify` -> passed.
2. `BASE_URL=http://localhost:3001 pnpm --filter web run snipradar:smoke` -> passed.
3. `BASE_URL=http://localhost:3001 pnpm --filter web exec node scripts/snipradar-auth-e2e.js` -> passed.
4. Auth E2E limitation observed:
   - posting/thread branches skipped due to empty demo fixture (no connected X account/drafts).
5. Error contract checks now covered in auth E2E:
   - unauth metrics returns `UNAUTHORIZED`
   - missing draft post returns `NOT_FOUND`
   - invalid thread payload returns `BAD_REQUEST`
6. Posting-branch fixture seeding added to auth E2E:
   - `apps/web/scripts/snipradar-auth-e2e.js` now seeds deterministic demo drafts/thread group via Prisma before assertions.
   - posting/thread checks are no longer skip-based and now fail on unexpected status codes.
7. Static validation after fixture update:
   - `pnpm --filter web run snipradar:verify` -> passed.
   - `node --check apps/web/scripts/snipradar-auth-e2e.js` -> passed.
8. Live auth E2E rerun with posting/thread fixture branches:
   - `BASE_URL=http://localhost:3001 pnpm --filter web exec node scripts/snipradar-auth-e2e.js` -> passed.
   - Contract assertions observed: `single-post=403 OAUTH_REQUIRED`, `thread-post=403 OAUTH_REQUIRED`, `scheduler-process=200`.
9. Phase 2 normalization utility validation:
   - `pnpm --filter web exec jest lib/repurpose/__tests__/transcript-sync.test.ts --runInBand` -> passed.
   - `pnpm --filter web exec jest lib/domain/services/__tests__/CaptionGenerationService.test.ts --runInBand` -> passed.
10. Phase 2 transcript edit -> recompute contract validation:
   - `pnpm --filter web exec jest lib/application/use-cases/__tests__/UpdateClipUseCase.test.ts --runInBand` -> passed.
   - `/api/clips/:id` response now includes `normalizedTranscriptEditRangesMs`.
   - transcript editor uses server-normalized ranges for persistence after preview regeneration.
11. Auth recovery mitigation validation:
   - `apps/web/lib/snipradar/x-auth.ts` now applies proactive token refresh and 401 retry semantics for both read and post paths.
   - `apps/web/components/snipradar/snipradar-context.tsx` and `apps/web/app/(workspace)/snipradar/layout.tsx` surface reconnect-required recovery state instead of silent partial failures.
12. DB pool pressure mitigation validation:
   - `apps/web/lib/snipradar/db-resilience.ts` is adopted on high-fanout SnipRadar reads (`summary`, `metrics`, `discover-data`, `viral`) with transient saturation retry + jitter.
   - Existing `snipradar:verify`, smoke, and auth E2E runs completed against that retry path without regression.

## Phase 1 Progress (Current)

1. Added shared SnipRadar API error contract helper:
   - `apps/web/lib/snipradar/api-errors.ts`
2. Wired normalized error contract into core/high-impact routes:
   - `apps/web/app/api/snipradar/route.ts`
   - `apps/web/app/api/snipradar/metrics/route.ts`
   - `apps/web/app/api/snipradar/discover-data/route.ts`
   - `apps/web/app/api/snipradar/scheduled/process/route.ts`
   - `apps/web/app/api/snipradar/drafts/[id]/post/route.ts`
   - `apps/web/app/api/snipradar/threads/post/route.ts`
3. Re-ran verification after Phase 1 updates:
   - `pnpm --filter web run snipradar:verify` -> passed.
   - `BASE_URL=http://localhost:3001 pnpm --filter web run snipradar:smoke` -> passed.
   - `BASE_URL=http://localhost:3001 pnpm --filter web exec node scripts/snipradar-auth-e2e.js` -> passed.
4. Added DB saturation retry wrapper and route-level adoption:
   - `apps/web/lib/snipradar/db-resilience.ts`
   - retry integration in summary/metrics/discover/viral routes.
5. Added scheduler replay hardening:
   - stale `posting` recovery
   - duplicate guard on `postedTweetId`
   - auto-revert to `draft` on reconnect-required failures

## Phase 1 Backlog (Draft)

| ID | Task | File Targets | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| SR-P1-001 | Normalize auth failure contract across all SnipRadar APIs | `apps/web/app/api/snipradar/**/*.ts`, `apps/web/lib/snipradar/x-auth.ts` | P0 | SR-P0-003 | Completed |
| SR-P1-002 | Add connection-pool-safe DB access wrappers on high fanout routes | `apps/web/lib/snipradar/db-resilience.ts`, `apps/web/app/api/snipradar/viral/route.ts`, `apps/web/app/api/snipradar/metrics/route.ts`, `apps/web/app/api/snipradar/discover-data/route.ts` | P0 | SR-P0-002 | Completed |
| SR-P1-003 | Add contract tests for scheduler + posting mutation routes | `apps/web/scripts/snipradar-auth-e2e.js`, `apps/web/scripts/snipradar-smoke.js`, `apps/web/lib/__tests__/snipradar-api-contract.test.ts` | P0 | SR-P1-001 | Completed |
| SR-P1-004 | Add idempotency guardrails and replay-safe semantics for scheduler process | `apps/web/lib/snipradar/scheduler.ts`, `apps/web/app/api/snipradar/scheduled/process/route.ts`, `apps/web/app/api/snipradar/scheduled/cron/route.ts` | P0 | SR-P1-002 | Completed |
| SR-P1-005 | Add structured error codes for UI recovery (reauth, rate-limit, upstream-fail) | `apps/web/components/snipradar/snipradar-context.tsx`, `apps/web/app/(workspace)/snipradar/layout.tsx`, `apps/web/app/(workspace)/snipradar/analytics/page.tsx` | P1 | SR-P1-001 | Completed |
| SR-P1-006 | Add operational dashboards for run health + failure categories | `apps/web/app/(workspace)/snipradar/analytics/page.tsx`, `apps/web/components/snipradar/analytics/*`, `apps/web/app/api/snipradar/scheduled/runs/route.ts` | P1 | SR-P1-004 | Completed |

## Phase 2 Kickoff Backlog

| ID | Task | File Targets | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| SR-P2-001 | Define transcript-to-clip canonical mapping contract | `docs/architecture/SNIPRADAR_BASELINE_ARCHITECTURE.md`, `docs/architecture/SNIPRADAR_API_CONTRACT_MAP.md` | P0 | SR-P0-002 | Completed |
| SR-P2-002 | Add deterministic timeline normalization utility for clip/transcript operations | `apps/web/lib/repurpose/transcript-sync.ts`, `apps/web/lib/domain/services/CaptionGenerationService.ts` | P0 | SR-P2-001 | Completed |
| SR-P2-003 | Wire transcript-edit mutations to timeline recompute path | `apps/web/app/api/clips/[id]/route.ts`, `apps/web/components/repurpose/transcript-editor.tsx` | P0 | SR-P2-002 | Completed |

## Phase 3 Progress (Current)

1. Added deterministic clip scoring + reframing utility:
   - `apps/web/lib/repurpose/clip-optimization.ts`
2. Extended clip contracts with Phase 3 explainability metadata:
   - `apps/web/lib/types/clip.types.ts`
   - `apps/web/components/repurpose/types.ts`
3. Added source-geometry probing for reframe planning:
   - `apps/web/lib/ffmpeg.ts`
4. Updated clip extraction to prefer higher-quality overlapping candidates instead of earliest-start only:
   - `apps/web/lib/domain/services/ClipExtractionService.ts`
5. Wired quality signals + reframe plans into auto-highlight persistence:
   - `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts`
6. Surfaced Phase 3 clip-quality / cut-risk / portrait-reframe cards in editor:
   - `apps/web/app/(workspace)/repurpose/editor/page.tsx`
7. Added focused validation:
   - `pnpm --filter web exec jest lib/repurpose/__tests__/clip-optimization.test.ts --runInBand` -> passed.
   - `pnpm --filter web exec jest lib/domain/services/__tests__/ClipExtractionService.test.ts --runInBand` -> passed.
8. Added render-time preset/reframe filter generation for real clip outputs:
   - `apps/web/lib/ffmpeg.ts`
   - `apps/web/lib/domain/services/VideoExtractionService.ts`
9. Wired portrait-first preview generation through stored reframe plans:
   - `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts`
   - `apps/web/lib/application/use-cases/GenerateCaptionsUseCase.ts`
10. Wired export queue rendering through preset-matched reframe plans:
   - `apps/web/lib/render-queue.ts`
11. Added focused validation for render filter generation:
   - `pnpm --filter web exec jest lib/repurpose/__tests__/clip-optimization.test.ts lib/__tests__/ffmpeg-reframe.test.ts --runInBand` -> passed.
12. Added motion-aware subject-lock reframing for moving speakers inside the current FFmpeg pipeline:
   - `apps/web/lib/types/clip.types.ts`
   - `apps/web/lib/repurpose/clip-optimization.ts`
   - `apps/web/lib/ffmpeg.ts`
13. Strengthened Phase 3 validation for subject-lock planning + animated crop expressions:
   - `pnpm --filter web exec jest lib/repurpose/__tests__/clip-optimization.test.ts lib/__tests__/ffmpeg-reframe.test.ts --runInBand` -> passed.

## Phase 3 Backlog

| ID | Task | File Targets | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| SR-P3-001 | Add deterministic clip-quality scoring contract | `apps/web/lib/repurpose/clip-optimization.ts`, `apps/web/lib/types/clip.types.ts` | P0 | SR-P2-003 | Completed |
| SR-P3-002 | Add source-geometry probe + ratio-specific reframe plans | `apps/web/lib/ffmpeg.ts`, `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts` | P0 | SR-P3-001 | Completed |
| SR-P3-003 | Prefer stronger overlapping clips during normalization/deduplication | `apps/web/lib/domain/services/ClipExtractionService.ts` | P0 | SR-P3-001 | Completed |
| SR-P3-004 | Surface explainable clip-quality/reframe metadata in editor | `apps/web/app/(workspace)/repurpose/editor/page.tsx`, `apps/web/components/repurpose/types.ts` | P1 | SR-P3-002 | Completed |
| SR-P3-005 | Add focused Phase 3 tests for scoring + extraction ranking | `apps/web/lib/repurpose/__tests__/clip-optimization.test.ts`, `apps/web/lib/domain/services/__tests__/ClipExtractionService.test.ts` | P0 | SR-P3-003 | Completed |
| SR-P3-006 | Apply preset-aware reframe filters during preview and export rendering | `apps/web/lib/ffmpeg.ts`, `apps/web/lib/domain/services/VideoExtractionService.ts`, `apps/web/lib/render-queue.ts`, `apps/web/lib/application/use-cases/GenerateCaptionsUseCase.ts`, `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts` | P0 | SR-P3-002 | Completed |
| SR-P3-007 | Add focused tests for render filter generation + plan selection | `apps/web/lib/__tests__/ffmpeg-reframe.test.ts`, `apps/web/lib/repurpose/__tests__/clip-optimization.test.ts` | P1 | SR-P3-006 | Completed |
| SR-P3-008 | Add moving-speaker subject-lock reframing in the current FFmpeg pipeline | `apps/web/lib/types/clip.types.ts`, `apps/web/lib/repurpose/clip-optimization.ts`, `apps/web/lib/ffmpeg.ts` | P1 | SR-P3-006 | Completed |

## Phase 4 Progress (Current)

1. Added typed caption/overlay configuration and normalization helpers:
   - `apps/web/lib/repurpose/caption-style-config.ts`
2. Wired `captionStyle` through clip contracts, client types, and clip update mutation flow:
   - `apps/web/lib/types/clip.types.ts`
   - `apps/web/components/repurpose/types.ts`
   - `apps/web/lib/api/projects.ts`
   - `apps/web/app/api/clips/[id]/route.ts`
   - `apps/web/lib/application/use-cases/UpdateClipUseCase.ts`
3. Added creator-facing caption/overlay studio controls in the transcript editor:
   - `apps/web/components/repurpose/caption-overlay-studio.tsx`
   - `apps/web/components/repurpose/transcript-editor.tsx`
   - `apps/web/app/(workspace)/repurpose/editor/page.tsx`
4. Added live in-editor caption/hook preview behavior for current playback position:
   - `apps/web/components/repurpose/transcript-editor.tsx`
5. Added real FFmpeg render support for styled captions and timed hook overlays:
   - `apps/web/lib/ffmpeg.ts`
6. Wired export/render flows through stored caption style metadata:
   - `apps/web/lib/render-queue.ts`
   - `apps/web/components/repurpose/export-panel.tsx`
   - `apps/web/app/(workspace)/repurpose/export/page.tsx`
7. Added focused Phase 4 validation:
   - `pnpm --filter web exec jest lib/repurpose/__tests__/caption-style-config.test.ts lib/__tests__/ffmpeg-caption-overlay.test.ts --runInBand` -> passed.
   - `pnpm --filter web exec jest lib/application/use-cases/__tests__/UpdateClipUseCase.test.ts --runInBand` -> passed.
8. Touched-file compile scan for the Phase 4 slice is clean.
   - full repo `tsc --noEmit` still has unrelated pre-existing debt outside the Phase 4 file set.

## Phase 4 Backlog

| ID | Task | File Targets | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| SR-P4-001 | Add typed caption/overlay style config with safe normalization defaults | `apps/web/lib/repurpose/caption-style-config.ts`, `apps/web/lib/types/clip.types.ts`, `apps/web/components/repurpose/types.ts` | P0 | SR-P3-008 | Completed |
| SR-P4-002 | Wire caption style persistence through clip update API and client contracts | `apps/web/app/api/clips/[id]/route.ts`, `apps/web/lib/application/use-cases/UpdateClipUseCase.ts`, `apps/web/lib/api/projects.ts` | P0 | SR-P4-001 | Completed |
| SR-P4-003 | Build creator-facing caption + hook overlay studio controls inside transcript editor | `apps/web/components/repurpose/caption-overlay-studio.tsx`, `apps/web/components/repurpose/transcript-editor.tsx`, `apps/web/app/(workspace)/repurpose/editor/page.tsx` | P0 | SR-P4-002 | Completed |
| SR-P4-004 | Add live editor preview for active caption style and timed hook overlays | `apps/web/components/repurpose/transcript-editor.tsx` | P1 | SR-P4-003 | Completed |
| SR-P4-005 | Apply caption styles and timed overlays in FFmpeg export/render pipeline | `apps/web/lib/ffmpeg.ts`, `apps/web/lib/render-queue.ts` | P0 | SR-P4-002 | Completed |
| SR-P4-006 | Align export UX copy/status with caption-toggle and hook-overlay behavior | `apps/web/components/repurpose/export-panel.tsx`, `apps/web/app/(workspace)/repurpose/export/page.tsx` | P1 | SR-P4-005 | Completed |
| SR-P4-007 | Add focused tests for style normalization and FFmpeg filter generation | `apps/web/lib/repurpose/__tests__/caption-style-config.test.ts`, `apps/web/lib/__tests__/ffmpeg-caption-overlay.test.ts` | P0 | SR-P4-005 | Completed |

## Phase 5 Progress (Current)

1. Export runtime now exposes truthful stage state, progress, attempts, and explicit failure categories:
   - `apps/web/lib/render-queue.ts`
   - `apps/web/app/api/exports/[id]/route.ts`
2. FFmpeg export rendering now reports staged progress through extraction, styling, stitching, and finalization:
   - `apps/web/lib/ffmpeg.ts`
3. Export UI now reflects server runtime instead of synthetic progress:
   - `apps/web/components/repurpose/export-panel.tsx`
4. Scheduler UX now includes recommendation-driven rescheduling using the best-time heatmap:
   - `apps/web/lib/snipradar/scheduler-recommendations.ts`
   - `apps/web/components/snipradar/scheduler-calendar.tsx`
5. Calendar operator feedback is now explicit for reschedule / unschedule / batch actions:
   - success toasts
   - quick recommended slot apply
   - drag/drop guidance
6. Focused Phase 5 validation:
   - `pnpm --filter web exec jest lib/snipradar/__tests__/scheduler-recommendations.test.ts lib/__tests__/ffmpeg-caption-overlay.test.ts --runInBand` -> passed.
7. Touched-file compile scan for the Phase 5 slice is clean.
   - full repo `tsc --noEmit` still has unrelated pre-existing debt outside the Phase 5 file set.

## Phase 5 Backlog

| ID | Task | File Targets | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| SR-P5-001 | Replace synthetic export progress with real runtime stages and failure reasons | `apps/web/components/repurpose/export-panel.tsx`, `apps/web/app/api/exports/[id]/route.ts`, `apps/web/lib/render-queue.ts` | P0 | SR-P4-006 | Completed |
| SR-P5-002 | Add render queue retry semantics and stale queued/processing recovery | `apps/web/lib/render-queue.ts`, `apps/web/lib/ffmpeg.ts` | P0 | SR-P5-001 | Completed |
| SR-P5-003 | Preserve predictable scheduler processing with lock-safe execution and stale posting recovery | `apps/web/lib/snipradar/scheduler.ts`, `apps/web/app/api/snipradar/scheduled/process/route.ts` | P0 | SR-P3-008 | Completed |
| SR-P5-004 | Add recommendation-driven calendar rescheduling and clearer operator feedback | `apps/web/components/snipradar/scheduler-calendar.tsx`, `apps/web/lib/snipradar/scheduler-recommendations.ts` | P1 | SR-P5-003 | Completed |
| SR-P5-005 | Add focused regression coverage for scheduling recommendations and export render behavior | `apps/web/lib/snipradar/__tests__/scheduler-recommendations.test.ts`, `apps/web/lib/__tests__/ffmpeg-caption-overlay.test.ts` | P0 | SR-P5-004 | Completed |

## Phase 6 Progress (Current)

1. Moved SnipRadar analytics derivation into the shared helper layer:
   - `apps/web/lib/snipradar/analytics.ts`
2. Corrected analytics pattern breakdowns to derive from the creator's own post window instead of tracked-account viral feed rows:
   - `apps/web/app/api/snipradar/metrics/route.ts`
3. Added window-level summary fields so the analytics page stops mixing lifetime account tweet count with period performance:
   - `windowPostsTracked`
   - `windowRepliesTracked`
   - `avgImpressionsPerPost`
   - `avgImpressionsPerReply`
4. Added server-generated analytics insights payload:
   - `aiSummary`
   - `topPostTypes`
5. Updated the analytics page to consume the corrected server payload and show practical cards + source attribution:
   - `apps/web/app/(workspace)/snipradar/analytics/page.tsx`
6. Best-performing tweet card now links directly to the tweet on X when available.
7. Focused validation:
   - `pnpm --filter web exec jest lib/snipradar/__tests__/analytics.test.ts --runInBand` -> passed.
   - `pnpm --filter web run snipradar:verify` -> passed.

## Phase 6 Backlog

| ID | Task | File Targets | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| SR-P6-001 | Move analytics math into a shared, testable helper | `apps/web/lib/snipradar/analytics.ts`, `apps/web/lib/snipradar/__tests__/analytics.test.ts` | P0 | SR-P5-005 | Completed |
| SR-P6-002 | Correct metrics route to use creator-owned post/reply analytics instead of tracked viral-feed breakdowns | `apps/web/app/api/snipradar/metrics/route.ts` | P0 | SR-P6-001 | Completed |
| SR-P6-003 | Add window-level summary fields for posts, replies, impressions, and engagement trustworthiness | `apps/web/lib/snipradar/analytics.ts`, `apps/web/app/api/snipradar/metrics/route.ts` | P0 | SR-P6-002 | Completed |
| SR-P6-004 | Wire analytics UI to server-derived summaries, top post types, and AI summary copy | `apps/web/app/(workspace)/snipradar/analytics/page.tsx` | P1 | SR-P6-003 | Completed |
| SR-P6-005 | Preserve date-range and post/reply filtering with clickable destination links in the performance table | `apps/web/components/snipradar/analytics/post-performance-table.tsx` | P1 | SR-P6-004 | Completed |
| SR-P6-006 | Run focused analytics regression coverage and SnipRadar verify checks | `apps/web/lib/snipradar/__tests__/analytics.test.ts` | P0 | SR-P6-004 | Completed |

## Phase 7 Progress (Current)

1. Added shared SnipRadar request guard utilities for runtime hardening:
   - `apps/web/lib/snipradar/request-guards.ts`
2. Replaced ad hoc route cooldown maps with shared, multi-rule rate limiting on critical SnipRadar write and AI routes:
   - `apps/web/app/api/snipradar/drafts/route.ts`
   - `apps/web/app/api/snipradar/viral/analyze/route.ts`
   - `apps/web/app/api/snipradar/coach/route.ts`
   - `apps/web/app/api/snipradar/rewrite/route.ts`
   - `apps/web/app/api/snipradar/hooks/generate/route.ts`
   - `apps/web/app/api/snipradar/drafts/predict/route.ts`
   - `apps/web/app/api/snipradar/style/route.ts`
   - `apps/web/app/api/snipradar/templates/route.ts`
   - `apps/web/app/api/snipradar/threads/generate/route.ts`
   - `apps/web/app/api/snipradar/accounts/route.ts`
   - `apps/web/app/api/snipradar/drafts/[id]/post/route.ts`
   - `apps/web/app/api/snipradar/threads/post/route.ts`
   - `apps/web/app/api/snipradar/engagement/route.ts`
3. Hardened machine-only endpoints to use constant-time secret comparison:
   - `apps/web/app/api/snipradar/scheduled/cron/route.ts`
   - `apps/web/app/api/snipradar/maintenance/repair/route.ts`
4. Expanded runtime QA coverage:
   - `apps/web/scripts/snipradar-smoke.js` now covers `accounts`, `templates`, `style`, and verifies cron endpoint remains secret-gated (`401` without machine secret).
   - `apps/web/scripts/load/snipradar-api-load.js` now supports optional queue endpoint load coverage via `SNIPRADAR_LOAD_INCLUDE_QUEUE=true`.
   - SnipRadar QA scripts now fail with explicit "start the web app" guidance when local runtime is unavailable.
5. Added focused guard-layer regression coverage:
   - `apps/web/lib/snipradar/__tests__/request-guards.test.ts`
6. Focused validation:
   - `pnpm --filter web exec jest lib/snipradar/__tests__/request-guards.test.ts lib/snipradar/__tests__/analytics.test.ts lib/snipradar/__tests__/scheduler-recommendations.test.ts --runInBand` -> passed.
   - `pnpm --filter web run snipradar:verify` -> passed.
   - `pnpm --filter web run snipradar:smoke` -> passed.
   - `node --check apps/web/scripts/snipradar-smoke.js apps/web/scripts/snipradar-auth-e2e.js apps/web/scripts/load/snipradar-api-load.js` -> passed.
   - `pnpm --filter web exec node scripts/snipradar-auth-e2e.js` -> passed.
   - `SNIPRADAR_DEMO_LOGIN=true SNIPRADAR_LOAD_CONCURRENCY=5 SNIPRADAR_LOAD_ITERATIONS=2 SNIPRADAR_LOAD_INCLUDE_QUEUE=true pnpm --filter web exec node scripts/load/snipradar-api-load.js` -> passed (`0.00%` error rate, worst p95 `792ms`).

## Phase 7 Backlog

| ID | Task | File Targets | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| SR-P7-001 | Replace ad hoc SnipRadar write-route cooldowns with shared request guards and consistent 429 semantics | `apps/web/lib/snipradar/request-guards.ts`, `apps/web/app/api/snipradar/**/*.ts` | P0 | SR-P6-006 | Completed |
| SR-P7-002 | Harden machine-only cron/maintenance endpoints with constant-time secret validation | `apps/web/app/api/snipradar/scheduled/cron/route.ts`, `apps/web/app/api/snipradar/maintenance/repair/route.ts`, `apps/web/lib/snipradar/request-guards.ts` | P0 | SR-P7-001 | Completed |
| SR-P7-003 | Expand SnipRadar smoke and load tooling to cover critical route families and queue surfaces | `apps/web/scripts/snipradar-smoke.js`, `apps/web/scripts/load/snipradar-api-load.js`, `apps/web/scripts/snipradar-auth-e2e.js` | P1 | SR-P7-001 | Completed |
| SR-P7-004 | Add focused regression tests for route guard behavior and keep Phase 7 validation evidence current | `apps/web/lib/snipradar/__tests__/request-guards.test.ts`, `docs/SNIPRADAR_EXECUTION_BOARD.active.md` | P0 | SR-P7-003 | Completed |

## Risks and Mitigations

| Risk | Impact | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- |
| Demo fixtures do not cover posting branches | High | Seed non-production demo account + drafts for E2E | Agent D | Mitigated |
| Upstream X token failures cause partial analytics | High | Standardized auto-refresh + reconnect messaging contract | Agent A | Mitigated |
| DB pool pressure on burst routes | High | Batch queries + guardrails + retries with jitter | Agent C | Mitigated |

## Next Immediate Actions

1. Start Phase 8 (`UX Polish + Launch Readiness`) now that scale, security, and QA hardening is complete.

## Deferred Enhancements

1. Full CV-based face detection / frame-by-frame subject tracking is deferred until the platform adopts a dedicated vision dependency or rendering worker tier.
