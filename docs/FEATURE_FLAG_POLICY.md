# Feature Flag Policy

This policy governs the env-driven feature flags used by ViralSnipAI.

The source-of-truth registry for the current app shell flags is:

- `apps/web/lib/feature-flag-registry.ts`

## 1. Purpose

Feature flags exist to:

- release unfinished work safely
- keep a rollback path for sensitive surfaces
- disable provider-dependent features quickly when reliability or cost changes

They must not become permanent undocumented branching logic.

## 2. Required Metadata

Every registered flag must have:

- an owner
- a stage
- a default value
- a clear description
- an explicit kill-switch behavior
- a removal condition or an explicit reason it remains a permanent kill switch

## 3. Allowed Stages

- `experiment`
  - early validation, default-off unless intentionally testing
- `beta`
  - limited rollout, still expected to graduate or be removed
- `ga`
  - generally available; should be removed after stabilization unless there is a strong reason to keep it
- `kill_switch`
  - operational safety control intended to remain available for rollback or provider outages

## 4. Lifecycle Rules

### Experiment
- must have an owner and explicit graduation criteria
- should not remain indefinitely without a decision

### Beta
- should have rollout criteria and a target decision date
- must define what breaks or hides when disabled

### GA
- should be removed after stabilization unless it still serves as a real operational kill switch

### Kill switch
- can remain long term
- must describe exactly what user-facing behavior changes when switched off

## 5. Documentation Requirements

- `.env.example` must list the active registry-backed flags and any related supplemental guards such as `FORCE_VEO_ENABLED`
- PRD and architecture docs must not present a flagged-off or deferred surface as fully live without noting the guard
- removed flags must also be removed from docs and `.env.example`

## 6. Scope Boundary

This policy applies to the env-driven app shell flags currently parsed in:

- `apps/web/lib/feature-flags.ts`

If other product areas introduce feature gating outside that module, they must either:

- be folded into the same registry, or
- add a clearly documented secondary registry with the same metadata rules
