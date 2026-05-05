# SnipRadar Wave 0 Baseline

Date: 2026-03-22
Owner: Product / Engineering
Purpose: Freeze launch scope against the actual codebase before production deployment on Coolify + Hostinger.

## Decision

Production deployment must follow the audited codebase state, not the optimistic completion state previously recorded in `docs/polish_plan.md`.

This document is the Wave 0 baseline for launch execution.

## Canonical Status

### Complete

- Wave 0: Audit Freeze
- Wave 1: Activation Core
- Wave 2: Revenue Hook MVP
- Wave 4: Retention UX

### Partial

- Wave 3: Trust Gaps
- Wave 5: Launch Hardening
- Wave 6: Mobile and Packaging Polish

## What Is Actually Done

### Activation Core

- SnipRadar-specific onboarding exists
- niche-aware starter account seeding exists
- Discover has first-run guidance and seeded starter-feed behavior
- Research includes corpus-priming guidance

Primary files:
- `apps/web/app/snipradar-onboarding/page.tsx`
- `apps/web/lib/snipradar/starter-account-seeding.ts`
- `apps/web/app/api/snipradar/callback/route.ts`
- `apps/web/app/(workspace)/snipradar/discover/page.tsx`
- `apps/web/components/snipradar/research-copilot.tsx`

### Auto-DM MVP

- persistence exists in Prisma
- automation CRUD exists
- reply trigger processing exists
- manual run / scheduler integration exists
- publish UI exists

Primary files:
- `apps/web/prisma/schema.prisma`
- `apps/web/lib/snipradar/auto-dm.ts`
- `apps/web/app/api/snipradar/automations/dm/route.ts`
- `apps/web/app/api/snipradar/automations/dm/[id]/route.ts`
- `apps/web/app/api/snipradar/automations/dm/process/route.ts`
- `apps/web/components/snipradar/auto-dm-panel.tsx`

### Retention UX

- Discover search and advanced client-side filters exist
- Thread Writer has live preview, numbering, and per-tweet counts
- Research onboarding/search guidance exists

Primary files:
- `apps/web/app/(workspace)/snipradar/discover/page.tsx`
- `apps/web/components/snipradar/thread-composer.tsx`
- `apps/web/components/snipradar/thread-tweet-row.tsx`
- `apps/web/components/snipradar/research-copilot.tsx`

## What Is Still Partial

### Wave 3 — Trust Gaps

#### Growth Planner

Status: implemented

- API and AI generation exist
- personalized plan UI exists

Primary files:
- `apps/web/app/api/snipradar/growth/route.ts`
- `apps/web/lib/ai/growth-planner.ts`
- `apps/web/app/(workspace)/snipradar/growth-planner/page.tsx`

#### Extension reliability

Status: partial

- composer injection logic is extensive and much stronger than before
- however Wave 3 exit criteria require reliability, regression confidence, and supported-surface verification
- no clear release artifact in the repo proves end-to-end reliability sign-off

Primary files:
- `apps/browser-extension/content-script.js`
- `apps/browser-extension/service-worker.js`

#### WinnerLoop

Status: partial

- winner detection and derivative draft generation exist
- repost variant scheduling exists
- but the current implementation is still lighter than a full evergreen automation system with explicit audit trail/history

Primary files:
- `apps/web/components/snipradar/winner-loop-panel.tsx`
- `apps/web/app/api/snipradar/winners/automations/route.ts`
- `apps/web/lib/ai/winner-loop.ts`

### Wave 5 — Launch Hardening

#### Billing validation

Status: partial

- billing flows and UI exist
- deployment checklist exists
- but live production validation is an operational task, not something completed by code alone

Primary files:
- `docs/deployment_checklist_for_production.md`
- `apps/web/app/billing/page.tsx`

#### X auth drills

Status: partial

- code has refresh and reconnect paths
- no dedicated sign-off artifact proves drill completion

Primary files:
- `apps/web/lib/snipradar/x-auth.ts`
- `apps/web/app/api/snipradar/callback/route.ts`

#### Diagnostics

Status: partial

- scheduler / queue / AI provider diagnostics exist
- but the current health/diagnostics surfaces are stronger for scheduler health than for billing failure visibility and end-to-end automation observability

Primary files:
- `apps/web/app/api/snipradar/health/route.ts`
- `apps/web/app/(workspace)/snipradar/publish/page.tsx`

#### AI routing consistency

Status: partial

- OpenRouter is the primary route for many SnipRadar tasks
- direct OpenAI fallbacks still exist in several SnipRadar AI modules

Primary files:
- `apps/web/lib/ai/growth-planner.ts`
- `apps/web/lib/ai/growth-coach.ts`
- `apps/web/lib/ai/winner-loop.ts`
- `apps/web/lib/ai/profile-audit.ts`
- `apps/web/lib/ai/research-inbox.ts`
- `apps/web/lib/ai/snipradar-extension.ts`

### Wave 6 — Mobile and Packaging Polish

#### Mobile degradation cleanup

Status: partial

- responsive support matrix exists
- pricing/marketing surfaces exist
- but SnipRadar Create and Inbox are still intentionally classified as `mobile_degraded`

Primary files:
- `apps/web/lib/platform/responsive-support-matrix.ts`
- `apps/web/components/marketing-v2/pricing-page.tsx`

## Launch Blockers Before Production Deploy

These must be closed before considering the product launch-ready on Coolify/Hostinger:

1. Extension reliability sign-off on live X compose surfaces
2. WinnerLoop scope decision
   - either deepen the feature
   - or narrow the product language and claims
3. OpenRouter policy cleanup for remaining SnipRadar direct-provider fallbacks
4. Live billing validation
   - upgrade
   - webhook
   - cancellation
   - reconciliation
5. X auth refresh / reconnect drill
6. Minimal production diagnostics sign-off for scheduler, automations, X auth, and billing
7. Mobile degradation review for key SnipRadar surfaces

## Hosting Rule

The app can be prepared for deployment on Coolify + Hostinger now, but it should not be treated as launch-ready until the blockers above are closed and recorded in `docs/snipradar_launch_execution_board.md`.
