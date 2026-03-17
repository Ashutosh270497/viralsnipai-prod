-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "youtubeChannelUrl" TEXT,
    "subscriberCount" INTEGER DEFAULT 0,
    "selectedNiche" TEXT,
    "nicheData" JSONB,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "creditsRemaining" INTEGER NOT NULL DEFAULT 5,
    "password" TEXT,
    "goalSelection" TEXT,
    "nicheInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "hooks" JSONB NOT NULL,
    "body" TEXT NOT NULL,
    "tone" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "durationSec" INTEGER,
    "transcript" TEXT,
    "sourceLanguage" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "callToAction" TEXT,
    "captionSrt" TEXT,
    "captionStyle" JSONB,
    "previewPath" TEXT,
    "thumbnail" TEXT,
    "viralityScore" INTEGER,
    "viralityFactors" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clipIds" JSONB NOT NULL,
    "preset" TEXT NOT NULL,
    "outputPath" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primaryHex" TEXT NOT NULL DEFAULT '#00A3FF',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "logoPath" TEXT,
    "logoStoragePath" TEXT,
    "captionStyle" JSONB NOT NULL,
    "watermark" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "filePath" TEXT,
    "fileUrl" TEXT,
    "title" TEXT,
    "durationSec" INTEGER,
    "transcript" TEXT,
    "segments" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "providerVoiceId" TEXT NOT NULL,
    "samplePath" TEXT,
    "sampleStoragePath" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceRender" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "audioStoragePath" TEXT NOT NULL,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceRender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "transcript_translations" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "segments" JSONB,
    "translatedFrom" TEXT NOT NULL,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caption_translations" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "captionSrt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caption_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_translations" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "voiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "translatedFrom" TEXT NOT NULL,
    "processingTime" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_ingest_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "assetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "processingTime" INTEGER,
    "metadata" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "youtube_ingest_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "competitionLevel" TEXT NOT NULL,
    "monetizationPotential" INTEGER NOT NULL,
    "averageCpm" DECIMAL(10,2),
    "averageViewsPerVideo" INTEGER,
    "growthTrend" TEXT NOT NULL,
    "exampleChannels" JSONB,
    "keywords" JSONB,
    "targetAudience" TEXT,
    "contentTypes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "niches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_ideas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "niche" TEXT,
    "videoType" TEXT,
    "viralityScore" INTEGER,
    "keywords" JSONB,
    "searchVolume" INTEGER,
    "competitionScore" INTEGER,
    "estimatedViews" INTEGER,
    "scheduledDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'idea',
    "aiReasoning" TEXT,
    "contentCategory" TEXT,
    "hookSuggestions" JSONB,
    "thumbnailIdeas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_calendars" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "generationStatus" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_scripts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentIdeaId" TEXT,
    "title" TEXT NOT NULL,
    "hook" TEXT,
    "intro" TEXT,
    "mainContent" TEXT,
    "conclusion" TEXT,
    "cta" TEXT,
    "fullScript" TEXT,
    "durationEstimate" INTEGER,
    "retentionTips" JSONB,
    "keywords" JSONB,
    "scriptStyle" TEXT,
    "tone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_versions" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT,
    "intro" TEXT,
    "mainContent" TEXT,
    "conclusion" TEXT,
    "cta" TEXT,
    "fullScript" TEXT,
    "durationEstimate" INTEGER,
    "changeDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_shares" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "sharedBy" TEXT NOT NULL,
    "sharedWith" TEXT,
    "shareToken" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL DEFAULT 'view',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_comments" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" TEXT,
    "content" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_titles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentIdeaId" TEXT,
    "title" TEXT NOT NULL,
    "ctrScore" INTEGER,
    "keywordOptimized" BOOLEAN NOT NULL DEFAULT false,
    "titleType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thumbnails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentIdeaId" TEXT,
    "imageUrl" TEXT,
    "storagePath" TEXT,
    "thumbnailPrompt" TEXT,
    "style" TEXT,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thumbnails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Script_projectId_key" ON "Script"("projectId");

-- CreateIndex
CREATE INDEX "Asset_projectId_idx" ON "Asset"("projectId");

