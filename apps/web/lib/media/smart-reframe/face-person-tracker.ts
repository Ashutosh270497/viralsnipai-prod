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

/**
 * Extract JPEG frames from a clip time range using FFmpeg.
 * Returns an array of absolute paths to the temp JPEG files.
 * The caller is responsible for deleting them after use.
 */
export async function extractSampleFrames(params: {
  sourcePath: string;
  startMs: number;
  endMs: number;
  tempDir?: string;
}): Promise<string[]> {
  const { sourcePath, startMs, endMs } = params;
  const durationMs = Math.max(0, endMs - startMs);

  if (durationMs <= 0) return [];

  const intervalMs = SAMPLE_INTERVAL_MS > 0 ? SAMPLE_INTERVAL_MS : 750;
  const desiredFrames = Math.min(MAX_FRAMES, Math.max(1, Math.ceil(durationMs / intervalMs)));

  // Use a unique temp directory per analysis run
  const tempDir = params.tempDir ?? path.join(os.tmpdir(), `sr-frames-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
  let files: string[] = [];
  try {
    const entries = await fs.readdir(tempDir);
    files = entries
      .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
      .sort()
      .map((f) => path.join(tempDir, f));
  } catch {
    // directory might not exist if ffmpeg never ran
  }

  return files;
}

/**
 * Delete all temp frame files and the directory.
 */
export async function cleanupTempFrames(framePaths: string[]): Promise<void> {
  if (framePaths.length === 0) return;
  const dir = path.dirname(framePaths[0]);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => null);
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

  let framePaths: string[] = [];
  try {
    framePaths = await extractSampleFrames({
      sourcePath: params.sourcePath,
      startMs: params.startMs,
      endMs: params.endMs,
    });

    if (framePaths.length === 0) {
      logger.info("smart-reframe: no frames extracted", {
        sourcePath: params.sourcePath,
        startMs: params.startMs,
        endMs: params.endMs,
      });
      return { faceBoxes: [], personBoxes: [], totalFrames: 0 };
    }

    logger.info("smart-reframe: extracted frames for detection", {
      frameCount: framePaths.length,
      sourcePath: params.sourcePath,
    });

    return await aggregateFrameDetections(framePaths, params.provider);
  } catch (err) {
    logger.warn("smart-reframe: sampleAndDetect failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { faceBoxes: [], personBoxes: [], totalFrames: 0 };
  } finally {
    await cleanupTempFrames(framePaths);
  }
}
