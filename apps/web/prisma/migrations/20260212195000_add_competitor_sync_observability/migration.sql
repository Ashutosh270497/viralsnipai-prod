ALTER TABLE IF EXISTS "competitors"
  ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSyncQueuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSyncReason" TEXT,
  ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT,
  ADD COLUMN IF NOT EXISTS "syncFailureCount" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF to_regclass('public.competitors') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "competitors_syncStatus_idx" ON "competitors"("syncStatus");
    CREATE INDEX IF NOT EXISTS "competitors_lastSyncQueuedAt_idx" ON "competitors"("lastSyncQueuedAt");
  END IF;
END $$;
