import { promises as fs } from "fs";
import path from "path";
import os from "os";

import { enqueueRender, processJobs } from "@clippers/jobs";

import { prisma } from "@/lib/prisma";
import { renderExport, PRESETS, probeSourceMetadata, extractAndRenderSegment } from "@/lib/ffmpeg";
import { getLocalUploadDir } from "@/lib/storage";
import { generateWatermarkOverlayBuffer, resolveWatermarkStyle } from "@/lib/watermark";
import { logger } from "@/lib/logger";
import { resolveTranscriptEditRanges } from "@/lib/repurpose/transcript-edit-ranges";
import { selectBestReframePlan } from "@/lib/repurpose/clip-optimization";
import { normalizeClipCaptionStyle } from "@/lib/repurpose/caption-style-config";
import { concatClipsPassthrough } from "@/lib/ffmpeg";
import { shouldUseRemotionRenderer, renderWithRemotion, REMOTION_RENDERER_ENABLED } from "@/lib/media/remotion-renderer";
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

/** Live snapshot of the in-process export queue — used by the health endpoint. */
export function getExportQueueSnapshot(): { activeJobs: number; stages: Record<string, number> } {
  const stages: Record<string, number> = {};
  for (const [, state] of exportRuntimeState) {
    stages[state.stage] = (stages[state.stage] ?? 0) + 1;
  }
  return { activeJobs: activeExportJobs.size, stages };
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
        logger.info("Export processing started", { exportId });
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

              // Log source metadata for each unique source path before encoding starts.
              const loggedPaths = new Set<string>();
              for (const seg of segments) {
                if (!loggedPaths.has(seg.sourcePath)) {
                  loggedPaths.add(seg.sourcePath);
                  probeSourceMetadata(seg.sourcePath).then((meta) => {
                    logger.info("render:source_probe", {
                      exportId,
                      sourcePath: seg.sourcePath,
                      ...meta,
                    });
                  }).catch(() => {});
                }
              }

              // ── Renderer selection ──────────────────────────────────────────
              // Remotion path: animated captions (karaoke, pop, fade, slide, bounce)
              // FFmpeg path: static captions or animation disabled
              //
              // Routing: check if any segment has an animated caption style AND
              // the Remotion renderer is enabled via REMOTION_RENDERER_ENABLED=true.
              const hasAnimatedCaptions =
                includeCaptions &&
                segments.some((seg) => shouldUseRemotionRenderer(seg.captionStyle));

              if (hasAnimatedCaptions && REMOTION_RENDERER_ENABLED) {
                await renderWithRemotionPath({
                  exportId,
                  segments,
                  preset: presetKey,
                  outputPath: exportRecord.storagePath,
                  captionPaths,
                  // BrandKit has no watermarkText field — use a generic branded label
                  watermarkText: watermarkStyle.enabled ? "ViralSnipAI" : null,
                  attempt,
                  maxAttempts: MAX_RENDER_ATTEMPTS,
                  onProgress: (stage, progressPct) => {
                    setRuntimeState(exportId, {
                      stage,
                      progressPct,
                      attempts: attempt,
                      maxAttempts: MAX_RENDER_ATTEMPTS,
                      retryable: attempt < MAX_RENDER_ATTEMPTS,
                    });
                  },
                });
              } else {
                // Standard FFmpeg path (default / fallback)
                if (hasAnimatedCaptions && !REMOTION_RENDERER_ENABLED) {
                  logger.info("render:remotion_disabled — using FFmpeg static captions", {
                    exportId,
                    hint: "Set REMOTION_RENDERER_ENABLED=true to enable animated caption exports.",
                  });
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
              } // end else (FFmpeg path)

              await persistExportStatus(exportId, "done", null);
              logger.info("Export processing completed", {
                exportId,
                attempt,
                renderMethod: hasAnimatedCaptions && REMOTION_RENDERER_ENABLED ? "remotion" : "ffmpeg",
                segmentCount: segments.length,
                withCaptions: includeCaptions,
              });
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
          logger.error("Export processing failed", {
            exportId,
            code: failure.code,
            retryable: failure.retryable,
            error: failure.detail,
          });
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

// ── Remotion render path ──────────────────────────────────────────────────────

/**
 * Render all segments with Remotion (animated captions) then concat.
 *
 * Steps per segment:
 *   1. FFmpeg: extract + crop/scale (no caption burn) → temp pre-cropped clip
 *   2. Remotion: pre-cropped clip + animated captions → rendered clip
 *
 * Final step: FFmpeg stream-copy concat all rendered clips → output.
 *
 * Falls back to FFmpeg static captions if Remotion fails on any segment.
 */
async function renderWithRemotionPath(params: {
  exportId: string;
  segments: Array<{
    id: string;
    startMs: number;
    endMs: number;
    sourcePath: string;
    reframePlan?: import("@/lib/types").ClipReframePlan | null;
    captionStyle?: ReturnType<typeof normalizeClipCaptionStyle> | null;
  }>;
  preset: keyof typeof PRESETS;
  outputPath: string;
  captionPaths: Record<string, string | undefined | null>;
  watermarkText: string | null;
  attempt: number;
  maxAttempts: number;
  onProgress: (stage: ExportStage, pct: number) => void;
}): Promise<void> {
  const { exportId, segments, preset, outputPath, captionPaths, watermarkText, attempt, maxAttempts } = params;
  const presetDims = PRESETS[preset];

  const tempDir = `${outputPath}_remotion_${Date.now()}`;
  await fs.mkdir(tempDir, { recursive: true });

  const renderedPaths: string[] = [];

  try {
    const segmentCount = segments.length;

    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      const segPct = idx / segmentCount;
      params.onProgress("extracting", Math.round(15 + segPct * 30));

      // Step 1: FFmpeg crop + scale (no caption burn) → pre-cropped temp clip
      const preCroppedPath = path.join(tempDir, `pre_${seg.id}.mp4`);
      await extractAndRenderSegment({
        inputPath: seg.sourcePath,
        startMs: seg.startMs,
        endMs: seg.endMs,
        outputPath: preCroppedPath,
        preset,
        reframePlan: seg.reframePlan,
        srtPath: null,          // no caption burn in this pass
        captionStyle: null,     // captions handled by Remotion
        quality: "export",
      });

      params.onProgress("styling", Math.round(45 + segPct * 35));

      // Step 2: Remotion renders pre-cropped clip + animated captions
      const captionSrtOrText = captionPaths[seg.id];
      let entries: import("@/lib/srt-utils").CaptionEntry[] = [];
      if (captionSrtOrText) {
        const { srtUtils } = await import("@/lib/srt-utils");
        entries = srtUtils.parseSRT(captionSrtOrText);
      }

      const remotionOutPath = path.join(tempDir, `rendered_${seg.id}.mp4`);

      try {
        await renderWithRemotion({
          preVideoPath: preCroppedPath,
          outputPath: remotionOutPath,
          durationMs: seg.endMs - seg.startMs,
          entries,
          captionStyle: seg.captionStyle ?? {
            presetId: "modern",
            fontFamily: "Arial",
            fontSize: 54,
            primaryColor: "#FFFFFF",
            emphasisColor: "#34d399",
            position: "bottom",
            outline: true,
            outlineColor: "#000000",
            background: true,
            backgroundColor: "#0B0B12",
            backgroundOpacity: 0.42,
            karaoke: false,
            maxWordsPerLine: 7,
            align: "center",
            animation: { type: "none", wordHighlight: false, speed: "normal" },
            safeZoneAware: true,
            hookOverlays: [],
          },
          captionsEnabled: Boolean(captionSrtOrText),
          watermarkText,
          onProgress: (pct) => {
            params.onProgress("styling", Math.round(45 + (segPct + pct / 100 / segmentCount) * 35));
          },
        });

        renderedPaths.push(remotionOutPath);
      } catch (remotionError) {
        logger.warn("render:remotion_segment_failed — falling back to FFmpeg static captions", {
          exportId,
          segmentId: seg.id,
          error: remotionError instanceof Error ? remotionError.message : String(remotionError),
        });

        // Fall back: re-run FFmpeg with caption burn on the pre-cropped clip
        const fallbackPath = path.join(tempDir, `fallback_${seg.id}.mp4`);
        const { applyCaptionAndOverlayStyling } = await import("@/lib/ffmpeg");

        const srtContent = captionPaths[seg.id];
        const hasCaptions = Boolean(srtContent || seg.captionStyle?.hookOverlays?.length);

        if (hasCaptions) {
          let tempSrtPath: string | undefined;
          if (srtContent) {
            tempSrtPath = path.join(tempDir, `${seg.id}.srt`);
            await fs.writeFile(tempSrtPath, srtContent, "utf-8");
          }
          await applyCaptionAndOverlayStyling({
            inputPath: preCroppedPath,
            outputPath: fallbackPath,
            preset,
            srtPath: tempSrtPath,
            captionStyle: seg.captionStyle,
          });
          renderedPaths.push(fallbackPath);
        } else {
          renderedPaths.push(preCroppedPath);
        }
      }
    }

    params.onProgress("stitching", 85);

    // Step 3: Stream-copy concat (all Remotion outputs are H.264/AAC, same dims)
    await concatClipsPassthrough({ clipPaths: renderedPaths, outputPath });

    params.onProgress("finalizing", 97);

    logger.info("render:remotion_path_complete", {
      exportId,
      segmentCount: segments.length,
      renderedSegments: renderedPaths.length,
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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
