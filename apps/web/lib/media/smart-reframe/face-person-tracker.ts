/**
 * Smart Reframe — Frame Sampling & Detection Aggregator
 *
 * Uses FFmpeg (already in the project) to extract low-res frames from a clip
 * time range, then runs the detection provider on each frame, and aggregates
 * results into a single AggregatedDetections object.
 *
 * Environment vars (all optional):
 *   SMART_REFRAME_SAMPLE_INTERVAL_MS  — ms between sampled frames (default 750)
 *   SMART_REFRAME_MAX_FRAMES          — hard cap on frames per clip (default 8)
 *   SMART_REFRAME_ENABLED             — set to "false" to disable entirely
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { logger } from "@/lib/logger";
import type { AggregatedDetections, FrameDetectionProvider } from "./tracking-types";

// ── Config ────────────────────────────────────────────────────────────────────

const SAMPLE_INTERVAL_MS = Number(process.env.SMART_REFRAME_SAMPLE_INTERVAL_MS ?? 750);
const MAX_FRAMES = Math.min(120, Number(process.env.SMART_REFRAME_MAX_FRAMES ?? 8));
const ENABLED = (process.env.SMART_REFRAME_ENABLED ?? "true").toLowerCase() !== "false";

// Detection frame width (height preserves aspect ratio)
const DETECTION_FRAME_WIDTH = 480;

// ── FFmpeg frame extraction ───────────────────────────────────────────────────

function resolveFfmpegBinary(): string {
  // Use project-configured binary if available
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv) return fromEnv;
  if (ffmpegStatic && typeof ffmpegStatic === "string") return ffmpegStatic;

  return "ffmpeg"; // System PATH fallback
}

export interface ExtractSampleFramesResult {
  /** Absolute paths to the JPEG frames produced by FFmpeg (may be empty). */
  framePaths: string[];
  /** Absolute path to the temp directory holding the frames. */
  tempDir: string;
}

/**
 * Extract JPEG frames from a clip time range using FFmpeg.
 * Returns the produced frame paths AND the temp directory (always created),
 * so the caller can `cleanupTempDir(tempDir)` even when 0 frames were produced.
 *
 * Why both: when FFmpeg writes 0 files (corrupt segment, codec issue, very
 * short clip) the directory still exists from `mkdir`. Returning only the
 * frame list let callers leak the directory — see C4 audit finding.
 */
