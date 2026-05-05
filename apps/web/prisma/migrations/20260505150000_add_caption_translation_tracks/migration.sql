ALTER TABLE "caption_translations"
ADD COLUMN "label" TEXT,
ADD COLUMN "captionVtt" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'translated',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "caption_translations_clipId_source_idx" ON "caption_translations"("clipId", "source");