-- CreateIndex
CREATE INDEX "Asset_projectId_createdAt_idx" ON "Asset"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Clip_projectId_idx" ON "Clip"("projectId");

-- CreateIndex
CREATE INDEX "Clip_assetId_idx" ON "Clip"("assetId");

-- CreateIndex
CREATE INDEX "Clip_projectId_assetId_idx" ON "Clip"("projectId", "assetId");

-- CreateIndex
CREATE INDEX "Clip_projectId_viralityScore_idx" ON "Clip"("projectId", "viralityScore" DESC);

-- CreateIndex
CREATE INDEX "Clip_projectId_order_idx" ON "Clip"("projectId", "order");

-- CreateIndex
CREATE INDEX "Export_projectId_idx" ON "Export"("projectId");

-- CreateIndex
CREATE INDEX "Export_status_idx" ON "Export"("status");

-- CreateIndex
CREATE INDEX "Export_projectId_status_idx" ON "Export"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_userId_key" ON "BrandKit"("userId");

-- CreateIndex
CREATE INDEX "TranscriptJob_userId_idx" ON "TranscriptJob"("userId");

-- CreateIndex
CREATE INDEX "TranscriptJob_status_idx" ON "TranscriptJob"("status");

-- CreateIndex
CREATE INDEX "TranscriptJob_userId_status_idx" ON "TranscriptJob"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceProfile_providerVoiceId_key" ON "VoiceProfile"("providerVoiceId");

-- CreateIndex
CREATE INDEX "VoiceProfile_userId_idx" ON "VoiceProfile"("userId");

-- CreateIndex
CREATE INDEX "VoiceRender_userId_idx" ON "VoiceRender"("userId");

-- CreateIndex
CREATE INDEX "VoiceRender_voiceId_idx" ON "VoiceRender"("voiceId");

