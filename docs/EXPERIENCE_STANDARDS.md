# Experience Standards

> Canonical source of truth for responsive support, accessibility, performance, and observability expectations.

## 1. Responsive Support Matrix

| Surface | Path | Support Level | Why |
|---|---|---|---|
| Marketing + Pricing | `/` | Mobile Supported | Conversion surfaces must work on mobile and already use stacked navigation patterns. |
| Creator Dashboard | `/dashboard` | Mobile Supported | Metric cards and activity panels collapse cleanly. |
| Content Calendar | `/dashboard/content-calendar` | Mobile Degraded | The calendar works on smaller widths, but multi-pane planning is still desktop-friendlier. |
| Script Generator | `/dashboard/script-generator` | Mobile Degraded | Editing works, but dense revision and review flows remain desktop-leaning. |
| Thumbnail Generator | `/dashboard/thumbnail-generator` | Mobile Supported | The form/results split collapses into a usable single-column flow. |
| SnipRadar Overview | `/snipradar/overview` | Mobile Supported | Overview cards and guidance stack vertically. |
| SnipRadar Create | `/snipradar/create/drafts` | Mobile Degraded | Tabs and draft tooling remain usable, but dense creation workflows still fit desktop better. |
| SnipRadar Inbox | `/snipradar/inbox` | Mobile Degraded | Triage works on mobile, but long capture review and action-heavy workflows need more polish. |
| RepurposeOS Ingest | `/repurpose` | Mobile Degraded | Entry and empty states render on mobile, but ingest and media workflows are still desktop-biased. |
| RepurposeOS Editor | `/repurpose/editor` | Desktop Only | Transcript editing, preview, and clip controls need desktop space and precision. |
| RepurposeOS Export | `/repurpose/export` | Desktop Only | Export and translation configuration remain operationally desktop-first. |

### Desktop-only exception rule

Desktop-only means the workflow is intentionally optimized for desktop interaction density. It does **not** exempt the surface from keyboard, focus, contrast, dialog, or semantic accessibility requirements.

## 2. Accessibility Baseline

**Minimum target:** WCAG 2.1 AA

Before a feature is treated as `QA Complete` or `Production Ready`, the relevant surface should be checked for:

1. Semantic landmarks and heading order
2. Keyboard navigation
3. Visible focus states
4. Color contrast
5. Form labels and accessible error messaging
6. Dialog and overlay focus management
7. Non-text alternatives for meaningful media and visuals
8. Reduced-motion support
9. Touch target spacing on mobile-supported surfaces

## 3. Performance Standards

### API latency budgets

| Class | p50 | p95 | Notes |
|---|---:|---:|---|
| Marketing / pricing read | 300ms | 1000ms | Cold acquisition surfaces should feel immediate. |
| Workspace summary read | 800ms | 2000ms | Dashboard-like reads may aggregate data, but should stay under 2s at p95. |
| Keyword search read | 1000ms | 2500ms | Matches the current keyword runtime SLO. |
| SnipRadar summary read | 700ms | 1500ms | Overview and inbox refresh should stay iterative. |
| Interactive generation mutation | 1500ms | 5000ms | Beyond this, the workflow should move to a background-job model. |
| Job status refresh | 500ms | 1500ms | Activity and queue polling should remain lightweight. |

### Long-running job expectations

| Job | Mode | Ack | Target | Max |
|---|---|---:|---:|---:|
| SnipRadar profile audit | Sync | N/A | 15s | 30s |
| Research Copilot query + brief | Sync | N/A | 8s | 15s |
| Script generation | Sync | N/A | 20s | 45s |
| Thumbnail generation | Sync | N/A | 30s | 90s |
| Research index refresh | Async | 5s | 90s | 5m |
| Export render | Async | 5s | 10m | 30m |
| Voice translation | Async | 5s | 15m | 40m |

**Rule:** if the p95 user wait exceeds 5 seconds, the feature should acknowledge quickly and continue through a visible job/status workflow instead of silently blocking.

## 4. Observability Stack

### Error tracking

- Structured server logging via `apps/web/lib/logger.ts`
- Route and queue failure logging through `logger.error(...)`
- Terminal job failure persistence where the domain already supports it

### Performance monitoring

- `Server-Timing` headers on selected routes
- Keyword runtime SLO collector in `apps/web/lib/keywords/runtime-metrics.ts`
- SnipRadar API telemetry sampling in `apps/web/lib/snipradar/api-telemetry.ts`
- Load scripts in `apps/web/scripts/load/`

### Product analytics

- Client event tracking via `apps/web/lib/analytics.ts`
- Activation checkpoints via `apps/web/lib/analytics/activation.ts`
- Domain-specific event wrappers such as `apps/web/lib/snipradar/events.ts`

### Alert ownership

| Owner | Scope |
|---|---|
| Platform | auth, workspace shell, route protection, shared infra |
| Creator | dashboard, scripts, thumbnails, calendar, creator analytics |
| Growth | SnipRadar APIs, scheduler, extension, analytics |
| Media processing | FFmpeg-backed export, ingest, voice translation |
| Billing | Razorpay checkout, subscription sync, webhook reconciliation |

## 5. Production-ready implication

A feature should not be labeled `Production Ready` unless:

- its responsive support level is known
- the relevant accessibility checks are accounted for
- latency or runtime expectations are defined
- an observability path and alert owner are identified
