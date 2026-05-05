-- Phase 9 social publishing foundation.
-- Non-destructive migration: creates new tables only.

CREATE TABLE IF NOT EXISTS "SocialPost" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "clipId" TEXT NOT NULL,
  "exportJobId" TEXT,
  "platform" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "title" TEXT,
  "description" TEXT,
  "hashtags" JSONB,
  "cta" TEXT,
  "thumbnailUrl" TEXT,
  "videoUrl" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "error" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScheduledPublishJob" (
  "id" TEXT NOT NULL,
  "socialPostId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScheduledPublishJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShareLink" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "clipId" TEXT,
  "token" TEXT NOT NULL,
  "permission" TEXT NOT NULL DEFAULT 'view',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SocialAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "accountName" TEXT,
  "accountHandle" TEXT,
  "status" TEXT NOT NULL DEFAULT 'placeholder',
  "encryptedTokens" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShareLink_token_key" ON "ShareLink"("token");

CREATE INDEX IF NOT EXISTS "SocialPost_userId_idx" ON "SocialPost"("userId");
CREATE INDEX IF NOT EXISTS "SocialPost_projectId_idx" ON "SocialPost"("projectId");
CREATE INDEX IF NOT EXISTS "SocialPost_clipId_idx" ON "SocialPost"("clipId");
CREATE INDEX IF NOT EXISTS "SocialPost_exportJobId_idx" ON "SocialPost"("exportJobId");
CREATE INDEX IF NOT EXISTS "SocialPost_platform_idx" ON "SocialPost"("platform");
CREATE INDEX IF NOT EXISTS "SocialPost_status_idx" ON "SocialPost"("status");
CREATE INDEX IF NOT EXISTS "SocialPost_userId_status_idx" ON "SocialPost"("userId", "status");
CREATE INDEX IF NOT EXISTS "SocialPost_scheduledAt_idx" ON "SocialPost"("scheduledAt");

CREATE INDEX IF NOT EXISTS "ScheduledPublishJob_socialPostId_idx" ON "ScheduledPublishJob"("socialPostId");
CREATE INDEX IF NOT EXISTS "ScheduledPublishJob_status_idx" ON "ScheduledPublishJob"("status");
CREATE INDEX IF NOT EXISTS "ScheduledPublishJob_scheduledAt_idx" ON "ScheduledPublishJob"("scheduledAt");
CREATE INDEX IF NOT EXISTS "ScheduledPublishJob_status_scheduledAt_idx" ON "ScheduledPublishJob"("status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "ShareLink_projectId_idx" ON "ShareLink"("projectId");
CREATE INDEX IF NOT EXISTS "ShareLink_clipId_idx" ON "ShareLink"("clipId");
CREATE INDEX IF NOT EXISTS "ShareLink_permission_idx" ON "ShareLink"("permission");
CREATE INDEX IF NOT EXISTS "ShareLink_expiresAt_idx" ON "ShareLink"("expiresAt");

CREATE INDEX IF NOT EXISTS "SocialAccount_userId_idx" ON "SocialAccount"("userId");
CREATE INDEX IF NOT EXISTS "SocialAccount_platform_idx" ON "SocialAccount"("platform");
CREATE INDEX IF NOT EXISTS "SocialAccount_status_idx" ON "SocialAccount"("status");
CREATE INDEX IF NOT EXISTS "SocialAccount_userId_platform_idx" ON "SocialAccount"("userId", "platform");

ALTER TABLE "SocialPost"
  ADD CONSTRAINT "SocialPost_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialPost"
  ADD CONSTRAINT "SocialPost_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialPost"
  ADD CONSTRAINT "SocialPost_clipId_fkey"
  FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialPost"
  ADD CONSTRAINT "SocialPost_exportJobId_fkey"
  FOREIGN KEY ("exportJobId") REFERENCES "Export"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScheduledPublishJob"
  ADD CONSTRAINT "ScheduledPublishJob_socialPostId_fkey"
  FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShareLink"
  ADD CONSTRAINT "ShareLink_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShareLink"
  ADD CONSTRAINT "ShareLink_clipId_fkey"
  FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialAccount"
  ADD CONSTRAINT "SocialAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
