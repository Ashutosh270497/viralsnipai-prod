import type { ClipReframePlan } from "@/lib/types";
import type { SourceMetadata, PRESETS } from "@/lib/ffmpeg";

export type ReframeRenderMode =
  | "crop_reframe"
  | "fit_with_blur_background"
  | "fit_with_letterbox"
  | "source_aspect_preview"
  | "high_quality_crop";

export type ReframeQualityRisk = "low" | "medium" | "high";

export type SourceReframeQualityAnalysis = {
  inputPath: string;
  sourceWidth: number | null;
  sourceHeight: number | null;
  sourceBitrate: number | null;
  sourceFps: number | null;
  sourceOrientation: "landscape" | "portrait" | "square" | "unknown";
  targetWidth: number;
  targetHeight: number;
  estimatedCropWidth: number | null;
  estimatedCropHeight: number | null;
  upscaleFactorX: number | null;
  upscaleFactorY: number | null;
  qualityRisk: ReframeQualityRisk;
  recommendedRenderMode: ReframeRenderMode;
  warning?: string;
};

export function analyzeSourceForReframeQuality({
  inputPath,
  source,
  preset,
  presetDimensions,
  reframePlan,
}: {
  inputPath: string;
  source: SourceMetadata | null;
  preset: keyof typeof PRESETS;
  presetDimensions: { width: number; height: number };
  reframePlan?: ClipReframePlan | null;
}): SourceReframeQualityAnalysis {
  const rotated = source?.rotation === 90 || source?.rotation === 270;
  const sourceWidth = rotated ? source?.height ?? null : source?.width ?? null;
  const sourceHeight = rotated ? source?.width ?? null : source?.height ?? null;
  const targetWidth = presetDimensions.width;
  const targetHeight = presetDimensions.height;
  const targetRatio = targetWidth / targetHeight;

  if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
    return {
      inputPath,
      sourceWidth,
      sourceHeight,
      sourceBitrate: source?.videoBitrateKbps ?? null,
      sourceFps: source?.fps ?? null,
      sourceOrientation: "unknown",
      targetWidth,
      targetHeight,
      estimatedCropWidth: null,
      estimatedCropHeight: null,
      upscaleFactorX: null,
      upscaleFactorY: null,
      qualityRisk: "medium",
      recommendedRenderMode: "fit_with_letterbox",
      warning: "Source geometry could not be probed; using conservative fit mode.",
    };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const sourceOrientation =
    Math.abs(sourceRatio - 1) < 0.05 ? "square" : sourceRatio > 1 ? "landscape" : "portrait";
  const targetIsPortrait = targetRatio < 0.8;
  const sourceIsLandscape = sourceOrientation === "landscape";
  const crop = estimateCropSize({
    sourceWidth,
    sourceHeight,
    targetRatio,
    reframePlan,
  });
  const upscaleFactorX = targetWidth / Math.max(1, crop.width);
  const upscaleFactorY = targetHeight / Math.max(1, crop.height);
  const maxUpscale = Math.max(upscaleFactorX, upscaleFactorY);
  const minSourceDimension = Math.min(sourceWidth, sourceHeight);

  let qualityRisk: ReframeQualityRisk = "low";
  if (maxUpscale > 1.65 || minSourceDimension < 720) {
    qualityRisk = "high";
  } else if (maxUpscale > 1.35 || minSourceDimension < 1080) {
    qualityRisk = "medium";
  }

  let recommendedRenderMode: ReframeRenderMode = "high_quality_crop";
  let warning: string | undefined;

  if (!reframePlan || reframePlan.mode === "letterbox") {
    recommendedRenderMode = "fit_with_letterbox";
  } else if (targetIsPortrait && sourceIsLandscape && maxUpscale > 1.35) {
    recommendedRenderMode = "fit_with_blur_background";
    warning =
      "Source video is landscape and an aggressive vertical crop would soften the clip. Using blur-background fit to preserve detail.";
  } else if (qualityRisk === "high" && targetIsPortrait) {
    recommendedRenderMode = "fit_with_blur_background";
    warning =
      "Source resolution is low for the requested vertical render. Using blur-background fit to avoid excessive upscaling.";
  }

  return {
    inputPath,
    sourceWidth,
    sourceHeight,
    sourceBitrate: source?.videoBitrateKbps ?? null,
    sourceFps: source?.fps ?? null,
    sourceOrientation,
    targetWidth,
    targetHeight,
    estimatedCropWidth: Math.round(crop.width),
    estimatedCropHeight: Math.round(crop.height),
    upscaleFactorX: Number(upscaleFactorX.toFixed(2)),
    upscaleFactorY: Number(upscaleFactorY.toFixed(2)),
    qualityRisk,
    recommendedRenderMode,
    warning,
  };
}

function estimateCropSize({
  sourceWidth,
  sourceHeight,
  targetRatio,
  reframePlan,
}: {
  sourceWidth: number;
  sourceHeight: number;
  targetRatio: number;
  reframePlan?: ClipReframePlan | null;
}) {
  if (reframePlan?.manualCropBox) {
    const boxWidth = sourceWidth * Math.max(0.01, Math.min(1, reframePlan.manualCropBox.width));
    const boxHeight = sourceHeight * Math.max(0.01, Math.min(1, reframePlan.manualCropBox.height));
    const boxRatio = boxWidth / boxHeight;
    return boxRatio >= targetRatio
      ? { width: boxHeight * targetRatio, height: boxHeight }
      : { width: boxWidth, height: boxWidth / targetRatio };
  }

  if (reframePlan?.dynamicCropPath?.length && reframePlan.dynamicCropSource) {
    const avgWidth =
      reframePlan.dynamicCropPath.reduce((sum, point) => sum + point.width, 0) /
      reframePlan.dynamicCropPath.length;
    const avgHeight =
      reframePlan.dynamicCropPath.reduce((sum, point) => sum + point.height, 0) /
      reframePlan.dynamicCropPath.length;
    return { width: avgWidth, height: avgHeight };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  return sourceRatio >= targetRatio
    ? { width: sourceHeight * targetRatio, height: sourceHeight }
    : { width: sourceWidth, height: sourceWidth / targetRatio };
}
