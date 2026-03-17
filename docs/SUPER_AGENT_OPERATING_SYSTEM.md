# Super Agent Operating System (4 Parallel Agents)

This runbook explains how to run 4 parallel engineering agents with one coordinator ("Super Agent") so delivery is fast and controlled.

## Goal

- Run multiple features in parallel without merge chaos.
- Keep quality high with clear ownership and check gates.
- Let you manage execution in 30-45 minutes/day.

## Roles

- Super Agent (me): planning, dependency control, integration order, risk handling, release readiness.
- Agent A (Backend/API): schema, routes, services, validations, migrations.
- Agent B (Frontend/UX): pages/components, loading/error states, accessibility, polish.
- Agent C (Workers/Infra): queues, jobs, ffmpeg, cron/scheduler, retries, observability.
- Agent D (QA/Perf): tests, regression checks, performance checks, deployment checklist.

## Ownership Matrix

| Area | Primary Agent | Secondary Agent |
| --- | --- | --- |
| Prisma + DB | Agent A | Agent C |
| API contracts | Agent A | Agent B |
| UI/UX changes | Agent B | Agent D |
| Jobs + workers | Agent C | Agent A |
| Test suites | Agent D | All |
| Release notes + rollout | Super Agent | Agent D |

## Branch and Worktree Strategy

Use isolated worktrees so each agent can work in parallel safely.

Naming:

- Branch: `agent/<track>/<topic>`
- Worktree folder: sibling folder to repo

Example:

- `agent/backend/keyword-api`
- `agent/frontend/keyword-ui`
- `agent/infra/export-worker`
- `agent/qa/regression`

## Step-by-Step Setup

## 1) Create worktrees

From repo root:

```bash
chmod +x scripts/setup-agent-worktrees.sh
./scripts/setup-agent-worktrees.sh main sprint-keyword
```

This creates:

- `../clippers-agent-a`
- `../clippers-agent-b`
- `../clippers-agent-c`
- `../clippers-agent-d`

## 2) Assign tracks

- Agent A: backend tasks only.
- Agent B: frontend tasks only.
- Agent C: worker/infra tasks only.
- Agent D: tests/perf/docs/release checks only.

No cross-track edits unless Super Agent approves.

## 3) Open 4 terminals + 4 IDE windows

- Each window points to one worktree.
- Each agent runs only its own branch.

## 4) Create sprint board

Copy template:

```bash
cp docs/AGENT_EXECUTION_BOARD.md docs/AGENT_EXECUTION_BOARD.active.md
```

Then fill current sprint tasks.

## 5) Run daily operating cadence

Use this strict loop:

1. Super Agent kickoff (10 min): assign tasks, confirm dependencies.
2. Build block (90-180 min): agents execute in parallel.
3. Sync checkpoint (10 min): blockers + changed contracts.
4. Integration (30-60 min): ordered merges + smoke tests.
5. End-of-day report (10 min): done/pending/risks.

## Merge Order (always)

1. Agent A (contracts, schema)
2. Agent C (worker infra relying on contracts)
3. Agent B (UI consuming final contracts)
4. Agent D (tests/perf and release checklist)

## Definition of Done Per Task

- Code merged in correct branch order.
- Lint/typecheck/tests for touched scope pass.
- API contract updated (if changed).
- Feature flags/env vars documented (if added).
- Smoke test evidence recorded in board.

## Hard Rules

- No direct commits to `main`.
- No shared branch between agents.
- No migration change without rollback note.
- No UI merge without API contract freeze.
- No release without Agent D final regression pass.

## Task Sizing

- 1 task = 2-6 hours max.
- If bigger, split into:
  - `foundation`
  - `integration`
  - `polish`

## Conflict Resolution

- Contract conflict: Agent A wins; others adapt.
- UI disagreement: Agent B proposes, Super Agent decides.
- Runtime/perf regressions: Agent C + D block merge until fixed.

## What You Manage Daily (Simple)

1. Check `docs/AGENT_EXECUTION_BOARD.active.md`.
2. Ask each agent for:
   - what changed
   - what is blocked
   - ETA
3. Let Super Agent (me) sequence merges.
4. Approve only when regression checks are green.

## Recommended Tooling

- Git worktrees (parallel local branches)
- GitHub PR templates + required checks
- Linear/Jira or markdown board (template provided)
- Optional Slack channel:
  - `#agent-a-backend`
  - `#agent-b-frontend`
  - `#agent-c-infra`
  - `#agent-d-qa`
  - `#super-agent-control`

## Rollout Path

- Week 1: run with 2 agents to stabilize workflow.
- Week 2: move to all 4 agents.
- Week 3+: enforce quality gates and automated checks on every merge.

## Immediate Next Action

Run:

```bash
./scripts/setup-agent-worktrees.sh main sprint-current
cp docs/AGENT_EXECUTION_BOARD.md docs/AGENT_EXECUTION_BOARD.active.md
```

Then I will fill the active board for your current priorities and start coordinating execution.
