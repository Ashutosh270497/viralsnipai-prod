-- Engagement Finder v2 persistence

CREATE TABLE IF NOT EXISTS "x_engagement_opportunities" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tweetId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "authorUsername" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "authorAvatar" TEXT,
  "likes" INTEGER NOT NULL DEFAULT 0,
  "retweets" INTEGER NOT NULL DEFAULT 0,
  "replies" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "niche" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'new',
  "replyCount" INTEGER NOT NULL DEFAULT 0,
  "xCreatedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "x_engagement_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "x_engagement_opportunities_userId_tweetId_key"
  ON "x_engagement_opportunities" ("userId", "tweetId");

CREATE INDEX IF NOT EXISTS "x_engagement_opportunities_userId_status_idx"
  ON "x_engagement_opportunities" ("userId", "status");

CREATE INDEX IF NOT EXISTS "x_engagement_opportunities_userId_niche_score_lastSeenAt_idx"
  ON "x_engagement_opportunities" ("userId", "niche", "score", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "x_engagement_opportunities_userId_createdAt_idx"
  ON "x_engagement_opportunities" ("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'x_engagement_opportunities_userId_fkey'
  ) THEN
    ALTER TABLE "x_engagement_opportunities"
      ADD CONSTRAINT "x_engagement_opportunities_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
