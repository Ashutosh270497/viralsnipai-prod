# Razorpay-Only Billing Cutover Plan

Date: 2026-03-11
Owner: Platform / Billing
Scope: ViralSnipAI + SnipRadar billing unification

## Goal

Replace the current mixed billing implementation with a single Razorpay-only subscription system for both India and international users.

Target commercial model:
- `free`
- `plus`
- `pro`

Pricing:
- India
  - `free`
  - `plus`: `₹499 / month`
  - `pro`: `₹2199 / month`
- Global
  - `free`
  - `plus`: `$9.99 / month`
  - `pro`: `$29.99 / month`

Provider:
- `Razorpay` only

## Current State Audit

The codebase currently has two overlapping billing systems.

Active legacy billing flow:
- UI:
  - `apps/web/app/billing/page.tsx`
  - `apps/web/components/billing/billing-workspace.tsx`
- Routes:
  - `apps/web/app/api/billing/checkout/route.ts`
  - `apps/web/app/api/billing/verify/route.ts`
  - `apps/web/app/api/billing/cancel/route.ts`
- Plan model:
  - `apps/web/lib/billing/commercial-model.ts`
  - `apps/web/lib/billing/plans.ts`
- Legacy plan names:
  - `free`
  - `starter`
  - `creator`
  - `studio`

Newer subscription foundation:
- Plan config:
  - `apps/web/config/plans.ts`
- Types:
  - `apps/web/types/billing.ts`
- State helpers:
  - `apps/web/lib/billing/subscriptions.ts`
  - `apps/web/lib/billing/access.ts`
- Routes:
  - `apps/web/app/api/billing/create-subscription/route.ts`
  - `apps/web/app/api/billing/subscription/route.ts`
  - `apps/web/app/api/billing/track-usage/route.ts`
- Data model:
  - `Subscription`
  - `UsageTracking`
  - `RazorpayWebhookEvent`

Stripe still exists in active code paths and types:
- `apps/web/lib/billing/stripe.ts`
- `apps/web/lib/billing/index.ts`
- `apps/web/types/billing.ts`
- `apps/web/config/plans.ts`
- `.env.example`

Conclusion:
- Billing foundation exists
- Billing cutover is not complete
- Active UX is still using the legacy flow
- Stripe is not fully removed

## Canonical Target Model

### Plan IDs

Canonical billing plan ids:
- `free`
- `plus`
- `pro`

### Region and Currency

Region detection remains useful for pricing display and plan-id resolution:
- `IN -> INR`
- `GLOBAL -> USD`

Provider remains the same in both cases:
- `razorpay`

### Plan ID Environment Variables

Monthly plan ids only for the first clean cut:
- `RAZORPAY_PLAN_ID_PLUS_INR`
- `RAZORPAY_PLAN_ID_PRO_INR`
- `RAZORPAY_PLAN_ID_PLUS_USD`
- `RAZORPAY_PLAN_ID_PRO_USD`

Public checkout key:
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

Server secrets:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

### Compatibility Mapping During Cutover

Temporary legacy to canonical mapping:
- `free -> free`
- `starter -> plus`
- `creator -> plus`
- `studio -> pro`
- `agency -> pro`

This mapping exists only to preserve old user records and old pricing links during migration. It must not remain in the active billing UX after cutover.

## Prerequisites

These must be confirmed before Phase 1 code cutover starts.

### Razorpay Dashboard

Required:
- Razorpay account live
- International payments enabled
- Subscriptions enabled
- Four live subscription plans created:
  - `plus / INR`
  - `pro / INR`
  - `plus / USD`
  - `pro / USD`

Recommended:
- Start with monthly plans only
- Add yearly later as a separate follow-up once the monthly cutover is stable

### Site Readiness

Razorpay international acceptance and production review will expect:
- Privacy Policy page live
- Terms page live
- Refund / cancellation policy live
- Clear product/service fulfillment wording
- Public billing/support contact

### Webhooks

Required webhook endpoint:
- `/api/billing/webhook/razorpay`

Required webhook events:
- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.cancelled`
- `subscription.paused`
- `payment.failed`

### Environment

Local and deployment envs must define:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_PLAN_ID_PLUS_INR`
- `RAZORPAY_PLAN_ID_PRO_INR`
- `RAZORPAY_PLAN_ID_PLUS_USD`
- `RAZORPAY_PLAN_ID_PRO_USD`

## Phase-by-Phase Execution

### Phase 1 — Canonical Billing Domain

Status:
- Implemented on March 11, 2026

Objective:
- Normalize plan names, pricing, env vars, and plan resolution around `free / plus / pro`

Work:
- Replace active plan ids in:
  - `apps/web/config/plans.ts`
  - `apps/web/types/billing.ts`
  - `apps/web/lib/billing/subscriptions.ts`
  - `apps/web/lib/billing/razorpay.ts`
- Keep a temporary compatibility mapper for old plan ids
- Remove active dependence on Stripe price ids in new billing code

Exit criteria:
- One canonical billing vocabulary
- No active billing route depends on `starter / creator / studio / agency`

### Phase 2 — Razorpay-Only Backend Cutover

