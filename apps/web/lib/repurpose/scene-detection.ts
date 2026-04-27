import { detectSceneChanges } from "@/lib/ffmpeg";
import { logger } from "@/lib/logger";
import { detectScenesWithCvWorker, getCvWorkerBaseUrl } from "@/lib/media/cv-worker-client";

export type RepurposeSceneDetectionResult = {
  cutsMs: number[];
  provider: "cv-worker" | "ffmpeg" | "none";
  cvProvider?: string;
  fallbackReason?: string | null;
};

function normalizeCuts(cutsMs: number[], maxCuts: number) {
  return [...new Set(cutsMs)]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
    .slice(0, maxCuts);
}

export async function detectRepurposeSceneCuts({
  inputPath,
  maxCuts = 350,
}: {
  inputPath: string;
  maxCuts?: number;
}): Promise<RepurposeSceneDetectionResult> {
  const overallStart = Date.now();

  if (getCvWorkerBaseUrl()) {
    try {
      const cvStart = Date.now();
      const cvResult = await detectScenesWithCvWorker(
        { sourcePath: inputPath, threshold: Number(process.env.CV_SCENE_THRESHOLD ?? 27), maxCuts },
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
        });
        return { cutsMs, provider: "cv-worker", cvProvider: cvResult.provider, fallbackReason: cvResult.fallbackReason };
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

  try {
    const ffStart = Date.now();
    const cutsMs = normalizeCuts(
      await detectSceneChanges({ inputPath, threshold: 0.34, maxCuts }),
      maxCuts
    );
    logger.info("Scene detection completed with FFmpeg", {
      provider: "ffmpeg",
      cuts: cutsMs.length,
      sceneDurationMs: Date.now() - ffStart,
      totalDurationMs: Date.now() - overallStart,
    });
    return {
      cutsMs,
      provider: cutsMs.length > 0 ? "ffmpeg" : "none",
      fallbackReason: cutsMs.length > 0 ? null : "FFmpeg scene detection returned no cuts.",
    };
  } catch (error) {
    logger.warn("FFmpeg scene detection failed", {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: Date.now() - overallStart,
    });
    return { cutsMs: [], provider: "none", fallbackReason: error instanceof Error ? error.message : String(error) };
  }
}
