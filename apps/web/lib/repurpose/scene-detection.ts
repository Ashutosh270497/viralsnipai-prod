import { detectSceneChanges } from "@/lib/ffmpeg";
import { logger } from "@/lib/logger";
import { detectScenesWithCvWorker, getCvWorkerBaseUrl } from "@/lib/media/cv-worker-client";

export type RepurposeSceneDetectionResult = {
  cutsMs: number[];
  provider: "cv-worker" | "ffmpeg" | "none";
  cvProvider?: string;
  fallbackReason?: string | null;
  /** The actual threshold the active provider used. */
  thresholdUsed: number;
  thresholdSource: "project" | "env" | "default";
};

/**
 * CV worker uses an absolute pixel-difference threshold (typically 20-40).
 * FFmpeg's `select=gt(scene,X)` uses a normalized 0.0–1.0 threshold (typically
 * 0.2–0.5). The two scales are fundamentally different — the conversion below
 * is a heuristic that maps "similar perceptual sensitivity" between them.
 */
const CV_THRESHOLD_DEFAULT = 27;
const FFMPEG_THRESHOLD_DEFAULT = 0.34;

function ffmpegThresholdFromCv(cvThreshold: number): number {
  // Linearly interpolate: cv=27 → ff=0.34, with reasonable clamps.
  // The ratio (0.34 / 27 ≈ 0.0126) holds for the typical operating range.
  const mapped = cvThreshold * (FFMPEG_THRESHOLD_DEFAULT / CV_THRESHOLD_DEFAULT);
  return Math.min(0.95, Math.max(0.05, mapped));
}

function normalizeCuts(cutsMs: number[], maxCuts: number) {
  return [...new Set(cutsMs)]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
    .slice(0, maxCuts);
}

export async function detectRepurposeSceneCuts({
  inputPath,
  maxCuts = 350,
  threshold,
}: {
  inputPath: string;
  maxCuts?: number;
  /**
   * Override the runtime default scene-cut threshold for this call.
   * Treated as a CV-worker absolute threshold (20-40 typical). When the
   * FFmpeg fallback is used, the value is rescaled to its 0–1 range.
   * NULL/undefined means "use the runtime default".
   */
  threshold?: number | null;
}): Promise<RepurposeSceneDetectionResult> {
  const overallStart = Date.now();

  // Resolve the operative threshold + report its source so callers can log it.
  const envCvThreshold = Number(process.env.CV_SCENE_THRESHOLD);
  let cvThreshold: number;
  let thresholdSource: RepurposeSceneDetectionResult["thresholdSource"];
  if (typeof threshold === "number" && Number.isFinite(threshold) && threshold > 0) {
    cvThreshold = threshold;
    thresholdSource = "project";
  } else if (Number.isFinite(envCvThreshold) && envCvThreshold > 0) {
    cvThreshold = envCvThreshold;
    thresholdSource = "env";
  } else {
    cvThreshold = CV_THRESHOLD_DEFAULT;
    thresholdSource = "default";
  }

  if (getCvWorkerBaseUrl()) {
    try {
      const cvStart = Date.now();
      const cvResult = await detectScenesWithCvWorker(
        { sourcePath: inputPath, threshold: cvThreshold, maxCuts },
        { timeoutMs: 45_000 }
      );
      const sceneDurationMs = Date.now() - cvStart;

      const cutsMs = normalizeCuts(cvResult?.cutsMs ?? [], maxCuts);
      if (cvResult && cutsMs.length > 0) {
        logger.info("Scene detection completed with CV worker", {
          provider: cvResult.provider,
          cuts: cutsMs.length,
          sceneDurationMs,
          totalDurationMs: Date.now() - overallStart,
          fallbackReason: cvResult.fallbackReason,
          threshold: cvThreshold,
          thresholdSource,
        });
        return {
          cutsMs,
          provider: "cv-worker",
          cvProvider: cvResult.provider,
          fallbackReason: cvResult.fallbackReason,
          thresholdUsed: cvThreshold,
          thresholdSource,
        };
      }

      logger.warn("CV worker scene detection returned no cuts; falling back to FFmpeg", {
        cvProvider: cvResult?.provider,
        sceneDurationMs,
        fallbackReason: cvResult?.fallbackReason,
      });
    } catch (error) {
      logger.warn("CV worker scene detection failed; falling back to FFmpeg", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // FFmpeg fallback uses a different threshold scale, so rescale the CV value.
  const ffmpegThreshold = ffmpegThresholdFromCv(cvThreshold);

  try {
    const ffStart = Date.now();
    const cutsMs = normalizeCuts(
      await detectSceneChanges({ inputPath, threshold: ffmpegThreshold, maxCuts }),
      maxCuts
    );
    logger.info("Scene detection completed with FFmpeg", {
      provider: "ffmpeg",
      cuts: cutsMs.length,
      sceneDurationMs: Date.now() - ffStart,
      totalDurationMs: Date.now() - overallStart,
      threshold: ffmpegThreshold,
      thresholdSource,
    });
    return {
      cutsMs,
      provider: cutsMs.length > 0 ? "ffmpeg" : "none",
      fallbackReason: cutsMs.length > 0 ? null : "FFmpeg scene detection returned no cuts.",
      thresholdUsed: ffmpegThreshold,
      thresholdSource,
    };
  } catch (error) {
    logger.warn("FFmpeg scene detection failed", {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: Date.now() - overallStart,
    });
    return {
      cutsMs: [],
      provider: "none",
      fallbackReason: error instanceof Error ? error.message : String(error),
      thresholdUsed: ffmpegThreshold,
      thresholdSource,
    };
  }
}
