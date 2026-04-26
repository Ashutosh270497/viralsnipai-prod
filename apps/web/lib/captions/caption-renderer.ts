import type { SmartReframePlan } from "@/lib/media/smart-reframe";
import type { ClipCaptionStyleConfig } from "@/lib/repurpose/caption-style-config";
import type { CaptionEntry } from "@/lib/srt-utils";
import { logger } from "@/lib/logger";

export type CaptionRendererKind = "ffmpeg_static" | "remotion_animated";
export type ExportQuality = "balanced" | "high";

export type RenderCaptionsInput = {
  sourcePath: string;
  outputPath: string;
  captions: CaptionEntry[];
  captionStyle: ClipCaptionStyleConfig;
  reframePlan: SmartReframePlan;
  exportQuality: ExportQuality;
};

export type RenderResult = {
  renderer: CaptionRendererKind;
  outputPath: string;
  warnings: string[];
};

export interface CaptionRenderer {
  kind: CaptionRendererKind;
  renderCaptions(input: RenderCaptionsInput): Promise<RenderResult>;
}

const FFMPEG_RENDERED_ANIMATIONS = new Set(["none"]);

export class FfmpegStaticCaptionRenderer implements CaptionRenderer {
  kind: CaptionRendererKind = "ffmpeg_static";

  async renderCaptions(input: RenderCaptionsInput): Promise<RenderResult> {
    const animationType = input.captionStyle.animation?.type ?? "none";
    const warnings: string[] = [];

    if (!FFMPEG_RENDERED_ANIMATIONS.has(animationType)) {
      warnings.push(
        `Caption animation "${animationType}" is stored but not rendered by ffmpeg_static; static caption fallback will be used.`
      );
      logger.warn("caption-renderer: unsupported animation fallback", {
        renderer: this.kind,
        animationType,
        outputPath: input.outputPath,
      });
    }

    return {
      renderer: this.kind,
      outputPath: input.outputPath,
      warnings,
    };
  }
}

export function createCaptionRenderer(kind: CaptionRendererKind = "ffmpeg_static"): CaptionRenderer {
  if (kind === "remotion_animated") {
    logger.warn("caption-renderer: Remotion renderer requested but not enabled; using ffmpeg_static fallback");
  }
  return new FfmpegStaticCaptionRenderer();
}
