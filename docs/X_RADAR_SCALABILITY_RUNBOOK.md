# X Radar Scalability Runbook

## Objectives
- Keep X Radar responsive under high concurrent usage.
- Prevent scheduler backlog and silent data drift.
- Provide measurable latency and reliability signals.

## What Is Implemented
- Per-user scheduler fan-out worker via Inngest events.
- Maintenance cron for:
  - backfilling missing posted tweet metrics
  - cleaning old scheduler runs
  - pruning old ignored/replied engagement rows
- API telemetry:
  - `Server-Timing` headers on critical routes
  - structured latency logging
  - optional sampled webhook forwarding
- Alert hooks:
  - scheduler failure ratio spike
  - scheduler dispatch backlog
  - maintenance backfill failure spike
- Health endpoint for analytics:
  - `/api/x-radar/health`

## Required Environment Variables
Use `.env.local`:

```bash
XRADAR_SCHEDULER_CRON_SECRET=...
XRADAR_SCHEDULER_USER_DISPATCH_LIMIT=200
XRADAR_SCHEDULER_PER_USER_LIMIT=25
XRADAR_SCHEDULER_CRON_CONCURRENCY=10

XRADAR_MAINTENANCE_CRON_SECRET=...
XRADAR_MAINTENANCE_METRICS_LIMIT=200
XRADAR_MAINTENANCE_METRICS_CONCURRENCY=4

XRADAR_TELEMETRY_WEBHOOK_URL=
XRADAR_TELEMETRY_SUCCESS_SAMPLE_RATE=0.05
XRADAR_TELEMETRY_WARN_SAMPLE_RATE=0.5

XRADAR_ALERT_WEBHOOK_URL=

X_API_TIMEOUT_MS=10000
X_API_MAX_RETRIES=2
```

## Verification
Run module-level quality gate:

```bash
pnpm --filter web run xradar:verify
```

## Load Testing
Install k6 locally and run:

```bash
cd apps/web
BASE_URL=http://localhost:3000 XRADAR_AUTH_COOKIE='next-auth.session-token=...' pnpm run xradar:load
```

Notes:
- If no auth cookie is provided, endpoints may return `401`.
- The script still checks that APIs return quickly and provide `Server-Timing`.

Fallback without k6:

```bash
cd apps/web
BASE_URL=http://localhost:3000 XRADAR_AUTH_COOKIE='next-auth.session-token=...' pnpm run xradar:load:node
```

## Operational Endpoints
- Health snapshot: `GET /api/x-radar/health`
- Scheduler runs: `GET /api/x-radar/scheduled/runs`
- Manual maintenance:
  - user-scoped (session): `POST /api/x-radar/maintenance/repair`
  - machine/global (secret): `POST /api/x-radar/maintenance/repair` with `x-cron-secret`

## Rollout Order
1. Deploy code.
2. Apply Prisma migration (if any pending).
3. Set new XRadar env vars.
4. Trigger maintenance once.
5. Run load test and capture p95/p99 baseline.
6. Enable alert webhook and validate alert delivery.
