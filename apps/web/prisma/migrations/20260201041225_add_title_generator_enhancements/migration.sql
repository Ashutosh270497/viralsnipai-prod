/*
  Warnings:

  - Added the required column `characterLength` to the `generated_titles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `generationBatchId` to the `generated_titles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `keywords` to the `generated_titles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetAudience` to the `generated_titles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titleStyle` to the `generated_titles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `videoTopic` to the `generated_titles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "generated_titles" ADD COLUMN     "characterLength" INTEGER NOT NULL,
ADD COLUMN     "clarityScore" INTEGER,
ADD COLUMN     "curiosityScore" INTEGER,
ADD COLUMN     "generationBatchId" TEXT NOT NULL,
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keywordOptimizationScore" INTEGER,
ADD COLUMN     "keywords" JSONB NOT NULL,
ADD COLUMN     "lengthOptimal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxLength" INTEGER NOT NULL DEFAULT 70,
ADD COLUMN     "overallRank" INTEGER,
ADD COLUMN     "powerWordCount" INTEGER,
ADD COLUMN     "reasoning" TEXT,
ADD COLUMN     "targetAudience" TEXT NOT NULL,
ADD COLUMN     "titleStyle" TEXT NOT NULL,
ADD COLUMN     "videoTopic" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "generated_titles_generationBatchId_idx" ON "generated_titles"("generationBatchId");

-- CreateIndex
CREATE INDEX "generated_titles_userId_createdAt_idx" ON "generated_titles"("userId", "createdAt");
