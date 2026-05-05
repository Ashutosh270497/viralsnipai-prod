ALTER TABLE "Clip"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Clip_id_version_idx" ON "Clip"("id", "version");

CREATE UNIQUE INDEX "youtube_ingest_jobs_active_source_unique"
ON "youtube_ingest_jobs"("projectId", "sourceUrl")
WHERE "status" IN ('queued', 'processing');
