# Database Backup And Restore

## Required Before Launch

- Enable automated daily backups in Supabase/Postgres.
- Confirm retention window and PITR availability.
- Run one restore drill into a temporary database.
- Take a manual backup before every schema migration.

## Manual Backup

```bash
DATABASE_URL="postgresql://..." scripts/db/backup.sh
```

Backups are written to `backups/postgres` by default. This path is local; move backups to secure storage after creation.

## Manual Restore

Restore only into a staging or recovery database unless you are executing an approved incident plan.

```bash
DATABASE_URL="postgresql://recovery-db" scripts/db/restore.sh backups/postgres/viralsnipai-YYYYMMDDTHHMMSSZ.dump
```

## Restore Drill Checklist

1. Create a temporary restore database.
2. Restore latest backup.
3. Run `pnpm --filter web exec prisma validate`.
4. Start app against restored DB.
5. Verify auth, projects, clips, exports, usage logs, and billing records.
6. Delete temporary DB after verification.

## Migration Rule

Before every production migration:

1. Backup.
2. Verify migration on staging.
3. Confirm rollback plan.
4. Run during a low-traffic window.