Status:
- Implemented on March 11, 2026
- Legacy `/api/billing/checkout`, `/api/billing/verify`, `/api/billing/cancel`, and `/api/webhooks/razorpay` now delegate to the canonical Razorpay-only backend path

Objective:
- Make the active billing API fully Razorpay-only

Work:
- Promote these as active routes:
  - `POST /api/billing/create-subscription`
  - `GET /api/billing/subscription`
  - `POST /api/billing/track-usage`
- Add or finalize:
  - `POST /api/billing/verify-payment`
  - `POST /api/billing/cancel-subscription`
  - `POST /api/billing/webhook/razorpay`
- Ensure payment signature verification and webhook signature verification use the correct Razorpay secret path

Exit criteria:
- Upgrade, verify, cancel, and webhook reconciliation all work through one backend path

### Phase 3 — Free Plan Bootstrap and User Migration

Objective:
- Ensure every user always has a valid subscription record

Work:
- Bootstrap `free` subscription on:
  - credential signup
  - Google sign-in
  - `getCurrentDbUser()` self-heal path
- Backfill or map legacy users into canonical plan ids

Exit criteria:
- No authenticated user exists without a `Subscription` row

### Phase 4 — Billing UI Cutover

Objective:
- Replace the active legacy billing page with the canonical Razorpay billing UI

Work:
- Rebuild `/billing` around:
  - current plan
  - renewal date
  - usage vs limits
  - upgrade / cancel actions
  - India vs Global pricing display
- Remove old `starter / creator / studio` UI copy from active billing screens

Exit criteria:
- `/billing` uses the new subscription APIs only

### Phase 5 — SnipRadar Feature Gating

Objective:
- Enforce plan and usage limits in Discover, Create, Publish, Analytics, and Growth Planner

Work:
- Add server-side enforcement for:
  - tracker account cap
  - viral fetch cap
  - engagement finder limits
  - scheduling limits
  - research copilot lock
  - variant lab lock
  - analytics tier behavior
- Add UI upgrade prompts for locked or exceeded features

Exit criteria:
- Free and paid entitlements are enforced consistently

### Phase 6 — Legacy Billing Removal

Objective:
- Remove inactive Stripe and old-tier code from active billing paths

Work:
- Remove or retire:
  - `apps/web/lib/billing/stripe.ts` from active exports
  - Stripe-related env references in active billing docs/config
  - old billing routes if superseded
  - old plan naming in active billing UI and APIs

Exit criteria:
- Active billing stack is Razorpay-only

### Phase 7 — Production Hardening

Objective:
- Validate the live Razorpay subscription flow and operational recovery paths

Work:
- Test India and international checkout
- Test payment verification
- Test cancellation at period end
- Test webhook replay / duplicate delivery handling
- Test refresh during pending state

Exit criteria:
- Billing flow is operationally safe for launch

## Current Files Expected to Change in Later Phases

Canonical billing model:
- `apps/web/config/plans.ts`
- `apps/web/types/billing.ts`
- `apps/web/lib/billing/subscriptions.ts`
- `apps/web/lib/billing/razorpay.ts`
- `apps/web/lib/billing/index.ts`

Billing API:
- `apps/web/app/api/billing/create-subscription/route.ts`
- `apps/web/app/api/billing/subscription/route.ts`
- `apps/web/app/api/billing/track-usage/route.ts`
- `apps/web/app/api/billing/verify-payment/route.ts`
- `apps/web/app/api/billing/cancel-subscription/route.ts`
- `apps/web/app/api/billing/webhook/razorpay/route.ts`

Auth and bootstrap:
- `apps/web/lib/auth.ts`
- `apps/web/app/api/auth/signup/route.ts`

Billing UI:
- `apps/web/app/billing/page.tsx`
- `apps/web/components/billing/*`

SnipRadar gating:
- `apps/web/app/api/snipradar/accounts/route.ts`
- `apps/web/app/api/snipradar/viral/route.ts`
- `apps/web/app/api/snipradar/engagement/route.ts`
- `apps/web/app/api/snipradar/research/query/route.ts`
- `apps/web/app/api/snipradar/drafts/variants/route.ts`
- `apps/web/app/api/snipradar/hooks/generate/route.ts`
- `apps/web/app/api/snipradar/metrics/route.ts`
- `apps/web/app/api/snipradar/drafts/[id]/route.ts`
- `apps/web/app/(workspace)/snipradar/*`
- `apps/web/components/snipradar/*`

## Rollback Strategy

If cutover breaks:
- Keep DB schema additive
- Preserve temporary legacy plan mapping until migration is stable
- Do not delete old billing routes until the new `/billing` page is live and tested
- Use webhook data plus subscription table as the canonical reconciliation source

## Non-Goals for This Cutover

Not included in the first billing cutover:
- yearly subscription support
- Stripe fallback
- seat-based Agency tier
- tax invoice/reporting automation
- coupon engine beyond existing promo groundwork

## Approval Gate for Phase 1

Phase 1 can start once these are confirmed:
- final plan names: `free / plus / pro`
- final prices:
  - India: `₹499`, `₹2199`
  - Global: `$9.99`, `$29.99`
- monthly-only first release approved
- Razorpay dashboard plan ids prepared for INR and USD
