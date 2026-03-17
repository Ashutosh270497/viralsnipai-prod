-- SnipRadar Research Copilot persistent index

CREATE TABLE IF NOT EXISTS "x_research_documents" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "snippet" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "normalizedText" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "embedding" JSONB,
  "embeddingModel" TEXT,
  "embeddedAt" TIMESTAMP(3),
  "sourceUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "x_research_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "x_research_index_runs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "documentsScanned" INTEGER NOT NULL DEFAULT 0,
  "documentsUpserted" INTEGER NOT NULL DEFAULT 0,
  "documentsDeleted" INTEGER NOT NULL DEFAULT 0,
  "documentsEmbedded" INTEGER NOT NULL DEFAULT 0,
  "failedEmbeddings" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "x_research_index_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "x_research_documents_userId_source_sourceRecordId_key"
  ON "x_research_documents" ("userId", "source", "sourceRecordId");

CREATE INDEX IF NOT EXISTS "x_research_documents_userId_source_idx"
  ON "x_research_documents" ("userId", "source");

CREATE INDEX IF NOT EXISTS "x_research_documents_userId_updatedAt_idx"
  ON "x_research_documents" ("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "x_research_documents_userId_embeddedAt_idx"
  ON "x_research_documents" ("userId", "embeddedAt");

CREATE INDEX IF NOT EXISTS "x_research_index_runs_userId_createdAt_idx"
  ON "x_research_index_runs" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "x_research_index_runs_createdAt_idx"
  ON "x_research_index_runs" ("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'x_research_documents_userId_fkey'
  ) THEN
    ALTER TABLE "x_research_documents"
      ADD CONSTRAINT "x_research_documents_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'x_research_index_runs_userId_fkey'
  ) THEN
    ALTER TABLE "x_research_index_runs"
      ADD CONSTRAINT "x_research_index_runs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
