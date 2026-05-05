# Phase 10 Platform QA Checklist

## API Keys

- Create an API key from `POST /api/settings/api-keys`.
- Confirm the raw token is returned once.
- Confirm `GET /api/settings/api-keys` does not return the raw token.
- Revoke the key with `DELETE /api/settings/api-keys/:id`.
- Confirm revoked keys cannot access `/api/v1/*`.

## Public API Flow

- Create a clip project with `POST /api/v1/clip-projects`.
- Add an asset with `POST /api/v1/clip-projects/:id/assets`.
- Generate clips with `POST /api/v1/clip-projects/:id/generate-clips`.
- Fetch a clip with `GET /api/v1/clips/:id`.
- Queue an export with `POST /api/v1/exports`.
- Poll `GET /api/v1/jobs/:id` and `GET /api/v1/exports/:id`.

## Workspace Foundation

- Create a workspace with `POST /api/workspaces`.
- Add a member with `POST /api/workspaces/:id/members`.
- Create an API key scoped to the workspace.
- Confirm the key cannot access another workspace.

## Review Loop

- Add an authenticated clip comment with `POST /api/clips/:id/comments`.
- Add a review-link comment with `POST /api/repurpose/share-links/:token/comments`.
- Approve a clip from an approval share link.
- Record clip feedback using `POST /api/clips/:id/feedback`.

## Quality Analytics

- Open `/api/repurpose/quality/analytics?projectId=<projectId>`.
- Confirm the response includes:
  - acceptance rate
  - average manual trim delta
  - average virality score
  - candidate type performance
  - transcript precision distribution
  - boundary confidence distribution
  - preview/export/publish failure rates
  - rejection reasons

## Provider Guardrails

- Run `pnpm --filter web run repurpose:boundary-check`.
- Confirm no public API endpoint uses OpenRouter or OpenAI to create final timestamps.
