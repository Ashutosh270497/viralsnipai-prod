# Production Readiness Audit

Date: 2026-05-18

Scope: ViralSnipAI V1, the upload/import → clip generation → edit → export/download flow.

| # | Scenario | Current coverage | Risk | Files / area | Safe fix plan | Code change needed |
|---|---|---|---|---|---|---|
| 1 | App only works on developer laptop | Dockerfile exists, local storage still possible | P0 | storage, upload, env | Require S3 in production and document deploy path | Done |
| 2 | Env vars incomplete | `.env.example` exists, runtime validation was minimal | P0 | env, health | Add grouped production env validation | Done |
| 3 | One server/no recovery | In-memory export queue | P1 | render queue, docs | Single-instance PM2 config and recovery runbook | Done |
| 4 | Slow network not tested | Some loading states exist | P1 | V1 UI | Add slow-network QA runbook | Docs |
| 5 | No monitoring/alerts | Health endpoint exists | P1 | health, docs | Add readiness probe and monitoring runbook | Done |
| 6 | Free-tier infra plan missing | Limits exist, infra plan not explicit | P1 | docs | Document upgrade triggers and known limits | Docs |
| 7 | No load testing | SnipRadar load tests exist only | P1 | scripts/load | Add V1 health load baseline script | Done |
| 8 | No process manager | Docker start only | P1 | PM2 docs | Add PM2 config and process runbook | Done |
| 9 | No DB backups | Supabase docs exist, no drill doc | P0 | docs/scripts | Backup/restore runbook and scripts | Done |
| 10 | Payment not tested E2E | Razorpay code exists | P0 | billing docs | Manual Razorpay launch checklist | Docs |
| 11 | Secrets manual | `.env.example` exists | P1 | docs/.gitignore | Secrets source-of-truth runbook | Done |
| 12 | Logs not redacted | Logger exists | P0 | logger, routes | Add redaction utility and apply to sensitive logs | Done |
| 13 | No staging | No dedicated staging doc | P1 | docs/env | Add staging env and promotion checklist | Done |
| 14 | Mobile not tested | Playwright only Chromium desktop | P1 | playwright/docs | Add browser/device projects and QA matrix | Done |
| 15 | AI-generated paths unaudited | Large route surface | P1 | docs | Add code audit report with P0/P1/P2 risks | Done |

## P0 Launch Blockers

- Complete real Razorpay test/live payment verification.
- Complete Supabase/Postgres restore drill.
- Run manual V1 E2E QA against staging.
- Resolve full unit-test suite failures before public launch.

## P1 Before Paid Traffic

- Move export queue to persistent worker queue before horizontal scaling.
- Add Sentry/BetterStack production monitoring.
- Run load testing against staging.
- Complete mobile QA matrix.
