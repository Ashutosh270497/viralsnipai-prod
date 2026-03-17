import { promises as fs } from "fs";
import path from "path";

import { enqueueRender, processJobs } from "@clippers/jobs";

import { prisma } from "@/lib/prisma";
import { renderExport, PRESETS } from "@/lib/ffmpeg";
import { getLocalUploadDir } from "@/lib/storage";
import { generateWatermarkOverlayBuffer, resolveWatermarkStyle } from "@/lib/watermark";
import { logger } from "@/lib/logger";
import { resolveTranscriptEditRanges } from "@/lib/repurpose/transcript-edit-ranges";
import { selectBestReframePlan } from "@/lib/repurpose/clip-optimization";
import { normalizeClipCaptionStyle } from "@/lib/repurpose/caption-style-config";
import type { ClipReframePlan } from "@/lib/types";

processJobs();

type PresetKey = keyof typeof PRESETS;
type ExportStage =
  | "queued"
  | "preparing"
  | "extracting"
  | "styling"
  | "stitching"
  | "finalizing"
  | "retrying"
  | "done"
  | "failed";

export interface ExportRuntimeState {
  exportId: string;
  stage: ExportStage;
  progressPct: number;
  attempts: number;
  maxAttempts: number;
  retryable: boolean;
  updatedAt: number;
  startedAt: number;
  failureCode?: string | null;
  failureDetail?: string | null;
}

const activeExportJobs = new Set<string>();
const exportRuntimeState = new Map<string, ExportRuntimeState>();
const MAX_RENDER_ATTEMPTS = 2;
const TERMINAL_RUNTIME_TTL_MS = 5 * 60 * 1000;

function setRuntimeState(
  exportId: string,
  patch: Partial<ExportRuntimeState> & Pick<ExportRuntimeState, "stage" | "progressPct">
) {
  const current = exportRuntimeState.get(exportId);
  const next: ExportRuntimeState = {
    exportId,
    stage: patch.stage,
    progressPct: Math.max(0, Math.min(100, Math.round(patch.progressPct))),
    attempts: patch.attempts ?? current?.attempts ?? 1,
    maxAttempts: patch.maxAttempts ?? current?.maxAttempts ?? MAX_RENDER_ATTEMPTS,
    retryable: patch.retryable ?? current?.retryable ?? true,
    updatedAt: Date.now(),
    startedAt: patch.startedAt ?? current?.startedAt ?? Date.now(),
    failureCode: patch.failureCode ?? current?.failureCode ?? null,
    failureDetail: patch.failureDetail ?? current?.failureDetail ?? null,
  };
  exportRuntimeState.set(exportId, next);
  return next;
}

function scheduleRuntimeCleanup(exportId: string) {
  setTimeout(() => {
    const state = exportRuntimeState.get(exportId);
    if (!state) return;
    if (state.stage === "done" || state.stage === "failed") {
      exportRuntimeState.delete(exportId);
    }
  }, TERMINAL_RUNTIME_TTL_MS).unref?.();
}

function categorizeExportFailure(error: unknown): { code: string; retryable: boolean; detail: string } {
  const detail = error instanceof Error ? error.message : String(error);
  const normalized = detail.toLowerCase();

  if (normalized.includes("no clip segments")) {
    return { code: "SOURCE_MEDIA_MISSING", retryable: false, detail };
  }
  if (normalized.includes("applycaptionandoverlaystyling") || normalized.includes("burncaptions")) {
    return { code: "CAPTION_RENDER_FAILED", retryable: false, detail };
  }
  if (normalized.includes("concatclips")) {
    return { code: "EXPORT_STITCH_FAILED", retryable: true, detail };
  }
  if (normalized.includes("output=") || normalized.includes("opening output file")) {
    return { code: "OUTPUT_WRITE_FAILED", retryable: true, detail };
  }
  return { code: "UNKNOWN_RENDER_FAILURE", retryable: true, detail };
}

export function isExportJobActive(exportId: string) {
  return activeExportJobs.has(exportId);
}

export function getExportRuntimeState(exportId: string) {
  return exportRuntimeState.get(exportId) ?? null;
}

