-- Scheduler and maintenance query acceleration for high-concurrency SnipRadar workloads
CREATE INDEX IF NOT EXISTS "tweet_drafts_status_scheduledFor_idx"
  ON "tweet_drafts"("status", "scheduledFor");

CREATE INDEX IF NOT EXISTS "tweet_drafts_status_postedAt_idx"
  ON "tweet_drafts"("status", "postedAt");

CREATE INDEX IF NOT EXISTS "x_engagement_opportunities_userId_lastSeenAt_idx"
  ON "x_engagement_opportunities"("userId", "lastSeenAt");
