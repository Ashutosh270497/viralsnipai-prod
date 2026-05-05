# Agent Execution Board (Active)

Single source of truth for the live sprint.

## Sprint Meta

- Sprint Name: `Repurpose OS Stabilization Sprint`
- Dates: `2026-02-19` to `2026-02-23`
- Super Agent: `Codex`
- Release Target: `Repurpose OS RC1 (Transcript + Export Reliability)`

## Agent Assignment

| Agent | Scope | Branch | Worktree | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Agent A | Backend/API | `agent/backend/sprint-current` | `../clippers-agent-a` | Backend Engineer | In Progress |
| Agent B | Frontend/UX | `agent/frontend/sprint-current` | `../clippers-agent-b` | Frontend Engineer | In Progress |
| Agent C | Workers/Infra | `agent/infra/sprint-current` | `../clippers-agent-c` | Infra Engineer | In Progress |
| Agent D | QA/Perf | `agent/qa/sprint-current` | `../clippers-agent-d` | QA Engineer | In Progress |

## Backlog

| ID | Task | Track | Dependency | Priority | Est. | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ROS-001 | Fix transcript timestamp mapping so clip transcript aligns with actual trimmed video ranges | Agent A | - | P0 | 4h | Completed |
| ROS-002 | Ensure transcript edit operations update clip timeline and export payload deterministically | Agent A | ROS-001 | P0 | 4h | Completed |
| ROS-003 | Refactor Edit and Enhance transcript panel to single professional editor mode (no noisy token chips) | Agent B | ROS-001 | P0 | 5h | Completed |
| ROS-004 | Add precise seek/scrub sync between video player and transcript cursor | Agent B | ROS-001 | P0 | 3h | Completed |
| ROS-005 | Fix export queue stuck at 2% by hardening worker status transitions and heartbeat updates | Agent C | ROS-001 | P0 | 5h | Completed |
| ROS-006 | Finalize export presets as one modern flow with ratio dropdown (`9:16`, `1:1`, `16:9`) + caption toggle support | Agent C | ROS-005 | P1 | 4h | Completed |
| ROS-007 | Build automated smoke test for ingest -> edit -> export success path | Agent D | ROS-001,ROS-003,ROS-005 | P0 | 4h | Completed |
| ROS-008 | Run regression pack for X Radar + Repurpose OS and produce release checklist | Agent D | ROS-007 | P0 | 3h | Completed |

## In Progress

| ID | Agent | What changed | Blocker | ETA | Status |
| --- | --- | --- | --- | --- | --- |
| ROS-001 | Agent A | Transcript range mapping unified and clip-boundary normalization hardened. | None | 2026-02-19 EOD | Completed |
| ROS-003 | Agent B | Single-block transcript editing mode delivered in editor surface. | None | 2026-02-19 EOD | Completed |
| ROS-004 | Agent B | Cursor-based transcript-to-video seek sync added in single editor block. | None | 2026-02-19 EOD | Completed |
| ROS-005 | Agent C | Queue dedupe + stalled queued-job recovery added; status persistence retries retained. | Validate runtime behavior with one queued export | 2026-02-19 EOD | Completed |
| ROS-006 | Agent C | Unified export flow (ratio selector + caption toggle) confirmed in export page. | None | 2026-02-19 EOD | Completed |
| ROS-007 | Agent D | End-to-end repurpose smoke automation validated (`repurpose:smoke`) with project creation + guarded ingest checks. | None | 2026-02-26 EOD | Completed |
| ROS-008 | Agent D | Regression pack validated: SnipRadar smoke, SnipRadar verify, repurpose flow Playwright; brittle selectors modernized for ecosystem routing. | None | 2026-02-26 EOD | Completed |

## Integration Plan

Merge order:

1. Agent A PR: `ROS-001` then `ROS-002`
2. Agent C PR: `ROS-005` then `ROS-006`
3. Agent B PR: `ROS-003` then `ROS-004`
4. Agent D PR: `ROS-007` then `ROS-008`

## Validation Checklist

- [x] Lint passed (touched scope)
- [x] Typecheck passed (touched scope)
- [x] Tests passed (unit/integration)
- [x] Migrations safe and reviewed
- [x] API contracts updated
- [x] UI smoke test passed
- [x] Worker/job smoke test passed
- [ ] Performance baseline unchanged or improved

## Risks and Mitigations

| Risk | Impact | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- |
| Export may still stall when ffmpeg path or output directory is invalid | High | Add preflight validation + explicit error classification before queueing | Agent C | Open |
| Transcript editor and clip timeline may diverge after text deletion | High | Make single source of truth on clip transcript map and recompute derived ranges on save | Agent A | Open |
| UI regressions in stepper flow after editor simplification | Medium | Add focused UI smoke tests on stepper state transitions | Agent D | Open |

## Daily Sync Log

### Day 1

- Agent A: Started timeline mapping audit and identified current mismatch points in clip transcript derivation.
- Agent B: Started single-editor redesign to remove segmented chip-based view.
- Agent C: Completed first patch to make export status transitions authoritative in worker path and resilient to transient DB update failures.
- Agent D: Prepared smoke test matrix; waiting on first integrated branch.
- Super Agent decision: Prioritize `ROS-001` and `ROS-005` as release blockers before UI polish.

### Day 2

- Agent A: Added transcript edit-range utility and internal-cut preview regeneration path.
- Agent B: Added transcript cursor seek syncing with video playback in Edit & Enhance.
- Agent C: Added export re-queue recovery for stale queued jobs and duplicate enqueue guard.
- Agent D: Added and ran focused unit coverage for transcript editor and edit-range normalization.
- Super Agent decision: Keep release blocked only on integrated smoke path (`ROS-007`) and full regression checklist (`ROS-008`).

### Day 3

- Agent D: Executed `BASE_URL=http://localhost:3000 pnpm --filter web run repurpose:smoke` -> passed.
- Agent D: Executed `BASE_URL=http://localhost:3000 pnpm --filter web run snipradar:smoke` -> passed.
- Agent D: Executed `pnpm --filter web run snipradar:verify` -> passed (`eslint` + `tsc` + `prisma validate`).
- Agent D: Stabilized Playwright repurpose regression for current ecosystem-aware UI and stepper labels; `pnpm --filter web run repurpose:test` now green.
- Super Agent decision: Remove release block on `ROS-007` and `ROS-008`; carry forward only perf benchmarking as post-RC optimization.

## Release Decision

- Go/No-Go: Go (RC1 Candidate)
- Reason: Transcript sync/export stability now validated by smoke + regression pack
- Follow-up items:
  - Confirm production env parity for worker runtime.
  - Confirm export output quality baseline with and without captions.
  - Capture formal performance benchmark to close final validation checkbox.
