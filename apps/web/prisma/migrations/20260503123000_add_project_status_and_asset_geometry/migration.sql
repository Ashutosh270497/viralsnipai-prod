ALTER TABLE "Project"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ready';

CREATE INDEX "Project_userId_status_idx" ON "Project"("userId", "status");

ALTER TABLE "Asset"
ADD COLUMN "sourceWidth" INTEGER,
ADD COLUMN "sourceHeight" INTEGER;
