-- Phase 10 platform/API and quality learning-loop foundation.
-- Non-destructive migration: adds nullable columns and new tables only.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "BrandTemplate" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

CREATE TABLE IF NOT EXISTS "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceMember" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "name" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClipComment" (
  "id" TEXT NOT NULL,
  "clipId" TEXT NOT NULL,
  "userId" TEXT,
  "shareLinkId" TEXT,
  "body" TEXT NOT NULL,
  "timestampMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClipComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClipFeedback" (
  "id" TEXT NOT NULL,
  "clipId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "rating" INTEGER,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "manualTrimDeltaMs" INTEGER,
  "captionEditsCount" INTEGER,
  "previewPlays" INTEGER NOT NULL DEFAULT 0,
  "exportedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClipFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

CREATE INDEX IF NOT EXISTS "Project_workspaceId_idx" ON "Project"("workspaceId");
CREATE INDEX IF NOT EXISTS "BrandTemplate_workspaceId_idx" ON "BrandTemplate"("workspaceId");
CREATE INDEX IF NOT EXISTS "SocialPost_workspaceId_idx" ON "SocialPost"("workspaceId");

CREATE INDEX IF NOT EXISTS "Workspace_ownerId_idx" ON "Workspace"("ownerId");
CREATE INDEX IF NOT EXISTS "Workspace_plan_idx" ON "Workspace"("plan");

CREATE INDEX IF NOT EXISTS "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");
CREATE INDEX IF NOT EXISTS "WorkspaceMember_role_idx" ON "WorkspaceMember"("role");

CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX IF NOT EXISTS "ApiKey_workspaceId_idx" ON "ApiKey"("workspaceId");
CREATE INDEX IF NOT EXISTS "ApiKey_status_idx" ON "ApiKey"("status");
CREATE INDEX IF NOT EXISTS "ApiKey_prefix_idx" ON "ApiKey"("prefix");

CREATE INDEX IF NOT EXISTS "ClipComment_clipId_idx" ON "ClipComment"("clipId");
CREATE INDEX IF NOT EXISTS "ClipComment_userId_idx" ON "ClipComment"("userId");
CREATE INDEX IF NOT EXISTS "ClipComment_shareLinkId_idx" ON "ClipComment"("shareLinkId");
CREATE INDEX IF NOT EXISTS "ClipComment_createdAt_idx" ON "ClipComment"("createdAt");

CREATE INDEX IF NOT EXISTS "ClipFeedback_clipId_idx" ON "ClipFeedback"("clipId");
CREATE INDEX IF NOT EXISTS "ClipFeedback_userId_idx" ON "ClipFeedback"("userId");
CREATE INDEX IF NOT EXISTS "ClipFeedback_workspaceId_idx" ON "ClipFeedback"("workspaceId");
CREATE INDEX IF NOT EXISTS "ClipFeedback_status_idx" ON "ClipFeedback"("status");
CREATE INDEX IF NOT EXISTS "ClipFeedback_createdAt_idx" ON "ClipFeedback"("createdAt");

ALTER TABLE "Workspace"
  ADD CONSTRAINT "Workspace_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BrandTemplate"
  ADD CONSTRAINT "BrandTemplate_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocialPost"
  ADD CONSTRAINT "SocialPost_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClipComment"
  ADD CONSTRAINT "ClipComment_clipId_fkey"
  FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClipComment"
  ADD CONSTRAINT "ClipComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClipComment"
  ADD CONSTRAINT "ClipComment_shareLinkId_fkey"
  FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClipFeedback"
  ADD CONSTRAINT "ClipFeedback_clipId_fkey"
  FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClipFeedback"
  ADD CONSTRAINT "ClipFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClipFeedback"
  ADD CONSTRAINT "ClipFeedback_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
