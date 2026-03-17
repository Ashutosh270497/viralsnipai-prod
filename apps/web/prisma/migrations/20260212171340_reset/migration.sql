-- DropIndex
DROP INDEX IF EXISTS "competitors_lastSyncQueuedAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "competitors_syncStatus_idx";

-- DropIndex
DROP INDEX IF EXISTS "content_ideas_niche_idx";

-- DropIndex
DROP INDEX IF EXISTS "content_ideas_userId_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "generated_scripts_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "script_audios" ADD COLUMN     "isTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "sourceLanguage" TEXT;

-- CreateTable
CREATE TABLE "keyword_research" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchVolume" INTEGER NOT NULL,
    "competition" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "trendDirection" TEXT NOT NULL,
    "avgViews" INTEGER,
    "avgLikes" INTEGER,
    "avgComments" INTEGER,
    "estimatedCPM" DOUBLE PRECISION,
    "relatedKeywords" JSONB,
    "topVideos" JSONB,
    "searchIntent" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_keywords" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "listName" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "searchVolume" INTEGER,
    "competition" INTEGER,
    "difficulty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xUserId" TEXT NOT NULL,
    "xUsername" TEXT NOT NULL,
    "xDisplayName" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "x_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_account_snapshots" (
    "id" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "followingCount" INTEGER NOT NULL,
    "tweetCount" INTEGER NOT NULL,
    "followerGrowth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "x_account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_tracked_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "trackedXUserId" TEXT NOT NULL,
    "trackedUsername" TEXT NOT NULL,
    "trackedDisplayName" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "niche" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "x_tracked_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viral_tweets" (
    "id" TEXT NOT NULL,
    "trackedAccountId" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorUsername" TEXT NOT NULL,
    "authorDisplayName" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "retweets" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "quoteTweets" INTEGER NOT NULL DEFAULT 0,
    "mediaType" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "hookType" TEXT,
    "format" TEXT,
    "emotionalTrigger" TEXT,
    "viralScore" INTEGER,
    "whyItWorked" TEXT,
    "lessonsLearned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "analyzedAt" TIMESTAMP(3),
    "isUsedForGeneration" BOOLEAN NOT NULL DEFAULT false,
    "usedForGenerationAt" TIMESTAMP(3),

    CONSTRAINT "viral_tweets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tweet_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "inspiredByTweetId" TEXT,
    "hookType" TEXT,
    "format" TEXT,
    "emotionalTrigger" TEXT,
    "aiReasoning" TEXT,
    "viralPrediction" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "postedTweetId" TEXT,
    "actualLikes" INTEGER,
    "actualRetweets" INTEGER,
    "actualReplies" INTEGER,
    "actualImpressions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tweet_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_research_userId_idx" ON "keyword_research"("userId");

-- CreateIndex
CREATE INDEX "keyword_research_keyword_idx" ON "keyword_research"("keyword");

-- CreateIndex
CREATE INDEX "keyword_research_searchVolume_idx" ON "keyword_research"("searchVolume");

-- CreateIndex
CREATE INDEX "keyword_research_difficulty_idx" ON "keyword_research"("difficulty");

-- CreateIndex
CREATE INDEX "saved_keywords_userId_idx" ON "saved_keywords"("userId");

-- CreateIndex
CREATE INDEX "saved_keywords_listName_idx" ON "saved_keywords"("listName");

-- CreateIndex
CREATE UNIQUE INDEX "saved_keywords_userId_keyword_key" ON "saved_keywords"("userId", "keyword");

-- CreateIndex
CREATE INDEX "x_accounts_userId_idx" ON "x_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "x_accounts_userId_xUserId_key" ON "x_accounts"("userId", "xUserId");

-- CreateIndex
CREATE INDEX "x_account_snapshots_xAccountId_createdAt_idx" ON "x_account_snapshots"("xAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "x_tracked_accounts_userId_idx" ON "x_tracked_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "x_tracked_accounts_userId_trackedXUserId_key" ON "x_tracked_accounts"("userId", "trackedXUserId");

-- CreateIndex
CREATE UNIQUE INDEX "viral_tweets_tweetId_key" ON "viral_tweets"("tweetId");

-- CreateIndex
CREATE INDEX "viral_tweets_trackedAccountId_publishedAt_idx" ON "viral_tweets"("trackedAccountId", "publishedAt");

-- CreateIndex
CREATE INDEX "viral_tweets_viralScore_idx" ON "viral_tweets"("viralScore");

-- CreateIndex
CREATE INDEX "tweet_drafts_userId_status_idx" ON "tweet_drafts"("userId", "status");

-- CreateIndex
CREATE INDEX "tweet_drafts_userId_createdAt_idx" ON "tweet_drafts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "script_audios_language_idx" ON "script_audios"("language");

-- AddForeignKey
ALTER TABLE "keyword_research" ADD CONSTRAINT "keyword_research_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_keywords" ADD CONSTRAINT "saved_keywords_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_accounts" ADD CONSTRAINT "x_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_account_snapshots" ADD CONSTRAINT "x_account_snapshots_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_tracked_accounts" ADD CONSTRAINT "x_tracked_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_tracked_accounts" ADD CONSTRAINT "x_tracked_accounts_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viral_tweets" ADD CONSTRAINT "viral_tweets_trackedAccountId_fkey" FOREIGN KEY ("trackedAccountId") REFERENCES "x_tracked_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweet_drafts" ADD CONSTRAINT "tweet_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweet_drafts" ADD CONSTRAINT "tweet_drafts_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