-- CreateIndex
CREATE INDEX "VoiceRender_userId_voiceId_idx" ON "VoiceRender"("userId", "voiceId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "transcript_translations_assetId_idx" ON "transcript_translations"("assetId");

-- CreateIndex
CREATE INDEX "transcript_translations_language_idx" ON "transcript_translations"("language");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_translations_assetId_language_key" ON "transcript_translations"("assetId", "language");

-- CreateIndex
CREATE INDEX "caption_translations_clipId_idx" ON "caption_translations"("clipId");

-- CreateIndex
CREATE INDEX "caption_translations_language_idx" ON "caption_translations"("language");

-- CreateIndex
CREATE UNIQUE INDEX "caption_translations_clipId_language_key" ON "caption_translations"("clipId", "language");

-- CreateIndex
CREATE INDEX "voice_translations_assetId_idx" ON "voice_translations"("assetId");

-- CreateIndex
CREATE INDEX "voice_translations_status_idx" ON "voice_translations"("status");

-- CreateIndex
CREATE INDEX "voice_translations_language_idx" ON "voice_translations"("language");

-- CreateIndex
CREATE UNIQUE INDEX "voice_translations_assetId_language_key" ON "voice_translations"("assetId", "language");

-- CreateIndex
CREATE INDEX "youtube_ingest_jobs_projectId_idx" ON "youtube_ingest_jobs"("projectId");

-- CreateIndex
CREATE INDEX "youtube_ingest_jobs_status_idx" ON "youtube_ingest_jobs"("status");

-- CreateIndex
CREATE INDEX "youtube_ingest_jobs_assetId_idx" ON "youtube_ingest_jobs"("assetId");

-- CreateIndex
CREATE INDEX "content_ideas_userId_idx" ON "content_ideas"("userId");

-- CreateIndex
CREATE INDEX "content_ideas_calendarId_idx" ON "content_ideas"("calendarId");

-- CreateIndex
CREATE INDEX "content_ideas_scheduledDate_idx" ON "content_ideas"("scheduledDate");

-- CreateIndex
CREATE INDEX "content_ideas_userId_scheduledDate_idx" ON "content_ideas"("userId", "scheduledDate");

-- CreateIndex
CREATE INDEX "content_calendars_userId_idx" ON "content_calendars"("userId");

-- CreateIndex
CREATE INDEX "content_calendars_userId_createdAt_idx" ON "content_calendars"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "generated_scripts_userId_idx" ON "generated_scripts"("userId");

-- CreateIndex
CREATE INDEX "generated_scripts_contentIdeaId_idx" ON "generated_scripts"("contentIdeaId");

-- CreateIndex
CREATE INDEX "generated_scripts_userId_contentIdeaId_idx" ON "generated_scripts"("userId", "contentIdeaId");

-- CreateIndex
CREATE INDEX "script_versions_scriptId_idx" ON "script_versions"("scriptId");

-- CreateIndex
CREATE INDEX "script_versions_userId_idx" ON "script_versions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "script_shares_shareToken_key" ON "script_shares"("shareToken");

-- CreateIndex
CREATE INDEX "script_shares_scriptId_idx" ON "script_shares"("scriptId");

-- CreateIndex
CREATE INDEX "script_shares_sharedBy_idx" ON "script_shares"("sharedBy");

-- CreateIndex
CREATE INDEX "script_shares_shareToken_idx" ON "script_shares"("shareToken");

-- CreateIndex
CREATE INDEX "script_comments_scriptId_idx" ON "script_comments"("scriptId");

-- CreateIndex
CREATE INDEX "script_comments_userId_idx" ON "script_comments"("userId");

-- CreateIndex
CREATE INDEX "generated_titles_userId_idx" ON "generated_titles"("userId");

-- CreateIndex
CREATE INDEX "generated_titles_contentIdeaId_idx" ON "generated_titles"("contentIdeaId");

-- CreateIndex
CREATE INDEX "generated_titles_userId_contentIdeaId_idx" ON "generated_titles"("userId", "contentIdeaId");

-- CreateIndex
CREATE INDEX "thumbnails_userId_idx" ON "thumbnails"("userId");

-- CreateIndex
CREATE INDEX "thumbnails_contentIdeaId_idx" ON "thumbnails"("contentIdeaId");

-- CreateIndex
CREATE INDEX "thumbnails_userId_contentIdeaId_idx" ON "thumbnails"("userId", "contentIdeaId");

-- CreateIndex
CREATE INDEX "usage_logs_userId_idx" ON "usage_logs"("userId");

-- CreateIndex
CREATE INDEX "usage_logs_feature_idx" ON "usage_logs"("feature");

-- CreateIndex
CREATE INDEX "usage_logs_userId_createdAt_idx" ON "usage_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptJob" ADD CONSTRAINT "TranscriptJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfile" ADD CONSTRAINT "VoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceRender" ADD CONSTRAINT "VoiceRender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceRender" ADD CONSTRAINT "VoiceRender_voiceId_fkey" FOREIGN KEY ("voiceId") REFERENCES "VoiceProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_translations" ADD CONSTRAINT "transcript_translations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caption_translations" ADD CONSTRAINT "caption_translations_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_translations" ADD CONSTRAINT "voice_translations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_ingest_jobs" ADD CONSTRAINT "youtube_ingest_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_ingest_jobs" ADD CONSTRAINT "youtube_ingest_jobs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "content_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_calendars" ADD CONSTRAINT "content_calendars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_scripts" ADD CONSTRAINT "generated_scripts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_scripts" ADD CONSTRAINT "generated_scripts_contentIdeaId_fkey" FOREIGN KEY ("contentIdeaId") REFERENCES "content_ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "generated_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_shares" ADD CONSTRAINT "script_shares_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "generated_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_shares" ADD CONSTRAINT "script_shares_sharedBy_fkey" FOREIGN KEY ("sharedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_comments" ADD CONSTRAINT "script_comments_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "generated_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_comments" ADD CONSTRAINT "script_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_titles" ADD CONSTRAINT "generated_titles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_titles" ADD CONSTRAINT "generated_titles_contentIdeaId_fkey" FOREIGN KEY ("contentIdeaId") REFERENCES "content_ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_contentIdeaId_fkey" FOREIGN KEY ("contentIdeaId") REFERENCES "content_ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
