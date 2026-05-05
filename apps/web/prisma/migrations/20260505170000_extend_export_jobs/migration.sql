-- Phase 6 export jobs.
-- Non-destructive migration: only adds nullable/defaulted columns and indexes.

ALTER TABLE "Export"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "phase" TEXT,
  ADD COLUMN IF NOT EXISTS "outputFormat" TEXT NOT NULL DEFAULT 'mp4',
  ADD COLUMN IF NOT EXISTS "platformPreset" TEXT,
  ADD COLUMN IF NOT EXISTS "aspectRatio" TEXT,
  ADD COLUMN IF NOT EXISTS "captionTrackId" TEXT,
  ADD COLUMN IF NOT EXISTS "layoutPreset" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

UPDATE "Export" e
SET "userId" = p."userId"
FROM "Project" p
WHERE e."projectId" = p."id"
  AND e."userId" IS NULL;

UPDATE "Export"
SET "progress" = CASE
  WHEN "status" IN ('done', 'completed') THEN 100
  WHEN "status" = 'processing' THEN 50
  WHEN "status" = 'failed' THEN 100
  ELSE 0
END
WHERE "progress" = 0;

CREATE INDEX IF NOT EXISTS "Export_userId_idx" ON "Export"("userId");
CREATE INDEX IF NOT EXISTS "Export_userId_status_idx" ON "Export"("userId", "status");
