# Commercial Limits Matrix

This document is the human-readable companion to the runtime source of truth in `apps/web/lib/billing/commercial-model.ts`.

## Source Of Truth

- Runtime catalog: `apps/web/lib/billing/commercial-model.ts`
- Billing helpers: `apps/web/lib/billing/plans.ts`
- Dashboard usage surfaces: `apps/web/lib/analytics/metrics.ts`, `apps/web/components/dashboard/usage-meter.tsx`
- Enforced route gates:
  - `apps/web/app/api/scripts/generate/route.ts`
  - `apps/web/app/api/scripts/[scriptId]/synthesize/route.ts`
  - `apps/web/app/api/titles/generate/route.ts`
  - `apps/web/app/api/thumbnails/generate/route.ts`
  - `apps/web/app/api/content-calendar/generate/route.ts`
  - `apps/web/app/api/niche-discovery/analyze/route.ts`
  - `apps/web/app/api/competitors/route.ts`

## Core Creator Usage

| Tier | Ideas / mo | Scripts / mo | Titles / mo | Thumbnails / mo | TTS / mo |
|---|---:|---:|---:|---:|---:|
| `free` | 5 | 3 | 5 | 3 | 0 |
| `starter` | 50 | 30 | 100 | 15 | 10 |
| `creator` | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |
| `studio` | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |

## Secondary Workflow Limits

| Tier | Content Calendar Generations | Niche Discovery Analyses | Tracked Competitors |
|---|---:|---:|---:|
| `free` | 2 | 3 | 3 |
| `starter` | Unlimited | Unlimited | 5 |
| `creator` | Unlimited | Unlimited | 10 |
| `studio` | Unlimited | Unlimited | 25 |

## Workspace And SnipRadar Packaging

| Tier | Workspaces | Brand Kits | Collaboration | SnipRadar Scheduling | API / Webhooks | Support |
|---|---|---|---|---|---|---|
| `free` | 1 | 1 | Solo owner | No scheduled posting entitlement | No | Self-serve docs |
| `starter` | 1 | 1 | Solo owner | Drafting only | No | Email |
| `creator` | 1 | 3 | Solo workflow | 10 scheduled posts / week | No | Priority email |
| `studio` | Unlimited | Unlimited | Admin-managed team operations | Unlimited scheduled posts | Included | Priority support + implementation handoff |

## Studio Definition

`Studio` is fully defined for the current product state as:

- admin-managed multi-operator workspace packaging
- unlimited core creator generation
- unlimited brand kits and scheduled posts
- public API and webhook access included
- priority support with implementation guidance

`Studio` does **not** currently claim self-serve enterprise RBAC, approval workflows, or full agency-client permissioning as GA. Those remain separate roadmap capabilities.

## Keyword Research Note

Keyword research limits remain feature-specific and environment-tunable in `apps/web/lib/keywords/monetization.ts`. They are plan-tier aligned, but intentionally remain outside the core creator usage meter because they behave as a specialized search workload rather than a generic monthly generation counter.
