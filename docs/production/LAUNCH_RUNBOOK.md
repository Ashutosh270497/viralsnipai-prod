# V1 Launch Runbook

## Before Deploy

- [ ] CI passes.
- [ ] Staging deploy passes smoke test.
- [ ] Production env validates through `/api/health/ready`.
- [ ] Database backup completed.
- [ ] Razorpay checklist completed.
- [ ] S3 upload/export verified.
- [ ] Upstash Redis configured.
- [ ] Monitoring alerts configured.
- [ ] V2/V3 feature flags are false.

## During Deploy

1. Put deployment in low-traffic window.
2. Run migrations if required.
3. Build and start app.
4. Check `/api/health`.
5. Check `/api/health/ready`.
6. Watch logs for 15 minutes.

## Smoke Test

1. Sign up/sign in.
2. Create/select project.
3. Upload small MP4.
4. Generate 3 clips.
5. Open editor.
6. Edit/save transcript.
7. Mark one clip export-ready.
8. Export YouTube Shorts MP4.
9. Download MP4.
10. Confirm usage counters.

## Rollback

1. Stop new deploy.
2. Restore previous app version.
3. Do not rollback DB unless migration caused data loss or schema incompatibility.
4. If DB rollback is needed, follow `DATABASE_BACKUP_RESTORE.md`.
5. Mark incident timeline.

## Post-Launch Watch Window

- Watch app health, DB health, export queue, billing webhooks, and 500s for 2 hours.
- Review failed exports daily for the first week.
- Keep signups controlled until load test and mobile QA pass.
