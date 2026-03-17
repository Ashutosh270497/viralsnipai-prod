-- CreateTable
CREATE TABLE "script_audios" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "voiceModel" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "audioStoragePath" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'mp3',
    "fileSize" INTEGER NOT NULL,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_audios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "script_audios_scriptId_idx" ON "script_audios"("scriptId");

-- CreateIndex
CREATE INDEX "script_audios_userId_idx" ON "script_audios"("userId");

-- CreateIndex
CREATE INDEX "script_audios_scriptId_createdAt_idx" ON "script_audios"("scriptId", "createdAt");

-- CreateIndex
CREATE INDEX "script_audios_userId_createdAt_idx" ON "script_audios"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "content_ideas_userId_status_idx" ON "content_ideas"("userId", "status");

-- CreateIndex
CREATE INDEX "content_ideas_niche_idx" ON "content_ideas"("niche");

-- CreateIndex
CREATE INDEX "generated_scripts_userId_createdAt_idx" ON "generated_scripts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "script_audios" ADD CONSTRAINT "script_audios_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "generated_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_audios" ADD CONSTRAINT "script_audios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
