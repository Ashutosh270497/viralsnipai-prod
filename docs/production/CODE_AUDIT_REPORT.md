# Code Audit Report

Date: 2026-05-18

## P0 Must Fix Before Public Launch

| Risk | Area | Notes |
|---|---|---|
| Full unit suite not green | Jest tests | Current failures include stale billing expectations, Prisma repository mocks, translation service expectations, missing module alias, and ESM parsing. |
| Payment not manually verified | Razorpay | Complete `PAYMENT_LAUNCH_CHECKLIST.md` on staging and production keys. |
| Backup restore not drilled | Database | Run restore drill before public launch. |
| Staging not verified | Deploy | Deploy staging with separate DB/S3/Razorpay test mode. |

## P1 Before Paid Traffic

| Risk | Area | Notes |
|---|---|---|
| In-memory export queue | render queue | Single-instance V1 only; move to persistent queue before scaling. |
| Missing Redis rate limiter | security | In-memory fallback works but does not coordinate across instances. |
| Mobile QA incomplete | UI | Cross-device QA must be completed on core V1 pages. |
| Load testing incomplete | infra | Run `scripts/load/v1-api-load.js` and staging functional load tests. |
| Route surface is large | app/api | Continue auditing direct `request.json()` routes for zod validation/auth/ownership. |

## P2 Later Cleanup

| Risk | Area | Notes |
|---|---|---|
| Large UI components | repurpose/editor/export | Split after V1 stabilizes. |
| V2/V3 code present | navigation/pages | Keep hidden by flags; delete only after product decision. |
| Mock/demo assets | docs/public/scripts | Keep out of V1 navigation and production user flows. |

## Audit Checklist

- Direct `request.json()` routes should validate with zod.
- Workspace routes must require auth.
- Project/media/export routes must enforce ownership.
- Client-facing errors must not expose stack traces.
- Logs must go through redaction for sensitive payloads.
- V2/V3 UI must remain behind flags.
- No hardcoded localhost should be required in production.
- In-memory state must not be used for horizontally scaled critical paths.
