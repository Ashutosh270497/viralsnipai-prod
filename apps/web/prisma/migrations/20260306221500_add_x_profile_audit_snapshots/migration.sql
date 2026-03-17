-- SnipRadar Profile Audit snapshot history

CREATE TABLE IF NOT EXISTS "x_profile_audit_snapshots" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "xAccountId" TEXT NOT NULL,
  "xUserId" TEXT NOT NULL,
  "xUsername" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "grade" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "quickWins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "stats" JSONB NOT NULL,
  "pillars" JSONB NOT NULL,
  "ai" JSONB,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "x_profile_audit_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "x_profile_audit_snapshots_userId_createdAt_idx"
  ON "x_profile_audit_snapshots" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "x_profile_audit_snapshots_xAccountId_createdAt_idx"
  ON "x_profile_audit_snapshots" ("xAccountId", "createdAt");

CREATE INDEX IF NOT EXISTS "x_profile_audit_snapshots_userId_fingerprint_createdAt_idx"
  ON "x_profile_audit_snapshots" ("userId", "fingerprint", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'x_profile_audit_snapshots_userId_fkey'
  ) THEN
    ALTER TABLE "x_profile_audit_snapshots"
      ADD CONSTRAINT "x_profile_audit_snapshots_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'x_profile_audit_snapshots_xAccountId_fkey'
  ) THEN
    ALTER TABLE "x_profile_audit_snapshots"
      ADD CONSTRAINT "x_profile_audit_snapshots_xAccountId_fkey"
      FOREIGN KEY ("xAccountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
