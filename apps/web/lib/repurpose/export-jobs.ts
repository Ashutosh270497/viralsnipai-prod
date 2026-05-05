import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { getLocalUploadDir } from "@/lib/storage";
import { srtToWebVTT } from "@/lib/captions/webvtt";
import { resolvePlatformExportPreset, type ExportOutputType } from "@/lib/repurpose/export-presets";

export type PublicExportJobStatus = "queued" | "rendering" | "completed" | "failed" | "cancelled";

export function toExportJobStatus(status: string): PublicExportJobStatus {
  if (status === "done" || status === "completed") return "completed";
  if (status === "processing" || status === "rendering") return "rendering";
  if (status === "cancelled") return "cancelled";
  if (status === "failed") return "failed";
  return "queued";
}

export function serializeExportJob(exportRecord: any, runtime?: { progressPct?: number | null; stage?: string | null } | null) {
  const status = toExportJobStatus(exportRecord.status);
  return {
    id: exportRecord.id,
    projectId: exportRecord.projectId,
    userId: exportRecord.userId ?? exportRecord.project?.userId ?? null,
    clipIds: Array.isArray(exportRecord.clipIds) ? exportRecord.clipIds : [],
    status,
    internalStatus: exportRecord.status,
    progress:
      status === "completed" || status === "failed"
        ? 100
        : runtime?.progressPct ?? exportRecord.progress ?? (status === "queued" ? 2 : 0),
    phase: runtime?.stage ?? exportRecord.phase ?? status,
    outputFormat: exportRecord.outputFormat ?? "mp4",
    platformPreset: exportRecord.platformPreset ?? null,
    aspectRatio: exportRecord.aspectRatio ?? null,
    includeCaptions: Boolean(exportRecord.includeCaptions),
    captionTrackId: exportRecord.captionTrackId ?? null,
    layoutPreset: exportRecord.layoutPreset ?? null,
    preset: exportRecord.preset,
    outputPath: exportRecord.outputPath,
    downloadUrl: status === "completed" ? exportRecord.outputPath : null,
    error: exportRecord.error ?? null,
    metadata: exportRecord.metadata ?? null,
    createdAt: toIso(exportRecord.createdAt),
    startedAt: toIso(exportRecord.startedAt),
    completedAt: toIso(exportRecord.completedAt),
    updatedAt: toIso(exportRecord.updatedAt),
  };
}

export async function createCompletedAssetExportJob(params: {
  projectId: string;
  userId: string;
  clipIds: string[];
  outputType: Exclude<ExportOutputType, "mp4" | "zip">;
  platformPreset?: string | null;
}) {
  const platform = resolvePlatformExportPreset(params.platformPreset);
  const clips = await prisma.clip.findMany({
    where: {
      id: { in: params.clipIds },
      projectId: params.projectId,
      project: { userId: params.userId },
      reviewStatus: { not: "rejected" },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  if (clips.length === 0) {
    throw new Error("No eligible clips found for asset export.");
  }

  const firstClip = clips[0];
  const uploadsDir = getLocalUploadDir();
  const exportId = randomUUID();
  const extension = params.outputType === "thumbnail" ? "jpg" : params.outputType;
  const fileName = `${platform.fileNamePrefix}-${exportId}.${extension}`;
  const storagePath = path.join(uploadsDir, "exports", fileName);
  const outputPath = `/api/uploads/exports/${fileName}`;

  await fs.mkdir(path.dirname(storagePath), { recursive: true });

  if (params.outputType === "srt") {
    const srt = firstClip.captionSrt?.trim();
    if (!srt) throw new Error("Selected clip has no SRT captions to export.");
    await fs.writeFile(storagePath, srt, "utf-8");
  } else if (params.outputType === "vtt") {
    const srt = firstClip.captionSrt?.trim();
    if (!srt) throw new Error("Selected clip has no captions to export as VTT.");
    await fs.writeFile(storagePath, srtToWebVTT(srt), "utf-8");
  } else {
    const thumbnail = firstClip.thumbnail?.trim();
    if (!thumbnail) throw new Error("Selected clip has no thumbnail to export.");
    return prisma.export.create({
      data: {
        id: exportId,
        projectId: params.projectId,
        userId: params.userId,
        clipIds: clips.map((clip) => clip.id),
        preset: platform.legacyPreset,
        includeCaptions: false,
        progress: 100,
        phase: "completed",
        outputFormat: "thumbnail",
        platformPreset: platform.id,
        aspectRatio: platform.aspectRatio,
        outputPath: thumbnail,
        storagePath: thumbnail,
        status: "done",
        completedAt: new Date(),
        metadata: { platformPreset: platform, assetKind: "thumbnail" },
      } as any,
    });
  }

  return prisma.export.create({
    data: {
      id: exportId,
      projectId: params.projectId,
      userId: params.userId,
      clipIds: clips.map((clip) => clip.id),
      preset: platform.legacyPreset,
      includeCaptions: false,
      progress: 100,
      phase: "completed",
      outputFormat: params.outputType,
      platformPreset: platform.id,
      aspectRatio: platform.aspectRatio,
      outputPath,
      storagePath,
      status: "done",
      completedAt: new Date(),
      metadata: { platformPreset: platform, assetKind: params.outputType },
    } as any,
  });
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
