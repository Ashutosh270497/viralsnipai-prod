CREATE TABLE IF NOT EXISTS "competitors" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "channelTitle" TEXT NOT NULL,
  "channelUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "description" TEXT,
  "category" TEXT,
  "subscriberCount" INTEGER NOT NULL DEFAULT 0,
  "videoCount" INTEGER NOT NULL DEFAULT 0,
  "viewCount" BIGINT NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "syncStatus" TEXT NOT NULL DEFAULT 'idle',
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncQueuedAt" TIMESTAMP(3),
  "lastSyncReason" TEXT,
  "lastSyncError" TEXT,
  "syncFailureCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competitors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "competitor_snapshots" (
  "id" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "subscriberCount" INTEGER NOT NULL,
  "videoCount" INTEGER NOT NULL,
  "viewCount" BIGINT NOT NULL,
  "subsGrowth" INTEGER NOT NULL DEFAULT 0,
  "viewsGrowth" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competitor_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitor_snapshots_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "competitor_videos" (
  "id" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "thumbnailUrl" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "duration" INTEGER,
  "views" INTEGER NOT NULL DEFAULT 0,
  "likes" INTEGER DEFAULT 0,
  "comments" INTEGER DEFAULT 0,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isViral" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competitor_videos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitor_videos_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "competitor_alerts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "videoId" TEXT,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competitor_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitor_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "competitors_userId_channelId_key" ON "competitors"("userId", "channelId");
CREATE INDEX IF NOT EXISTS "competitors_userId_idx" ON "competitors"("userId");
CREATE INDEX IF NOT EXISTS "competitors_channelId_idx" ON "competitors"("channelId");
CREATE INDEX IF NOT EXISTS "competitors_syncStatus_idx" ON "competitors"("syncStatus");
CREATE INDEX IF NOT EXISTS "competitors_lastSyncQueuedAt_idx" ON "competitors"("lastSyncQueuedAt");

CREATE INDEX IF NOT EXISTS "competitor_snapshots_competitorId_idx" ON "competitor_snapshots"("competitorId");
CREATE INDEX IF NOT EXISTS "competitor_snapshots_createdAt_idx" ON "competitor_snapshots"("createdAt");
CREATE INDEX IF NOT EXISTS "competitor_snapshots_competitorId_createdAt_idx" ON "competitor_snapshots"("competitorId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "competitor_videos_competitorId_videoId_key" ON "competitor_videos"("competitorId", "videoId");
CREATE INDEX IF NOT EXISTS "competitor_videos_competitorId_idx" ON "competitor_videos"("competitorId");
CREATE INDEX IF NOT EXISTS "competitor_videos_publishedAt_idx" ON "competitor_videos"("publishedAt");
CREATE INDEX IF NOT EXISTS "competitor_videos_competitorId_publishedAt_idx" ON "competitor_videos"("competitorId", "publishedAt");

CREATE INDEX IF NOT EXISTS "competitor_alerts_userId_isRead_idx" ON "competitor_alerts"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "competitor_alerts_userId_createdAt_idx" ON "competitor_alerts"("userId", "createdAt");
