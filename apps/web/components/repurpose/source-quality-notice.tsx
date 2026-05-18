"use client";

import { AlertTriangle, Crop } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SourceQualityLevel = "good" | "medium" | "low";
type RecommendedRenderMode = "crop" | "blur_background" | "original_aspect";

export type SourceQualityAssessment = {
  level: SourceQualityLevel;
  renderMode: RecommendedRenderMode;
  upscaleFactor: number | null;
  shouldWarn: boolean;
  resolutionLabel: string | null;
  message: string | null;
  renderMessage: string | null;
};

export function assessSourceQualityForUi({
  sourceWidth,
  sourceHeight,
  sourceBitrateKbps,
  targetWidth = 1080,
  targetHeight = 1920,
}: {
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceBitrateKbps?: number | null;
  targetWidth?: number;
  targetHeight?: number;
}): SourceQualityAssessment {
  if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
    return {
      level: "medium",
      renderMode: "original_aspect",
      upscaleFactor: null,
      shouldWarn: false,
      resolutionLabel: null,
      message: null,
      renderMessage: null,
    };
  }

  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  const sourceIsLandscape = sourceRatio > 1.05;
  const targetIsPortrait = targetRatio < 0.8;
  const estimatedCropWidth =
    sourceRatio >= targetRatio ? sourceHeight * targetRatio : sourceWidth;
  const estimatedCropHeight =
    sourceRatio >= targetRatio ? sourceHeight : sourceWidth / targetRatio;
  const upscaleFactor = Number(
    Math.max(targetWidth / Math.max(1, estimatedCropWidth), targetHeight / Math.max(1, estimatedCropHeight)).toFixed(2),
  );

  const lowResolution = Math.min(sourceWidth, sourceHeight) < 720 || Math.max(sourceWidth, sourceHeight) < 1280;
  const lowBitrate = typeof sourceBitrateKbps === "number" && sourceBitrateKbps > 0 && sourceBitrateKbps < 1200;
  const highUpscale = upscaleFactor > 1.35;
  const sourceIsLowQuality = lowResolution || lowBitrate;
  const level: SourceQualityLevel =
    sourceIsLowQuality
      ? "low"
      : highUpscale
        ? "medium"
        : "good";
  const renderMode: RecommendedRenderMode =
    targetIsPortrait && sourceIsLandscape && highUpscale ? "blur_background" : "crop";
  const resolutionLabel = `${sourceWidth}x${sourceHeight}`;

  return {
    level,
    renderMode,
    upscaleFactor,
    shouldWarn: level === "low" || highUpscale,
    resolutionLabel,
    message:
      level === "low"
        ? `Source quality is low. This video is ${resolutionLabel} and will be upscaled for Shorts/Reels. Output may look soft. Upload 1080p or higher for best results.`
        : highUpscale
          ? `This source will be enlarged ${upscaleFactor}x for the selected frame. Use the final export for the best available quality.`
          : null,
    renderMessage:
      renderMode === "blur_background"
        ? "To preserve quality, ViralSnipAI used a blur-background layout instead of an aggressive crop."
        : null,
  };
}

export function SourceQualityNotice({
  sourceWidth,
  sourceHeight,
  sourceBitrateKbps,
  targetWidth = 1080,
  targetHeight = 1920,
  compact = false,
  className,
  replaceSourceHref,
  detailsCollapsed = false,
}: {
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceBitrateKbps?: number | null;
  targetWidth?: number;
  targetHeight?: number;
  compact?: boolean;
  className?: string;
  replaceSourceHref?: string;
  detailsCollapsed?: boolean;
}) {
  const assessment = assessSourceQualityForUi({
    sourceWidth,
    sourceHeight,
    sourceBitrateKbps,
    targetWidth,
    targetHeight,
  });

  if (!assessment.resolutionLabel) return null;

  if (!assessment.shouldWarn && compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Badge variant="secondary" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
          Source quality: Good
        </Badge>
        <Badge variant="secondary" className="border-border/50 bg-muted/40 text-muted-foreground">
          Render mode: Crop
        </Badge>
      </div>
    );
  }

  if (!assessment.shouldWarn) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-amber-100",
        className,
      )}
    >
      <div className="flex items-start gap-2 text-xs leading-5 text-amber-100/80">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-100">
            {assessment.level === "low" ? "Source quality is low" : "Source will be enlarged"}
          </p>
          {assessment.message ? (
            <p className="mt-1 break-words">
              {detailsCollapsed && assessment.level === "low" && assessment.resolutionLabel
                ? `This source is ${assessment.resolutionLabel}, so Shorts/Reels exports may look soft.${assessment.renderMode === "blur_background" ? " Blur background mode is applied to preserve quality." : ""}`
                : assessment.level === "low" && assessment.resolutionLabel
                  ? `This video is ${assessment.resolutionLabel}. Shorts/Reels export may look soft.`
                : assessment.message}
            </p>
          ) : null}
          {!detailsCollapsed && assessment.renderMessage ? (
            <p className="mt-1 flex items-start gap-1.5 text-cyan-100/75">
              <Crop className="mt-0.5 h-3 w-3 shrink-0" />
              {assessment.renderMessage}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {replaceSourceHref ? (
          <Link
            href={replaceSourceHref}
            className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/15"
          >
            Replace source
          </Link>
        ) : null}
        {assessment.renderMode === "blur_background" ? (
          <span className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
            Keep blur background mode
          </span>
        ) : null}
      </div>
      {detailsCollapsed ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-amber-100/85">
            View details
          </summary>
          <SourceQualityChips
            level={assessment.level}
            renderMode={assessment.renderMode}
            upscaleFactor={assessment.upscaleFactor}
          />
        </details>
      ) : (
        <SourceQualityChips
          level={assessment.level}
          renderMode={assessment.renderMode}
          upscaleFactor={assessment.upscaleFactor}
        />
      )}
    </div>
  );
}

function SourceQualityChips({
  level,
  renderMode,
  upscaleFactor,
}: {
  level: "low" | "medium" | "good";
  renderMode: RecommendedRenderMode;
  upscaleFactor: number | null;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className="border-amber-500/30 bg-amber-500/15 text-amber-200">
        Source quality: {level === "low" ? "Low" : "Medium"}
      </Badge>
      <Badge variant="secondary" className="border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
        Render mode: {renderMode === "blur_background" ? "Blur background" : renderMode === "original_aspect" ? "Original aspect" : "Crop"}
      </Badge>
      {upscaleFactor ? (
        <Badge variant="secondary" className="border-border/50 bg-background/50 text-muted-foreground">
          Upscale {upscaleFactor}x
        </Badge>
      ) : null}
    </div>
  );
}
