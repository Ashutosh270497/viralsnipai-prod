ALTER TABLE "tweet_drafts"
  ADD COLUMN IF NOT EXISTS "threadGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "threadOrder" INTEGER;

CREATE INDEX IF NOT EXISTS "tweet_drafts_userId_threadGroupId_idx"
  ON "tweet_drafts"("userId", "threadGroupId");
