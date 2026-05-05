ALTER TABLE "Clip"
ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review';

CREATE INDEX "Clip_projectId_reviewStatus_idx" ON "Clip"("projectId", "reviewStatus");
