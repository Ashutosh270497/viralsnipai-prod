/**
 * Remotion Premium Renderer (Phase 8)
 *
 * Renders a single pre-cropped video clip with animated captions using
 * Remotion's headless browser rendering engine.
 *
 * Selection logic (called by render-queue.ts):
 *   animation.type === "none"   → FFmpeg (existing path, no change)
 *   animation.type !== "none"   → Remotion (this module) if REMOTION_RENDERER_ENABLED=true
 *   Remotion failure            → FFmpeg static caption fallback
 *
 * Quality guarantees:
 *   - Input video is always the FFmpeg-pre-cropped clip (original quality, CRF 16)
 *   - Output is encoded at CRF 18 with H.264 / yuv420p / AAC 256k
 *   - No extra re-encode after Remotion unless required for watermark
 *   - Never uses previewPath as input
 */

import path from "path";
import { promises as fs } from "fs";
import { logger } from "@/lib/logger";
import type { ClipCaptionStyleConfig } from "@/lib/repurpose/caption-style-config";
import type { CaptionEntry } from "@/lib/srt-utils";
import type { SmartReframePlan } from "@/lib/media/smart-reframe";
import {
  getRemotionBundle,
  REMOTION_COMPOSITION_ID,
  REMOTION_FPS,
  REMOTION_WIDTH,
  REMOTION_HEIGHT,
} from "./remotion-bundle";

/**
 * Props passed to ClipExportComposition via Remotion's inputProps.
 * Kept here (not imported from /remotion/) because that directory is
 * excluded from the Next.js TypeScript project and bundled separately.
 */
export interface ClipExportCompositionProps {
  previewUrl: string;
  durationMs: number;
  entries: CaptionEntry[];
  captionStyle: ClipCaptionStyleConfig;
  captionsEnabled: boolean;
  watermarkText: string | null;
  smartReframePlan?: SmartReframePlan | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const REMOTION_CRF = Number(process.env.REMOTION_EXPORT_CRF ?? 18);
const REMOTION_AUDIO_BITRATE = process.env.REMOTION_EXPORT_AUDIO_BITRATE ?? "256k";

// Concurrency: number of browser threads used per render.
// 1 is safest on memory-constrained servers; increase for faster renders.
const REMOTION_CONCURRENCY = Number(process.env.REMOTION_CONCURRENCY ?? 1);

// How long a single renderMedia() call can run before we abort (ms).
const RENDER_TIMEOUT_MS = Number(process.env.REMOTION_RENDER_TIMEOUT_MS ?? 10 * 60 * 1000);

export const REMOTION_RENDERER_ENABLED =
  (process.env.REMOTION_RENDERER_ENABLED ?? "false").toLowerCase() === "true";

export const REMOTION_RENDERER_MODE = process.env.REMOTION_RENDERER_MODE ?? "node";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RemotionRenderInput {
  /** Absolute path to the FFmpeg-pre-cropped video (never a preview file). */
  preVideoPath: string;
  /** Absolute path for the rendered output MP4. */
  outputPath: string;
  durationMs: number;
  entries: CaptionEntry[];
  captionStyle: ClipCaptionStyleConfig;
  captionsEnabled: boolean;
  /** Watermark text for branded exports (null = no watermark). */
  watermarkText?: string | null;
  smartReframePlan?: SmartReframePlan | null;
  onProgress?: (pct: number) => void;
}

export interface RemotionRenderResult {
  success: true;
  renderDurationMs: number;
  fileSizeBytes: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether the Remotion renderer is enabled and whether the input clip
 * should use it (based on caption animation type).
 */
export function shouldUseRemotionRenderer(captionStyle: ClipCaptionStyleConfig | null | undefined): boolean {
  if (!REMOTION_RENDERER_ENABLED) return false;
  if (!captionStyle) return false;
  return captionStyle.animation.type !== "none";
}

/**
 * Render a pre-cropped video clip with animated captions using Remotion.
 *
 * @throws if rendering fails and the caller should fall back to FFmpeg.
 */
export async function renderWithRemotion(input: RemotionRenderInput): Promise<RemotionRenderResult> {
  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  await fs.mkdir(path.dirname(input.outputPath), { recursive: true });

  const bundleLocation = await getRemotionBundle();

  const durationInFrames = Math.max(1, Math.ceil((input.durationMs / 1000) * REMOTION_FPS));

  // file:// URIs let OffthreadVideo read local files directly
  const previewUrl = `file://${path.resolve(input.preVideoPath)}`;

  const inputProps: ClipExportCompositionProps = {
    previewUrl,
    durationMs: input.durationMs,
    entries: input.entries,
    captionStyle: input.captionStyle,
    captionsEnabled: input.captionsEnabled,
    watermarkText: input.watermarkText ?? null,
    smartReframePlan: input.smartReframePlan ?? null,
  };

  logger.info("remotion: starting render", {
    preVideoPath: input.preVideoPath,
    outputPath: input.outputPath,
    durationMs: input.durationMs,
    animationType: input.captionStyle.animation.type,
    animationSpeed: input.captionStyle.animation.speed,
    captionsEnabled: input.captionsEnabled,
    durationInFrames,
    crf: REMOTION_CRF,
    concurrency: REMOTION_CONCURRENCY,
  });

  const renderStart = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);

  try {
    // Remotion's inputProps must be Record<string, unknown> — cast our typed object
    const serializableProps = inputProps as unknown as Record<string, unknown>;

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: REMOTION_COMPOSITION_ID,
      inputProps: serializableProps,
    });

    // Override duration so the composition matches the actual clip length
    composition.durationInFrames = durationInFrames;
    composition.width = REMOTION_WIDTH;
    composition.height = REMOTION_HEIGHT;
    composition.fps = REMOTION_FPS;

    // audioBitrate type requires the exact `${number}k` template literal
    const audioBitrate = REMOTION_AUDIO_BITRATE as `${number}k`;

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      crf: REMOTION_CRF,
      outputLocation: input.outputPath,
      inputProps: serializableProps,
      // yuv420p for broadest compatibility (matches FFmpeg policy)
      pixelFormat: "yuv420p",
      // JPEG frame capture at high quality — reduces per-frame re-encode loss
      imageFormat: "jpeg",
      jpegQuality: 95,
      audioBitrate,
      // Ensure the output has faststart for progressive download
      overwrite: true,
      concurrency: REMOTION_CONCURRENCY,
      chromiumOptions: {
        // swiftshader: software GL, works on servers without GPU
        gl: "swiftshader",
        // Allow file:// sources in OffthreadVideo
        disableWebSecurity: true,
      },
      offthreadVideoCacheSizeInBytes: 512 * 1024 * 1024, // 512 MB
      onProgress: ({ progress }) => {
        input.onProgress?.(Math.round(progress * 100));
      },
    });

    const renderDurationMs = Date.now() - renderStart;
    let fileSizeBytes = 0;
    try {
      fileSizeBytes = (await fs.stat(input.outputPath)).size;
    } catch {
      // non-fatal
    }

    logger.info("remotion: render complete", {
      outputPath: input.outputPath,
      renderDurationMs,
      fileSizeBytes,
      crf: REMOTION_CRF,
      audioBitrate: REMOTION_AUDIO_BITRATE,
    });

    return { success: true, renderDurationMs, fileSizeBytes };
  } finally {
    clearTimeout(timeout);
  }
}
