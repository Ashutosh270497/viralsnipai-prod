CREATE TABLE IF NOT EXISTS "x_research_inbox_items" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "trackedAccountId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'browser_extension',
  "itemType" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "xEntityId" TEXT,
  "title" TEXT,
  "text" TEXT,
  "authorUsername" TEXT,
  "authorDisplayName" TEXT,
  "authorAvatarUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "note" TEXT,
  "generatedReply" TEXT,
  "generatedRemix" TEXT,
  "metadata" JSONB,
  "lastActionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "x_research_inbox_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "x_research_inbox_items_userId_sourceUrl_key"
  ON "x_research_inbox_items"("userId", "sourceUrl");

CREATE INDEX IF NOT EXISTS "x_research_inbox_items_userId_status_updatedAt_idx"
  ON "x_research_inbox_items"("userId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "x_research_inbox_items_userId_itemType_updatedAt_idx"
  ON "x_research_inbox_items"("userId", "itemType", "updatedAt");

CREATE INDEX IF NOT EXISTS "x_research_inbox_items_trackedAccountId_idx"
  ON "x_research_inbox_items"("trackedAccountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'x_research_inbox_items_userId_fkey'
      AND table_name = 'x_research_inbox_items'
  ) THEN
    ALTER TABLE "x_research_inbox_items"
      ADD CONSTRAINT "x_research_inbox_items_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'x_research_inbox_items_trackedAccountId_fkey'
      AND table_name = 'x_research_inbox_items'
  ) THEN
    ALTER TABLE "x_research_inbox_items"
      ADD CONSTRAINT "x_research_inbox_items_trackedAccountId_fkey"
      FOREIGN KEY ("trackedAccountId")
      REFERENCES "x_tracked_accounts"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
