-- SnipRadar performance indexes for hot read paths and scheduler/analytics queries

CREATE INDEX IF NOT EXISTS "x_accounts_userId_isActive_idx"
  ON "x_accounts" ("userId", "isActive");

CREATE INDEX IF NOT EXISTS "x_tracked_accounts_userId_xAccountId_isActive_createdAt_idx"
  ON "x_tracked_accounts" ("userId", "xAccountId", "isActive", "createdAt");

CREATE INDEX IF NOT EXISTS "viral_tweets_trackedAccountId_isAnalyzed_publishedAt_idx"
  ON "viral_tweets" ("trackedAccountId", "isAnalyzed", "publishedAt");

CREATE INDEX IF NOT EXISTS "viral_tweets_trackedAccountId_viralScore_likes_idx"
  ON "viral_tweets" ("trackedAccountId", "viralScore", "likes");

CREATE INDEX IF NOT EXISTS "tweet_drafts_userId_xAccountId_status_idx"
  ON "tweet_drafts" ("userId", "xAccountId", "status");

CREATE INDEX IF NOT EXISTS "tweet_drafts_userId_xAccountId_status_createdAt_idx"
  ON "tweet_drafts" ("userId", "xAccountId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "tweet_drafts_userId_xAccountId_status_postedAt_idx"
  ON "tweet_drafts" ("userId", "xAccountId", "status", "postedAt");

CREATE INDEX IF NOT EXISTS "tweet_drafts_userId_xAccountId_status_scheduledFor_idx"
  ON "tweet_drafts" ("userId", "xAccountId", "status", "scheduledFor");

CREATE INDEX IF NOT EXISTS "tweet_drafts_userId_xAccountId_postedTweetId_idx"
  ON "tweet_drafts" ("userId", "xAccountId", "postedTweetId");