export async function queueExportJob(exportId: string) {
  if (activeExportJobs.has(exportId)) {
    logger.info("Export job already active, skipping duplicate enqueue", { exportId });
    return false;
  }

  const existing = await prisma.export.findUnique({
    where: { id: exportId },
    select: { id: true, status: true },
  });

  if (!existing) {
    logger.warn("Export not found while attempting to queue job", { exportId });
    return false;
  }

  if (existing.status === "done" || existing.status === "failed") {
    logger.info("Export already terminal, skipping enqueue", {
      exportId,
      status: existing.status,
    });
    return false;
  }

  activeExportJobs.add(exportId);
  setRuntimeState(exportId, {
    stage: "queued",
    progressPct: 2,
    attempts: 1,
    maxAttempts: MAX_RENDER_ATTEMPTS,
    retryable: true,
  });

  enqueueRender({
    exportId,
    handler: async () => {
      try {
        await persistExportStatus(exportId, "processing", null);
        setRuntimeState(exportId, {
          stage: "preparing",
          progressPct: 8,
          attempts: 1,
          maxAttempts: MAX_RENDER_ATTEMPTS,
          retryable: true,
        });

        let lastError: unknown = null;
        for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt++) {
          setRuntimeState(exportId, {
            stage: attempt === 1 ? "preparing" : "retrying",
            progressPct: attempt === 1 ? 8 : 12,
            attempts: attempt,
            maxAttempts: MAX_RENDER_ATTEMPTS,
            retryable: attempt < MAX_RENDER_ATTEMPTS,
            failureCode: null,
            failureDetail: null,
          });

          try {
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
            const uploadDir = getLocalUploadDir();

            const selectedClips = clipIds
              .map((clipId) => project.clips.find((clip) => clip.id === clipId))
              .filter((clip): clip is typeof project.clips[number] => Boolean(clip));
            const includeCaptions = Boolean((exportRecord as { includeCaptions?: boolean | null }).includeCaptions);

            const segments: Array<{
              id: string;
              clipId: string;
              startMs: number;
              endMs: number;
              sourcePath: string;
              reframePlan?: ClipReframePlan | null;
              captionStyle?: ReturnType<typeof normalizeClipCaptionStyle> | null;
            }> = [];
            const captionPaths: Record<string, string | undefined | null> = {};
            const unresolvedSources: Array<{ clipId: string; candidates: Array<string | null | undefined> }> = [];

            for (const clip of selectedClips) {
              const candidates = [
                clip.asset?.storagePath,
                clip.asset?.path,
                primaryAsset?.storagePath,
                primaryAsset?.path,
              ];
              const sourcePath = await resolveLocalSourcePath(
                candidates,
                uploadDir
              );

              if (!sourcePath) {
                unresolvedSources.push({ clipId: clip.id, candidates });
                continue;
              }

              const transcriptEditRanges = resolveTranscriptEditRanges(clip.viralityFactors, clip.startMs, clip.endMs);

              if (transcriptEditRanges.length > 1) {
                transcriptEditRanges.forEach((range, index) => {
                  const segmentId = `${clip.id}-${String(index + 1).padStart(2, "0")}`;
                  segments.push({
                    id: segmentId,
                    clipId: clip.id,
                    startMs: range.startMs,
                    endMs: range.endMs,
                    sourcePath,
                    captionStyle: null,
                  });
                  if (includeCaptions) {
                    captionPaths[segmentId] = undefined;
                  }
                });
              } else {
                segments.push({
                  id: clip.id,
                  clipId: clip.id,
                  startMs: clip.startMs,
                  endMs: clip.endMs,
                  sourcePath,
                  captionStyle: normalizeClipCaptionStyle(clip.captionStyle),
                });
                if (includeCaptions) {
                  captionPaths[clip.id] = clip.captionSrt ?? undefined;
                }
              }
            }

            if (segments.length === 0) {
              const unresolvedSummary = unresolvedSources
                .map(({ clipId, candidates }) => `${clipId}: ${candidates.filter(Boolean).join(" | ")}`)
                .join(" ; ");
              throw new Error(
                `No clip segments to render. Source media could not be resolved on local storage.${
                  unresolvedSummary ? ` Unresolved sources: ${unresolvedSummary}` : ""
                }`
              );
            }

            const presetKey = (exportRecord.preset as PresetKey) in PRESETS
              ? (exportRecord.preset as PresetKey)
              : ("shorts_9x16_1080" as PresetKey);
            const presetAspectRatio = PRESETS[presetKey].width / PRESETS[presetKey].height;

            await fs.mkdir(path.dirname(exportRecord.storagePath), { recursive: true });

            const watermarkStyle = resolveWatermarkStyle(project.user.brandKit, project.user.plan);
            let transientWatermarkPath: string | null = null;

            try {
              for (const clip of selectedClips) {
                const clipReframePlan = selectBestReframePlan(
                  (clip.viralityFactors as { reframePlans?: ClipReframePlan[] } | null | undefined)?.reframePlans,
                  presetAspectRatio
                );

                const clipSegments = segments.filter((segment) => segment.clipId === clip.id);
                clipSegments.forEach((segment) => {
                  segment.reframePlan = clipReframePlan;
                });
              }

              if (watermarkStyle.enabled) {
                setRuntimeState(exportId, {
                  stage: "preparing",
                  progressPct: 18,
                  attempts: attempt,
                  maxAttempts: MAX_RENDER_ATTEMPTS,
                  retryable: attempt < MAX_RENDER_ATTEMPTS,
                });
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
                captionPaths: includeCaptions ? captionPaths : undefined,
                watermarkPath: transientWatermarkPath,
                onProgress: ({ step, progressPct }) => {
                  setRuntimeState(exportId, {
                    stage: step,
                    progressPct,
                    attempts: attempt,
                    maxAttempts: MAX_RENDER_ATTEMPTS,
                    retryable: attempt < MAX_RENDER_ATTEMPTS,
                  });
                },
              });
              await persistExportStatus(exportId, "done", null);
              setRuntimeState(exportId, {
                stage: "done",
                progressPct: 100,
                attempts: attempt,
                maxAttempts: MAX_RENDER_ATTEMPTS,
                retryable: false,
              });
              scheduleRuntimeCleanup(exportId);
              lastError = null;
              break;
            } finally {
              if (transientWatermarkPath) {
                await fs.unlink(transientWatermarkPath).catch(() => null);
              }
            }
          } catch (error) {
            lastError = error;
            const failure = categorizeExportFailure(error);
            setRuntimeState(exportId, {
              stage: attempt < MAX_RENDER_ATTEMPTS ? "retrying" : "failed",
              progressPct: attempt < MAX_RENDER_ATTEMPTS ? 14 : 100,
              attempts: attempt,
              maxAttempts: MAX_RENDER_ATTEMPTS,
              retryable: failure.retryable && attempt < MAX_RENDER_ATTEMPTS,
              failureCode: failure.code,
              failureDetail: failure.detail,
            });

            if (!(failure.retryable && attempt < MAX_RENDER_ATTEMPTS)) {
              throw error;
            }
          }
        }

        if (lastError) {
          throw lastError;
        }
      } catch (error) {
        try {
          await persistExportStatus(exportId, "failed", error);
          const failure = categorizeExportFailure(error);
          setRuntimeState(exportId, {
            stage: "failed",
            progressPct: 100,
            retryable: false,
            failureCode: failure.code,
            failureDetail: failure.detail,
          });
          scheduleRuntimeCleanup(exportId);
        } catch (statusError) {
          logger.error("Failed to persist failed export status", {
            exportId,
            statusError: statusError instanceof Error ? statusError.message : String(statusError),
            originalError: error instanceof Error ? error.message : String(error)
          });
        }
        throw error;
      } finally {
        activeExportJobs.delete(exportId);
      }
    }
  });

  return true;
}

