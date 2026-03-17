-- Scheduler run observability for SnipRadar

CREATE TABLE IF NOT EXISTS "x_scheduler_runs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attempted" INTEGER NOT NULL DEFAULT 0,
  "posted" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "lockAcquired" BOOLEAN NOT NULL DEFAULT true,
  "durationMs" INTEGER,
  "errorSummary" TEXT,
  "failureReasons" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "x_scheduler_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "x_scheduler_runs_createdAt_idx"
  ON "x_scheduler_runs" ("createdAt");

CREATE INDEX IF NOT EXISTS "x_scheduler_runs_userId_createdAt_idx"
  ON "x_scheduler_runs" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "x_scheduler_runs_source_createdAt_idx"
  ON "x_scheduler_runs" ("source", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'x_scheduler_runs_userId_fkey'
  ) THEN
    ALTER TABLE "x_scheduler_runs"
      ADD CONSTRAINT "x_scheduler_runs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
