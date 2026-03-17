# SnipRadar API Contract Map (Phase 0 Baseline)

Last updated: 2026-02-24
Scope: `apps/web/app/api/snipradar/**`

## Contract Rules
1. All endpoints require authenticated session unless explicitly stated.
2. Mutations must return structured JSON with success/error semantics.
3. Critical reads should emit server-timing headers.
4. Scheduler/maintenance writes must be idempotent by design.

## Endpoint Inventory

### A) Core Session + Account
1. `GET /api/snipradar`
   - Purpose: summary payload (account, counts, high-level state).
2. `POST /api/snipradar`
   - Purpose: start/continue account connect and refresh workflow.
3. `DELETE /api/snipradar`
   - Purpose: disconnect account auth state.
4. `GET /api/snipradar/callback`
   - Purpose: OAuth callback completion.
5. `GET /api/snipradar/accounts`
   - Purpose: list tracked accounts.
6. `POST /api/snipradar/accounts`
   - Purpose: add tracked account.
7. `DELETE /api/snipradar/accounts/:id`
   - Purpose: remove tracked account.
8. `GET /api/snipradar/accounts/:id/details`
   - Purpose: tracked account detail with related tweet data.

### B) Discover / Viral Intelligence
1. `GET /api/snipradar/discover-data`
   - Purpose: unified tracker + viral feed payload.
2. `GET /api/snipradar/viral`
   - Purpose: read viral tweets with filters.
3. `POST /api/snipradar/viral`
   - Purpose: fetch/ingest new viral tweets from tracked accounts.
4. `DELETE /api/snipradar/viral`
   - Purpose: clear/prune viral data scope.
5. `POST /api/snipradar/viral/analyze`
   - Purpose: AI pattern analysis over ingested viral tweets.

### C) Create / Drafting
1. `GET /api/snipradar/create-data`
   - Purpose: drafts + posted/scheduled snapshots.
2. `GET /api/snipradar/drafts`
   - Purpose: list drafts with filtering.
3. `POST /api/snipradar/drafts`
   - Purpose: generate/create draft set.
4. `PATCH /api/snipradar/drafts/:id`
   - Purpose: update draft text/metadata/status.
5. `DELETE /api/snipradar/drafts/:id`
   - Purpose: remove draft.
6. `POST /api/snipradar/drafts/:id/post`
   - Purpose: publish single draft to X.
7. `POST /api/snipradar/drafts/predict`
   - Purpose: estimate draft virality score.
8. `POST /api/snipradar/hooks/generate`
   - Purpose: hook idea generation.
9. `POST /api/snipradar/rewrite`
   - Purpose: rewrite/remix assistant output.
10. `POST /api/snipradar/threads/generate`
   - Purpose: generate thread drafts.
11. `POST /api/snipradar/threads/post`
   - Purpose: publish entire thread group.
12. `GET /api/snipradar/templates`
   - Purpose: list template library.
13. `POST /api/snipradar/templates`
   - Purpose: create template.
14. `GET /api/snipradar/style`
   - Purpose: style profile read.
15. `POST /api/snipradar/style`
   - Purpose: train/update style profile.

### D) Engagement Finder
1. `GET /api/snipradar/engagement`
   - Purpose: list engagement opportunities with filters.
2. `POST /api/snipradar/engagement`
   - Purpose: refresh/build engagement opportunities.
3. `PATCH /api/snipradar/engagement/opportunities/:id`
   - Purpose: update one opportunity status (`saved/replied/ignored`).
4. `PATCH /api/snipradar/engagement/opportunities/bulk`
   - Purpose: bulk status updates.

### E) Publish / Scheduler
1. `GET /api/snipradar/scheduler/best-times`
   - Purpose: best-time recommendations.
2. `POST /api/snipradar/scheduled/process`
   - Purpose: process due scheduled drafts.
3. `POST /api/snipradar/scheduled/cron`
   - Purpose: cron entrypoint for scheduler.
4. `GET /api/snipradar/scheduled/runs`
   - Purpose: recent scheduler run diagnostics.

### F) Analytics / Health / Maintenance
1. `GET /api/snipradar/metrics`
   - Purpose: analytics summary + post performance dataset.
2. `GET /api/snipradar/coach`
   - Purpose: AI growth coach summary.
3. `GET /api/snipradar/health`
   - Purpose: pipeline health snapshot.
4. `POST /api/snipradar/maintenance/repair`
   - Purpose: repair stale metrics/status data.

## Contract Stabilization Tasks (Phase 1)
1. Add typed response envelopes for all mutation endpoints.
2. Normalize auth failure shape for all routes.
3. Add route-level validation docs for request query/body parameters.
4. Add contract tests for:
   - `GET /metrics`
   - `POST /viral`
   - `POST /drafts/:id/post`
   - `POST /scheduled/process`
5. Add explicit idempotency notes for scheduler and maintenance endpoints.

## Phase 2 Contract Addendum (Kickoff)

1. Posting-path auth E2E contract is now fixture-driven:
   - `apps/web/scripts/snipradar-auth-e2e.js` seeds deterministic demo drafts and thread group before calling:
     - `POST /api/snipradar/drafts/:id/post`
     - `POST /api/snipradar/threads/post`
2. Expected non-success posting fallback remains standardized:
   - `success=false`
   - string `error`
   - string `code` (for example: `OAUTH_REQUIRED`, `REAUTH_REQUIRED`, `UPSTREAM_ERROR`)
3. Transcript-video sync implementation (Phase 2 execution) must preserve these API envelope rules for any new edit/sync routes.
