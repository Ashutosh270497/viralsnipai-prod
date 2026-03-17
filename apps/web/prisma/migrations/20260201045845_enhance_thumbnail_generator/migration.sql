/*
  Warnings:

  - You are about to drop the column `style` on the `thumbnails` table. All the data in the column will be lost.
  - Added the required column `colorScheme` to the `thumbnails` table without a default value. This is not possible if the table is not empty.
  - Added the required column `generationBatchId` to the `thumbnails` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mainSubject` to the `thumbnails` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thumbnailStyle` to the `thumbnails` table without a default value. This is not possible if the table is not empty.
  - Added the required column `videoTitle` to the `thumbnails` table without a default value. This is not possible if the table is not empty.
  - Made the column `imageUrl` on table `thumbnails` required. This step will fail if there are existing NULL values in that column.
  - Made the column `storagePath` on table `thumbnails` required. This step will fail if there are existing NULL values in that column.
  - Made the column `thumbnailPrompt` on table `thumbnails` required. This step will fail if there are existing NULL values in that column.
  - Made the column `aiModel` on table `thumbnails` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "thumbnails" DROP COLUMN "style",
ADD COLUMN     "additionalElements" JSONB,
ADD COLUMN     "colorScheme" TEXT NOT NULL,
ADD COLUMN     "contrastScore" INTEGER,
ADD COLUMN     "ctrScore" INTEGER,
ADD COLUMN     "emotionalImpact" INTEGER,
ADD COLUMN     "faceExpression" TEXT,
ADD COLUMN     "generationBatchId" TEXT NOT NULL,
ADD COLUMN     "improvements" JSONB,
ADD COLUMN     "includeText" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mainSubject" TEXT NOT NULL,
ADD COLUMN     "mobileReadability" INTEGER,
ADD COLUMN     "niche" TEXT,
ADD COLUMN     "nicheAlignment" INTEGER,
ADD COLUMN     "overallRank" INTEGER,
ADD COLUMN     "reasoning" TEXT,
ADD COLUMN     "textOverlay" TEXT,
ADD COLUMN     "thumbnailStyle" TEXT NOT NULL,
ADD COLUMN     "videoTitle" TEXT NOT NULL,
ALTER COLUMN "imageUrl" SET NOT NULL,
ALTER COLUMN "storagePath" SET NOT NULL,
ALTER COLUMN "thumbnailPrompt" SET NOT NULL,
ALTER COLUMN "aiModel" SET NOT NULL,
ALTER COLUMN "aiModel" SET DEFAULT 'dall-e-3';

-- CreateIndex
CREATE INDEX "thumbnails_generationBatchId_idx" ON "thumbnails"("generationBatchId");

-- CreateIndex
CREATE INDEX "thumbnails_userId_createdAt_idx" ON "thumbnails"("userId", "createdAt");
