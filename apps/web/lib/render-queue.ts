import { promises as fs } from "fs";
import path from "path";

import { enqueueRender, processJobs } from "@clippers/jobs";

import { prisma } from "@/lib/prisma";
import { renderExport, PRESETS } from "@/lib/ffmpeg";
import { generateWatermarkOverlayBuffer, resolveWatermarkStyle } from "@/lib/watermark";

processJobs();

type PresetKey = keyof typeof PRESETS;

export function queueExportJob(exportId: string) {
  enqueueRender({
    exportId,
    handler: async () => {
      const exportRecord = await prisma.export.findUnique({
        where: { id: exportId },
        include: {
          project: {
            include: {
              clips: {
                include: {
                  asset: true
                }
              },
              assets: true,
              user: {
                include: {
                  brandKit: true
                }
              }
            }
          }
        }
      });

      if (!exportRecord) {
        throw new Error("Export not found");
      }

      const clipIds = Array.isArray(exportRecord.clipIds) ? (exportRecord.clipIds as string[]) : [];
      const project = exportRecord.project;
      const primaryAsset = project.assets[0];

      const segments = clipIds
        .map((clipId) => project.clips.find((clip) => clip.id === clipId))
        .filter((clip): clip is typeof project.clips[number] => Boolean(clip))
        .map((clip) => ({
          id: clip.id,
          startMs: clip.startMs,
          endMs: clip.endMs,
          sourcePath: clip.asset?.storagePath ?? primaryAsset?.storagePath ?? ""
        }))
        .filter((segment) => segment.sourcePath);

      if (segments.length === 0) {
        throw new Error("No clip segments to render");
      }

      const captionPaths = Object.fromEntries(
        project.clips.map((clip) => [clip.id, clip.captionSrt ?? undefined])
      );

      const presetKey = (exportRecord.preset as PresetKey) in PRESETS
        ? (exportRecord.preset as PresetKey)
        : ("shorts_9x16_1080" as PresetKey);

      await fs.mkdir(path.dirname(exportRecord.storagePath), { recursive: true });

      const watermarkStyle = resolveWatermarkStyle(project.user.brandKit, project.user.plan);
      let transientWatermarkPath: string | null = null;

      try {
        if (watermarkStyle.enabled) {
          const overlayBuffer = await generateWatermarkOverlayBuffer(watermarkStyle);
          transientWatermarkPath = path.join(
            path.dirname(exportRecord.storagePath),
            `watermark-${Date.now()}.png`
          );
          await fs.writeFile(transientWatermarkPath, overlayBuffer);
        }

        await renderExport({
          segments,
          preset: presetKey,
          outputPath: exportRecord.storagePath,
          captionPaths,
          watermarkPath: transientWatermarkPath
        });
      } finally {
        if (transientWatermarkPath) {
          await fs.unlink(transientWatermarkPath).catch(() => null);
        }
      }
    },
    onStatusChange: async (status, error) => {
      await prisma.export.update({
        where: { id: exportId },
        data: {
          status,
          error:
            status === "failed" && error
              ? error instanceof Error
                ? error.message
                : String(error)
              : null
        }
      });
    }
  });
}
