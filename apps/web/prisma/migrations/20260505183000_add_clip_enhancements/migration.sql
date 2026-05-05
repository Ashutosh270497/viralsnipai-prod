-- Phase 7 creative enhancements are additive and non-destructive.
-- Existing clips remain unchanged; new enhancement rows cascade only when a clip is deleted.
CREATE TABLE IF NOT EXISTS "ClipEnhancement" (
  "id" TEXT NOT NULL,
  "clipId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "startMs" INTEGER NOT NULL,
  "endMs" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClipEnhancement_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ClipEnhancement_clipId_fkey'
      AND table_name = 'ClipEnhancement'
  ) THEN
    ALTER TABLE "ClipEnhancement"
      ADD CONSTRAINT "ClipEnhancement_clipId_fkey"
      FOREIGN KEY ("clipId") REFERENCES "Clip"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ClipEnhancement_clipId_idx" ON "ClipEnhancement"("clipId");
CREATE INDEX IF NOT EXISTS "ClipEnhancement_clipId_enabled_idx" ON "ClipEnhancement"("clipId", "enabled");
CREATE INDEX IF NOT EXISTS "ClipEnhancement_type_idx" ON "ClipEnhancement"("type");