export async function extractSampleFrames(params: {
  sourcePath: string;
  startMs: number;
  endMs: number;
  tempDir?: string;
}): Promise<ExtractSampleFramesResult> {
  const { sourcePath, startMs, endMs } = params;
  const durationMs = Math.max(0, endMs - startMs);

  // Always allocate a tempDir even on the zero-duration early exit, so the
  // return shape stays consistent and callers don't branch on missing dir.
  const tempDir = params.tempDir ?? path.join(os.tmpdir(), `sr-frames-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  if (durationMs <= 0) {
    return { framePaths: [], tempDir };
  }

  const intervalMs = SAMPLE_INTERVAL_MS > 0 ? SAMPLE_INTERVAL_MS : 750;
  const desiredFrames = Math.min(MAX_FRAMES, Math.max(1, Math.ceil(durationMs / intervalMs)));

  await fs.mkdir(tempDir, { recursive: true });

  const outputPattern = path.join(tempDir, "frame_%04d.jpg");
  const fps = desiredFrames / (durationMs / 1000);
  const startSec = startMs / 1000;
  const durationSec = durationMs / 1000;

  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-ss", String(startSec),
    "-i", sourcePath,
    "-t", String(durationSec),
    "-vf", `fps=${fps.toFixed(4)},scale=${DETECTION_FRAME_WIDTH}:-1`,
    "-frames:v", String(desiredFrames),
    "-q:v", "4",  // JPEG quality (1=best, 31=worst), 4 is fine for detection
    "-f", "image2",
    outputPattern,
    "-y",
  ];

  await new Promise<void>((resolve) => {
    const binary = resolveFfmpegBinary();
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });

    child.on("error", (err) => {
      logger.warn("smart-reframe: ffmpeg frame extraction error", { error: err.message });
      resolve(); // Don't throw — caller handles empty frame list
    });
    child.on("close", () => resolve());
  });

  // Collect produced frames
  let framePaths: string[] = [];
  try {
    const entries = await fs.readdir(tempDir);
    framePaths = entries
      .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
      .sort()
      .map((f) => path.join(tempDir, f));
  } catch {
    // directory might not exist if ffmpeg never ran
  }

  return { framePaths, tempDir };
}

/**
 * Delete a temp frame directory unconditionally.
 * Safe to call when the directory was never created.
 */
export async function cleanupTempDir(tempDir: string | null | undefined): Promise<void> {
  if (!tempDir) return;
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
}

/**
 * Backward-compatible cleanup helper.
 * Prefer cleanupTempDir(tempDir) for new code — this overload only works when
 * at least one frame was produced.
 *
 * @deprecated use cleanupTempDir
 */
export async function cleanupTempFrames(framePaths: string[]): Promise<void> {
  if (framePaths.length === 0) return;
  const dir = path.dirname(framePaths[0]);
  await cleanupTempDir(dir);
}

// ── Detection aggregation ─────────────────────────────────────────────────────

/**
 * Run the detection provider on all sampled frames and aggregate results.
 * Individual frame failures are silently skipped — never throws.
 */
export async function aggregateFrameDetections(
  framePaths: string[],
  provider: FrameDetectionProvider
): Promise<AggregatedDetections> {
  const agg: AggregatedDetections = {
    faceBoxes: [],
    personBoxes: [],
    totalFrames: framePaths.length,
  };

  for (let i = 0; i < framePaths.length; i++) {
    try {
      const result = await provider.detect(framePaths[i]);
      for (const face of result.faces) {
        agg.faceBoxes.push({ box: face, frameIndex: i });
      }
      for (const person of result.persons) {
        agg.personBoxes.push({ box: person, frameIndex: i });
      }
    } catch (err) {
      logger.warn("smart-reframe: detection failed for frame", {
        frameIndex: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return agg;
}

/**
 * Full pipeline: sample frames → detect → aggregate.
 * Always returns an AggregatedDetections (may have empty arrays on failure).
 *
 * The temp directory created by FFmpeg is cleaned in `finally` regardless of
 * whether any frames were produced — see C4 audit finding for context.
 */
export async function sampleAndDetect(params: {
  sourcePath: string;
  startMs: number;
  endMs: number;
  provider: FrameDetectionProvider;
}): Promise<AggregatedDetections> {
  if (!ENABLED) {
    return { faceBoxes: [], personBoxes: [], totalFrames: 0 };
  }

  let tempDir: string | null = null;
  try {
    const extractStart = Date.now();
    const extracted = await extractSampleFrames({
      sourcePath: params.sourcePath,
      startMs: params.startMs,
      endMs: params.endMs,
    });
    tempDir = extracted.tempDir;
    const framePaths = extracted.framePaths;
    const extractDurationMs = Date.now() - extractStart;

    if (framePaths.length === 0) {
      logger.info("smart-reframe: no frames extracted", {
        sourcePath: params.sourcePath,
        startMs: params.startMs,
        endMs: params.endMs,
        extractDurationMs,
      });
      return { faceBoxes: [], personBoxes: [], totalFrames: 0 };
    }

    logger.info("smart-reframe: extracted frames for detection", {
      frameCount: framePaths.length,
      extractDurationMs,
    });

    const detectionStart = Date.now();
    const aggregated = await aggregateFrameDetections(framePaths, params.provider);
    const detectionDurationMs = Date.now() - detectionStart;
    const totalDetections = aggregated.faceBoxes.length + aggregated.personBoxes.length;

    logger.info("smart-reframe: detection complete", {
      sampledFrames: aggregated.totalFrames,
      faceDetections: aggregated.faceBoxes.length,
      personDetections: aggregated.personBoxes.length,
      totalDetections,
      detectionDurationMs,
      fallback: totalDetections === 0,
    });

    return aggregated;
  } catch (err) {
    logger.warn("smart-reframe: sampleAndDetect failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { faceBoxes: [], personBoxes: [], totalFrames: 0 };
  } finally {
    await cleanupTempDir(tempDir);
  }
}
