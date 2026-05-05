-- Phase 8 brand templates are additive and non-destructive.
-- Existing users, brand kits, projects, clips, and exports are untouched.
CREATE TABLE IF NOT EXISTS "BrandTemplate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "captionStyle" JSONB,
  "layoutConfig" JSONB,
  "overlayStyle" JSONB,
  "logoAssetId" TEXT,
  "logoUrl" TEXT,
  "watermarkConfig" JSONB,
  "introConfig" JSONB,
  "outroConfig" JSONB,
  "defaultCTA" TEXT,
  "defaultPlatformPresets" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrandTemplate_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'BrandTemplate_userId_fkey'
      AND table_name = 'BrandTemplate'
  ) THEN
    ALTER TABLE "BrandTemplate"
      ADD CONSTRAINT "BrandTemplate_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BrandTemplate_userId_idx" ON "BrandTemplate"("userId");
CREATE INDEX IF NOT EXISTS "BrandTemplate_userId_isDefault_idx" ON "BrandTemplate"("userId", "isDefault");
CREATE INDEX IF NOT EXISTS "BrandTemplate_userId_updatedAt_idx" ON "BrandTemplate"("userId", "updatedAt");

-- Enforce at most one default template per user while allowing many non-default templates.
CREATE UNIQUE INDEX IF NOT EXISTS "BrandTemplate_one_default_per_user"
  ON "BrandTemplate"("userId")
  WHERE "isDefault" = true;
