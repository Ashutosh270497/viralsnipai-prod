# SnipRadar Launch Execution Board

Date: 2026-03-22
Status source: `docs/snipradar_wave0_baseline.md`
Deployment target: Coolify self-hosted on Hostinger VPS

## Rule

No production launch sign-off until every `launch_blocker` item below is closed.

## Board

| ID | Workstream | Status | Priority | Owner | Target Wave | Launch Impact | Evidence / Primary Files |
|---|---|---|---|---|---|---|---|
| LB-01 | Extension reliability sign-off on live X compose | partial | p0 | engineering | 3 | main differentiator trust | `apps/browser-extension/content-script.js`, `apps/browser-extension/service-worker.js` |
| LB-02 | WinnerLoop completion or claim narrowing | partial | p1 | product + engineering | 3 | automation credibility | `apps/web/components/snipradar/winner-loop-panel.tsx`, `apps/web/app/api/snipradar/winners/automations/route.ts` |
| LB-03 | Remove or explicitly approve remaining direct AI fallbacks in SnipRadar | partial | p1 | engineering | 5 | routing consistency / cost control | `apps/web/lib/ai/growth-planner.ts`, `apps/web/lib/ai/growth-coach.ts`, `apps/web/lib/ai/winner-loop.ts`, `apps/web/lib/ai/profile-audit.ts`, `apps/web/lib/ai/research-inbox.ts`, `apps/web/lib/ai/snipradar-extension.ts` |
| LB-04 | Live billing validation on real deployed environment | partial | p0 | engineering + QA | 5 | paid conversion risk | `docs/deployment_checklist_for_production.md`, `apps/web/app/billing/page.tsx` |
| LB-05 | X auth refresh and reconnect drill | partial | p0 | engineering | 5 | account connectivity risk | `apps/web/lib/snipradar/x-auth.ts`, `apps/web/app/api/snipradar/callback/route.ts` |
| LB-06 | Diagnostics sign-off for scheduler, automations, billing, X auth | partial | p1 | engineering | 5 | post-launch debugging speed | `apps/web/app/api/snipradar/health/route.ts`, `apps/web/app/(workspace)/snipradar/publish/page.tsx` |
| LB-07 | Mobile degradation review for SnipRadar Create / Inbox / Publish | partial | p2 | frontend | 6 | mobile usability / trust | `apps/web/lib/platform/responsive-support-matrix.ts` |
| LB-08 | Coolify + Hostinger production config completion | pending | p0 | ops / engineering | deploy | deployability | `docs/deployment_checklist_for_production.md` |

## Closed

| ID | Workstream | Status |
|---|---|---|
| CL-01 | SnipRadar onboarding and niche-aware activation | complete |
| CL-02 | Seeded Discover and first-run CTAs | complete |
| CL-03 | Auto-DM MVP | complete |
| CL-04 | Growth Planner backend and UI | complete |
| CL-05 | Discover search and advanced filters | complete |
| CL-06 | Thread Writer live preview and tweet counts | complete |
| CL-07 | Research onboarding improvements | complete |

## Exit Criteria for Launch

- all `launch_blocker` items moved to `complete`
- `docs/deployment_checklist_for_production.md` completed for the actual production environment
- one live end-to-end pass succeeds for:
  - X connect
  - seeded Discover
  - draft generation
  - scheduling
  - Auto-DM
  - billing upgrade
  - webhook reconciliation

## Notes

- This is an execution board, not a backlog dump.
- If a blocker is descoped, the product language and launch claims must be updated first.
