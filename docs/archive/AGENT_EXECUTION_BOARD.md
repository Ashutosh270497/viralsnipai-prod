# Agent Execution Board (Template)

Use this as the single source of truth per sprint.

## Sprint Meta

- Sprint Name:
- Dates:
- Super Agent:
- Release Target:

## Agent Assignment

| Agent | Scope | Branch | Worktree | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Agent A | Backend/API | `agent/backend/...` | `../clippers-agent-a` |  | Planned |
| Agent B | Frontend/UX | `agent/frontend/...` | `../clippers-agent-b` |  | Planned |
| Agent C | Workers/Infra | `agent/infra/...` | `../clippers-agent-c` |  | Planned |
| Agent D | QA/Perf | `agent/qa/...` | `../clippers-agent-d` |  | Planned |

## Backlog

| ID | Task | Track | Dependency | Priority | Est. | Status |
| --- | --- | --- | --- | --- | --- | --- |
| KR-001 |  | Agent A | - | P0 |  | Todo |
| KR-002 |  | Agent B | KR-001 | P0 |  | Todo |
| KR-003 |  | Agent C | KR-001 | P1 |  | Todo |
| KR-004 |  | Agent D | KR-001,KR-002,KR-003 | P0 |  | Todo |

## In Progress

| ID | Agent | What changed | Blocker | ETA | Status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Integration Plan

Merge order:

1. Agent A PR:
2. Agent C PR:
3. Agent B PR:
4. Agent D PR:

## Validation Checklist

- [ ] Lint passed (touched scope)
- [ ] Typecheck passed (touched scope)
- [ ] Tests passed (unit/integration)
- [ ] Migrations safe and reviewed
- [ ] API contracts updated
- [ ] UI smoke test passed
- [ ] Worker/job smoke test passed
- [ ] Performance baseline unchanged or improved

## Risks and Mitigations

| Risk | Impact | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- |
|  |  |  |  | Open |

## Daily Sync Log

### Day 1

- Agent A:
- Agent B:
- Agent C:
- Agent D:
- Super Agent decision:

### Day 2

- Agent A:
- Agent B:
- Agent C:
- Agent D:
- Super Agent decision:

## Release Decision

- Go/No-Go:
- Reason:
- Follow-up items:
