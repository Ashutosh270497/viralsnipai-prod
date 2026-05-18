#!/usr/bin/env bash
set -euo pipefail

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore is required but was not found in PATH." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

backup_file="${1:-}"
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Usage: DATABASE_URL=... scripts/db/restore.sh path/to/backup.dump" >&2
  exit 1
fi

echo "Restoring PostgreSQL backup from $backup_file"
echo "Target database is read from DATABASE_URL. The URL is intentionally not printed."
pg_restore "$backup_file" --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-acl
echo "Restore complete."