async function persistExportStatus(
  exportId: string,
  status: "queued" | "processing" | "done" | "failed",
  error: unknown
): Promise<void> {
  const errorMessage =
    status === "failed" && error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.export.update({
        where: { id: exportId },
        data: {
          status,
          error: errorMessage
        }
      });
      return;
    } catch (updateError) {
      lastError = updateError;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 200));
      }
    }
  }

  logger.error("Failed to persist export status after retries", {
    exportId,
    status,
    error: lastError instanceof Error ? lastError.message : String(lastError ?? "unknown")
  });
  throw lastError instanceof Error ? lastError : new Error("Failed to persist export status");
}

async function resolveLocalSourcePath(
  candidates: Array<string | null | undefined>,
  uploadDir: string
): Promise<string | null> {
  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue;
    const candidate = raw.trim();
    if (!candidate) continue;

    const possiblePaths: string[] = [];

    if (path.isAbsolute(candidate)) {
      possiblePaths.push(candidate);
    }
    if (candidate.startsWith("/api/uploads/")) {
      possiblePaths.push(path.join(uploadDir, candidate.slice("/api/uploads/".length)));
    }
    if (candidate.startsWith("/uploads/")) {
      possiblePaths.push(path.join(uploadDir, candidate.slice("/uploads/".length)));
      possiblePaths.push(path.join(process.cwd(), "public", candidate.replace(/^\/+/, "")));
    }
    if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
      possiblePaths.push(path.resolve(process.cwd(), candidate));
    }

    for (const fullPath of possiblePaths) {
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        // Try next path candidate.
      }
    }
  }

  return null;
}
