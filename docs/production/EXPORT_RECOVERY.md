# Export Recovery

V1 exports are queued in process memory and persisted as `Export` rows. A server restart can interrupt active renders, so recovery must be operationally explicit.

## Identify Stuck Exports

Check the render queue:

```bash
curl -fsS https://YOUR_DOMAIN/api/media/render-queue/health
```

Check database rows:

```sql
select id, "projectId", status, "createdAt", "updatedAt", metadata
from "Export"
where status in ('queued', 'processing')
order by "updatedAt" asc;
```

Treat jobs as stuck if they have been `queued` or `processing` for longer than the expected render time plus 15 minutes.

## Manual Recovery

1. Confirm the user/project owns the export.
2. Inspect logs for the `exportId`.
3. If an output file exists, mark the export completed only after verifying the file downloads.
4. If no output exists, mark the export failed and ask the user to retry.

Example:

```sql
update "Export"
set status = 'failed',
    metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{recovery}', '"marked_failed_manual"')
where id = '<export_id>';
```

## Output File Locations

- Local dev: `apps/web/public/uploads/exports` or configured local upload directory.
- Production: S3 bucket configured by `S3_BUCKET`.

## Future Fix

Before horizontal scaling, replace the in-memory queue with BullMQ/Redis, Inngest, or a worker process with persistent retries and idempotent job claims.
