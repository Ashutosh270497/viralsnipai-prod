CREATE TABLE "ClipEditOperation" (
  "id" TEXT NOT NULL,
  "clipId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "startMs" INTEGER,
  "endMs" INTEGER,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClipEditOperation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClipEditOperation"
ADD CONSTRAINT "ClipEditOperation_clipId_fkey"
FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ClipEditOperation_clipId_idx" ON "ClipEditOperation"("clipId");
CREATE INDEX "ClipEditOperation_clipId_createdAt_idx" ON "ClipEditOperation"("clipId", "createdAt");
CREATE INDEX "ClipEditOperation_type_idx" ON "ClipEditOperation"("type");
