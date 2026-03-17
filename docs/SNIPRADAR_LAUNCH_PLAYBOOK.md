# SnipRadar Launch Playbook

Operational checklist for shipping the SnipRadar production upgrade safely.

## 1. Release Gate

Ship only when all of the following are true:

1. `docs/SNIPRADAR_EXECUTION_BOARD.active.md` shows Phases `0` through `8` as `Completed`.
2. Prisma migrations are fully applied in the target environment.
3. SnipRadar smoke, auth E2E, and verification commands pass against the release environment.
4. X OAuth callback path completes without manual intervention.
5. Export queue can move a job from `queued` to `done` on the release environment.
6. No visible debug artifacts remain in the UI or API success paths.

## 2. Environment Preflight

Confirm these values before deployment:

1. `DATABASE_URL`
2. `NEXTAUTH_URL`
3. `NEXTAUTH_SECRET`
4. `X_CLIENT_ID`
5. `X_CLIENT_SECRET`
6. `X_CALLBACK_URL` or the equivalent callback value used by the app
7. `SNIPRADAR_CRON_SECRET`
8. `SNIPRADAR_MAINTENANCE_SECRET`
9. export/render storage paths and write permissions

Hard requirement:

1. `NEXTAUTH_DEBUG` must be `false` or unset for production.

## 3. Database Rollout

Use non-destructive deploy flow only:

```bash
pnpm --filter web exec prisma migrate deploy
pnpm --filter web exec prisma generate
```

Do not use `prisma migrate dev` against shared or production databases.

## 4. Validation Commands

Run these after deploy:

```bash
pnpm --filter web run snipradar:verify
pnpm --filter web run snipradar:smoke
pnpm --filter web exec node scripts/snipradar-auth-e2e.js
```

Optional load check before opening traffic:

```bash
SNIPRADAR_DEMO_LOGIN=true \
SNIPRADAR_LOAD_CONCURRENCY=5 \
SNIPRADAR_LOAD_ITERATIONS=2 \
SNIPRADAR_LOAD_INCLUDE_QUEUE=true \
pnpm --filter web exec node scripts/load/snipradar-api-load.js
```

## 5. Manual UX Checklist

Verify these paths in the browser:

1. Connect X account
2. Overview loads with no debug/perf panel
3. Discover can add tracked account and fetch viral tweets
4. Create can generate drafts
5. Publish can schedule or process a draft
6. Analytics shows post performance and filters correctly
7. Engagement Finder refreshes or shows the polished no-data state
8. Growth Planner loads with no broken actions

## 6. Monitoring During Release

Watch for these signals:

1. `401 Unauthorized` from X API read/write paths
2. DB saturation errors:
   - `max clients reached`
   - connection pool timeouts
3. export jobs stuck in:
   - `queued`
   - `preparing`
   - `extracting`
4. scheduler runs with rising `failed` or `partial` counts
5. metrics route latency regression above normal baseline

## 7. Fast Triage Guide

### X OAuth fails

Check:

1. callback URL matches X app config exactly
2. `X_CLIENT_ID` and `X_CLIENT_SECRET`
3. cookie/domain mismatch on callback path

### Metrics look wrong

Check:

1. `/api/snipradar/metrics`
2. `xAccount` connectivity and token freshness
3. whether replies/posts are both being ingested

### Exports stall

Check:

1. render queue status in DB
2. ffmpeg availability and output path permissions
3. storage path write access

### Scheduler does not publish

Check:

1. queued draft state
2. cron secret
3. posting route auth freshness

## 8. Rollback Plan

If release health degrades:

1. stop cron-triggered posting
2. disable user-facing release entry if needed
3. redeploy last known good application build
4. keep current DB schema if migrations were additive and safe
5. only perform DB rollback if the specific migration is proven harmful and reversible

## 9. Post-Launch Review

Within 24 hours of release:

1. review auth/connect failures
2. review scheduler failure categories
3. review export completion and retry counts
4. review metrics latency on overview, discover, and analytics
5. capture first production issues into the execution board backlog
