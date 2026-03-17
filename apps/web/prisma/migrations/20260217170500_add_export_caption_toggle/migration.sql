-- Add caption toggle support for export jobs
ALTER TABLE "Export"
ADD COLUMN "includeCaptions" BOOLEAN NOT NULL DEFAULT false;
