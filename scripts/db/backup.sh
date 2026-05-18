#!/usr/bin/env bash
set -euo pipefail

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required but was not found in PATH." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
output="$BACKUP_DIR/viralsnipai-$timestamp.dump"

echo "Creating PostgreSQL backup at $output"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$output"
echo "Backup complete: $output"
