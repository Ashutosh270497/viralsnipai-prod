# X API Unit Economics — SnipRadar Baseline

## Purpose

This document defines the current Phase 2 operating model for SnipRadar X API usage. It is an implementation baseline for packaging and guardrail decisions, not a final finance model.

## Current Read Model

SnipRadar currently drives X read usage from four main surfaces:

1. `Tracked account viral fetch`
   - Current model: `4` fetch runs per day
   - Cost driver: `1` user-tweets read per tracked account per run

2. `Overview / summary refresh`
   - Current model: up to `4` account-summary refreshes per day
   - Cost driver: account-level lookup plus tweet-metrics hydration checks

3. `Tweet metrics hydration`
   - Current model: capped at `15` tweet metrics hydration candidates per refresh cycle
   - Cost driver: post-level metrics lookups for recently posted drafts

4. `Explicit lookup flows`
   - Add tracked account
   - Manual X connect
   - Extension author tracking

## Baseline Formulas

### Estimated Daily Read Calls

```text
daily_reads =
  (tracked_accounts * 4)
  + 4
  + min(hydration_candidates, 15)
```

Where:

- `tracked_accounts * 4` models the current four-times-per-day tracked-account fetch cadence
- `+ 4` models account summary refresh pressure
- `min(hydration_candidates, 15)` models the current tweet-metrics hydration cap

### Estimated Daily Write Calls

```text
daily_writes =
  scheduled_posts_per_day
  + manual_publishes_per_day
```

## Guardrail Thresholds

### Healthy

- Fewer than `12` tracked accounts
- Fewer than `70` estimated daily reads
- Hydration not pinned at the current cap

### Watch

- `12–24` tracked accounts
- `70–139` estimated daily reads
- Metrics hydration regularly hits the current cap

### High

- `25+` tracked accounts
- `140+` estimated daily reads
- Repeatedly cap-bound hydration plus heavy scheduled-post volume

## Packaging Guidance

### When in Healthy

- Keep current fetch cadence
- Prioritize reply assist, discovery, and analytics quality

### When in Watch

- Monitor tracked-account growth by active user cohort
- Prefer packaging that encourages quality usage over high-volume passive monitoring
- Avoid silently expanding fetch frequency

### When in High

- Cap tracked-account counts more aggressively
- Gate heavier refresh patterns behind higher tiers
- Treat bulk monitoring and high-frequency refresh as explicitly premium behaviors

## Current Code References

- Guardrail model: `apps/web/lib/snipradar/x-unit-economics.ts`
- Summary API surface: `apps/web/app/api/snipradar/route.ts`
- Tracked account reads: `apps/web/app/api/snipradar/viral/route.ts`
- Scheduler posting: `apps/web/lib/snipradar/scheduler.ts`
- Extension author tracking: `apps/web/app/api/snipradar/extension/track/route.ts`

## Notes

- This baseline intentionally models the current architecture conservatively.
- It should be revised when:
  - fetch cadence changes
  - hydration caps change
  - packaging tiers are hardened in Phase 5
