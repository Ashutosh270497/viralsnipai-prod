# Razorpay Billing Setup

## Scope

This repo now uses Razorpay as the subscription provider for paid plans.

Implemented surfaces:

- `/billing` page for plan selection and subscription management
- `POST /api/billing/checkout`
- `POST /api/billing/verify`
- `POST /api/billing/cancel`
- `POST /api/webhooks/razorpay`

## Required Env Vars

Add these in `apps/web/.env.local` or production secrets:

```bash
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

RAZORPAY_PLAN_STARTER_MONTHLY_INR=
RAZORPAY_PLAN_STARTER_YEARLY_INR=
RAZORPAY_PLAN_CREATOR_MONTHLY_INR=
RAZORPAY_PLAN_CREATOR_YEARLY_INR=
RAZORPAY_PLAN_STUDIO_MONTHLY_INR=
RAZORPAY_PLAN_STUDIO_YEARLY_INR=

RAZORPAY_PLAN_STARTER_MONTHLY_USD=
RAZORPAY_PLAN_STARTER_YEARLY_USD=
RAZORPAY_PLAN_CREATOR_MONTHLY_USD=
RAZORPAY_PLAN_CREATOR_YEARLY_USD=
RAZORPAY_PLAN_STUDIO_MONTHLY_USD=
RAZORPAY_PLAN_STUDIO_YEARLY_USD=
```

## Dashboard Setup

1. Create one Razorpay plan per tier/cycle/currency combination you want to sell.
2. Copy each Razorpay `plan_id` into the matching env var.
3. Configure the webhook endpoint:
   - local: tunnel to `/api/webhooks/razorpay`
   - production: `https://your-domain.com/api/webhooks/razorpay`
4. Subscribe to at least:
   - `subscription.authenticated`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.completed`
   - `payment.authorized`
   - `payment.failed`

## Local Rollout

From `apps/web`:

```bash
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm exec prisma generate
pnpm dev
```

Then:

1. Sign in
2. Open `/billing`
3. Start a plan
4. Complete the Razorpay modal
5. Confirm the user row updates:
   - `subscriptionTier`
   - `subscriptionStatus`
   - `billingCycle`
   - `razorpayCustomerId`
   - `razorpaySubscriptionId`

## Operational Notes

- Webhooks are the long-term source of truth for billing state.
- `/api/billing/verify` exists to refresh UI immediately after checkout success.
- The old `stripeCustomerId` column is left in place as a legacy field for safe migration; it is no longer used by billing flows.

## Official Docs

- https://razorpay.com/docs/payments/subscriptions/integration-guide/
- https://razorpay.com/docs/payments/subscriptions/create-subscription/
- https://razorpay.com/docs/webhooks/validate-test/

