import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { srtUtils } from "@/lib/srt-utils";
import { logger } from "@/lib/logger";
import type { ClipReframePlan, VideoGeometry } from "@/lib/types";
import type { ClipCaptionStyleConfig, HookOverlay } from "@/lib/repurpose/caption-style-config";

const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  ffmpegStatic,
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/usr/bin/ffmpeg"
].filter((candidate): candidate is string => Boolean(candidate));

const ffprobeCandidates = [
  process.env.FFPROBE_PATH,
  (ffprobeStatic && "path" in ffprobeStatic ? (ffprobeStatic as any).path : ffprobeStatic),
  "/opt/homebrew/bin/ffprobe",
  "/usr/local/bin/ffprobe",
  "/usr/bin/ffprobe"
].filter((candidate): candidate is string => Boolean(candidate));

function configureFfmpegBinary() {
  const ffmpegPath = ffmpegCandidates[0];
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }

  const ffprobePath = ffprobeCandidates[0];
  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath);
  }
}

configureFfmpegBinary();

export const PRESETS = {
  shorts_9x16_1080: { width: 1080, height: 1920 },
  square_1x1_1080: { width: 1080, height: 1080 },
  portrait_4x5_1080: { width: 1080, height: 1350 },
  landscape_16x9_1080: { width: 1920, height: 1080 }
} as const;

// High-quality export — CRF 16, slow preset. Used for all final export encodes.
const playbackOptions = [
  "-c:v",    "libx264",
  "-preset",  "slow",
  "-crf",     "16",
  "-profile:v", "high",
  "-level",   "4.2",          // 4.2 supports higher frame-rate/bitrate ceilings than 4.1
  "-pix_fmt", "yuv420p",
  "-c:a",     "aac",
  "-b:a",     "256k",
  "-movflags", "+faststart",
];

// Preview-only quality — CRF 24, veryfast. NEVER use as final export source.
export const previewPlaybackOptions = [
  "-c:v",    "libx264",
  "-preset",  "veryfast",
  "-crf",     "24",
  "-pix_fmt", "yuv420p",
  "-c:a",     "aac",
  "-b:a",     "128k",
  "-movflags", "+faststart",
];

export function getPresetDimensions(preset: keyof typeof PRESETS) {
  return PRESETS[preset];
}

function clampNormalized(value: number, fallback = 0.5) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(0.95, Math.max(0.05, value));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;
  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function hexToAssColor(hex: string, alpha = 0) {
  const { r, g, b } = hexToRgb(hex);
  const aa = Math.max(0, Math.min(255, Math.round(alpha)));
  const toHex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();
  return `&H${toHex(aa)}${toHex(b)}${toHex(g)}${toHex(r)}`;
}

function hexToDrawtextColor(hex: string, opacity = 1) {
  const safeOpacity = Math.max(0, Math.min(1, opacity));
  return `${hex}@${safeOpacity.toFixed(2)}`;
}

function escapeFfmpegText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\n/g, "\\n");
}

function buildSubtitleAlignment(style: ClipCaptionStyleConfig) {
  if (style.position === "top") return 8;
  if (style.position === "middle") return 5;
  return 2;
}

function buildSubtitleMargin(style: ClipCaptionStyleConfig) {
  if (style.position === "top") return 96;
  if (style.position === "middle") return 40;
  return 120;
}

function buildSubtitleForceStyle(style: ClipCaptionStyleConfig) {
  const safeFontName = style.fontFamily.replace(/[,'"]/g, "").trim() || "Arial";
  const values = [
    `FontName=${safeFontName}`,
    `FontSize=${Math.round(style.fontSize)}`,
    `PrimaryColour=${hexToAssColor(style.primaryColor)}`,
    `OutlineColour=${hexToAssColor(style.outlineColor)}`,
    `BorderStyle=${style.background ? 3 : 1}`,
    `Outline=${style.outline ? 2 : 0}`,
    `Shadow=0`,
    `Alignment=${buildSubtitleAlignment(style)}`,
    `MarginV=${buildSubtitleMargin(style)}`,
  ];

  if (style.background) {
    values.push(`BackColour=${hexToAssColor(style.backgroundColor, (1 - style.backgroundOpacity) * 255)}`);
  }

  return values.join(",");
}

function buildSubtitleFilter(srtPath: string, style: ClipCaptionStyleConfig) {
  const escapedSrt = escapeSubtitlesPath(srtPath);
  return `subtitles='${escapedSrt}':force_style='${buildSubtitleForceStyle(style)}'`;
}

function buildOverlayXExpr(align: HookOverlay["align"]) {
  if (align === "left") return "max(48, w*0.08)";
  if (align === "right") return "min(w-text_w-48, w*0.92-text_w)";
  return "(w-text_w)/2";
}

function buildOverlayYExpr(position: HookOverlay["position"]) {
  if (position === "top") return "h*0.12";
  if (position === "center") return "(h-text_h)/2";
  return "h*0.74";
}

function buildHookOverlayFilter(overlay: HookOverlay) {
  const startSeconds = Math.max(0, overlay.startMs / 1000);
  const endSeconds = Math.max(startSeconds + 0.05, overlay.endMs / 1000);
  const fontColor = hexToDrawtextColor(overlay.textColor, 1);
  const boxColor = hexToDrawtextColor(overlay.backgroundColor, overlay.backgroundOpacity);
  const xExpr = buildOverlayXExpr(overlay.align);
  const yExpr = buildOverlayYExpr(overlay.position);
  const text = escapeFfmpegText(overlay.text);

  return [
    "drawtext",
    `text='${text}'`,
    `fontsize=${Math.round(overlay.fontSize)}`,
    `fontcolor=${fontColor}`,
    `x=${xExpr}`,
    `y=${yExpr}`,
    `box=1`,
    `boxcolor=${boxColor}`,
    `boxborderw=18`,
    `line_spacing=8`,
    `enable='between(t,${startSeconds.toFixed(2)},${endSeconds.toFixed(2)})'`,
  ]
    .filter(Boolean)
    .join(":");
}

export function buildCaptionOverlayFilterChain({
  preset,
  srtPath,
  captionStyle,
}: {
  preset: keyof typeof PRESETS;
  srtPath?: string;
  captionStyle?: ClipCaptionStyleConfig | null;
}) {
  const { width, height } = getPresetDimensions(preset);
  const filters: string[] = [];
  const normalizedStyle = captionStyle ?? null;

  if (srtPath && normalizedStyle) {
    filters.push(buildSubtitleFilter(srtPath, normalizedStyle));
  } else if (srtPath) {
    const escapedSrt = escapeSubtitlesPath(srtPath);
    filters.push(`subtitles='${escapedSrt}'`);
  }

  if (normalizedStyle?.hookOverlays?.length) {
    normalizedStyle.hookOverlays.forEach((overlay) => {
      filters.push(buildHookOverlayFilter(overlay));
    });
  }

  filters.push(`scale=${width}:${height}:flags=lanczos`);
  filters.push("setsar=1");
  return filters.join(",");
}

function getPlanAnchorCenter(plan?: ClipReframePlan | null) {
  if (!plan || plan.anchor === "center") {
    return { centerX: 0.5, centerY: 0.5 };
  }

  const centerX = clampNormalized(plan.safeZone.x + plan.safeZone.width / 2, 0.5);
  const centerY = clampNormalized(plan.safeZone.y + plan.safeZone.height / 2, 0.5);

  return { centerX, centerY };
}

function buildTrackingProgressExpr(durationSeconds: number) {
  const durationExpr = Math.max(durationSeconds, 0.2).toFixed(4);
  return `(0.5-0.5*cos(PI*max(0,min(1,t/${durationExpr}))))`;
}

function buildTrackedCropCenter({
  baseCenter,
  travel,
  easing,
  durationSeconds,
}: {
  baseCenter: number;
  travel: number;
  easing: "linear" | "ease_in_out";
  durationSeconds: number;
}) {
  if (!Number.isFinite(travel) || travel <= 0 || durationSeconds <= 0) {
    return baseCenter.toFixed(4);
  }

  const progressExpr =
    easing === "linear"
      ? `max(0,min(1,t/${Math.max(durationSeconds, 0.2).toFixed(4)}))`
      : buildTrackingProgressExpr(durationSeconds);
  return `${baseCenter.toFixed(4)}+(${travel.toFixed(4)})*(${progressExpr}-0.5)`;
}

function escapeFilterExpression(value: string) {
  return value.replace(/,/g, "\\,");
}

export function buildPresetVideoFilter({
  preset,
  reframePlan,
  durationSeconds,
}: {
  preset: keyof typeof PRESETS;
  reframePlan?: ClipReframePlan | null;
  durationSeconds?: number;
}) {
  const { width, height } = getPresetDimensions(preset);
  const targetRatio = width / height;

  if (!reframePlan || reframePlan.mode === "letterbox") {
    return `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  }

  const { centerX, centerY } = getPlanAnchorCenter(reframePlan);
  const tracking = reframePlan.tracking;
  const ratioExpr = targetRatio.toFixed(6);
  const centerXExpr =
    tracking?.axis === "horizontal"
      ? buildTrackedCropCenter({
          baseCenter: centerX,
          travel: tracking.travel * tracking.lockStrength,
          easing: tracking.easing,
          durationSeconds: durationSeconds ?? 0,
        })
      : centerX.toFixed(4);
  const centerYExpr =
    tracking?.axis === "vertical"
      ? buildTrackedCropCenter({
          baseCenter: centerY,
          travel: tracking.travel * tracking.lockStrength,
          easing: tracking.easing,
          durationSeconds: durationSeconds ?? 0,
        })
      : centerY.toFixed(4);
  const cropWidthRaw = `if(gte(iw/ih,${ratioExpr}),ih*${ratioExpr},iw)`;
  const cropHeightRaw = `if(gte(iw/ih,${ratioExpr}),ih,iw/${ratioExpr})`;
  const cropXRaw = `if(gte(iw/ih,${ratioExpr}),max(0,min(iw-(${cropWidthRaw}),iw*${centerXExpr}-(${cropWidthRaw})/2)),0)`;
  const cropYRaw = `if(gte(iw/ih,${ratioExpr}),0,max(0,min(ih-(${cropHeightRaw}),ih*${centerYExpr}-(${cropHeightRaw})/2)))`;

  const cropWidthExpr = escapeFilterExpression(cropWidthRaw);
  const cropHeightExpr = escapeFilterExpression(cropHeightRaw);
  const cropXExpr = escapeFilterExpression(cropXRaw);
  const cropYExpr = escapeFilterExpression(cropYRaw);

  return `crop=${cropWidthExpr}:${cropHeightExpr}:${cropXExpr}:${cropYExpr},scale=${width}:${height}:flags=lanczos,setsar=1`;
}

export async function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error);
      } else {
        resolve(metadata.format.duration ?? 0);
      }
    });
  });
}

export async function probeVideoGeometry(filePath: string): Promise<VideoGeometry> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error);
        return;
      }

      const videoStream = metadata.streams.find((stream: any) => stream.codec_type === "video");
      if (!videoStream?.width || !videoStream?.height) {
        reject(new Error("Video stream metadata missing width/height"));
        return;
      }

      const rotationValue =
        Number(videoStream.tags?.rotate) ||
        Number(
          videoStream.side_data_list?.find((entry: any) => typeof entry.rotation !== "undefined")?.rotation ?? 0
        ) ||
        0;

      const isRotated = Math.abs(rotationValue) === 90 || Math.abs(rotationValue) === 270;
      const width = isRotated ? Number(videoStream.height) : Number(videoStream.width);
      const height = isRotated ? Number(videoStream.width) : Number(videoStream.height);
      const aspectRatio = height > 0 ? width / height : 1;
      const orientation =
        Math.abs(aspectRatio - 1) < 0.05 ? "square" : aspectRatio > 1 ? "landscape" : "portrait";

      const sourceRatioLabel =
        Math.abs(aspectRatio - 9 / 16) < 0.05
          ? "9:16"
          : Math.abs(aspectRatio - 1) < 0.05
          ? "1:1"
          : Math.abs(aspectRatio - 16 / 9) < 0.08
          ? "16:9"
          : "custom";

      resolve({
        width,
        height,
        aspectRatio,
        orientation,
        sourceRatioLabel,
      });
    });
  });
}

export async function detectSceneChanges({
  inputPath,
  threshold = 0.34,
  maxCuts = 300,
}: {
  inputPath: string;
  threshold?: number;
  maxCuts?: number;
}): Promise<number[]> {
  const binary = ffmpegCandidates[0];
  if (!binary) {
    return [];
  }

  const args = [
    "-hide_banner",
    "-i",
    inputPath,
    "-filter:v",
    `select='gt(scene,${threshold})',showinfo`,
    "-an",
    "-f",
    "null",
    "-",
  ];

  return new Promise<number[]>((resolve) => {
    const cutSet = new Set<number>();
    const parser = (chunk: string) => {
      const regex = /pts_time:([0-9]+(?:\\.[0-9]+)?)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(chunk)) !== null) {
        const sec = Number(match[1]);
        if (!Number.isFinite(sec) || sec < 0) continue;
        cutSet.add(Math.round(sec * 1000));
        if (cutSet.size >= maxCuts) {
          break;
        }
      }
    };

    let stderrData = "";
    let stdoutData = "";
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdoutData += text;
      parser(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderrData += text;
      parser(text);
    });

    child.on("error", () => resolve([]));
    child.on("close", () => {
      parser(stdoutData);
      parser(stderrData);
      resolve(
        [...cutSet]
          .filter((value) => Number.isFinite(value) && value > 0)
          .sort((a, b) => a - b)
          .slice(0, maxCuts)
      );
    });
  });
}

export async function extractClip({
  inputPath,
  startMs,
  endMs,
  outputPath,
  preset,
  reframePlan,
}: {
  inputPath: string;
  startMs: number;
  endMs: number;
  outputPath: string;
  preset?: keyof typeof PRESETS;
  reframePlan?: ClipReframePlan | null;
}) {
  const startSeconds = startMs / 1000;
  const durationSeconds = Math.max((endMs - startMs) / 1000, 0.12);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    let commandLine: string | undefined;
    const command = ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .setDuration(durationSeconds)
      .output(outputPath)
      .on("start", (cmd) => {
        commandLine = cmd;
      })
      .on("end", () => resolve())
      .on("error", (error, _stdout, stderr) =>
        reject(
          buildFfmpegError("extractClip", error, {
            inputPath,
            outputPath,
            commandLine,
            stderr: stderr ?? undefined,
          })
        )
      );

    const outputOptions = [...playbackOptions];
    if (preset) {
      outputOptions.unshift(
        "-vf",
        buildPresetVideoFilter({ preset, reframePlan, durationSeconds })
      );
    }

    command.outputOptions(outputOptions).run();
  });
}

export async function burnCaptions({
  inputPath,
  srtPath,
  outputPath,
  preset,
  captionStyle,
}: {
  inputPath: string;
  srtPath: string;
  outputPath: string;
  preset: keyof typeof PRESETS;
  captionStyle?: ClipCaptionStyleConfig | null;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    let commandLine: string | undefined;
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        buildCaptionOverlayFilterChain({ preset, srtPath, captionStyle }),
        ...playbackOptions
      ])
      .output(outputPath)
      .on("start", (cmd) => {
        commandLine = cmd;
      })
      .on("end", () => resolve())
      .on("error", (error, _stdout, stderr) =>
        reject(
          buildFfmpegError("burnCaptions", error, {
            inputPath,
            outputPath,
            commandLine,
            stderr: stderr ?? undefined,
            extras: `srtPath=${srtPath}`,
          })
        )
      )
      .run();
  });
}

export async function applyCaptionAndOverlayStyling({
  inputPath,
  outputPath,
  preset,
  srtPath,
  captionStyle,
}: {
  inputPath: string;
  outputPath: string;
  preset: keyof typeof PRESETS;
  srtPath?: string;
  captionStyle?: ClipCaptionStyleConfig | null;
}) {
  const hasOverlays = Boolean(captionStyle?.hookOverlays?.length);
  if (!srtPath && !hasOverlays) {
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    let commandLine: string | undefined;
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        buildCaptionOverlayFilterChain({ preset, srtPath, captionStyle }),
        ...playbackOptions,
      ])
      .output(outputPath)
      .on("start", (cmd) => {
        commandLine = cmd;
      })
      .on("end", () => resolve())
      .on("error", (error, _stdout, stderr) =>
        reject(
          buildFfmpegError("applyCaptionAndOverlayStyling", error, {
            inputPath,
            outputPath,
            commandLine,
            stderr: stderr ?? undefined,
          })
        )
      )
      .run();
  });
}

export async function concatClips({
  clipPaths,
  outputPath,
  preset,
  watermarkPath
}: {
  clipPaths: string[];
  outputPath: string;
  preset: keyof typeof PRESETS;
  watermarkPath?: string | null;
}) {
  const concatListPath = `${outputPath}.txt`;
  const listContent = clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(concatListPath, listContent);

  const { width, height } = getPresetDimensions(preset);

  return new Promise<void>((resolve, reject) => {
    let commandLine: string | undefined;
    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .output(outputPath)
      .on("start", (cmd) => {
        commandLine = cmd;
      })
      .on("end", async () => {
        await fs.unlink(concatListPath);
        resolve();
      })
      .on("error", async (error, _stdout, stderr) => {
        await fs.unlink(concatListPath).catch(() => null);
        reject(
          buildFfmpegError("concatClips", error, {
            outputPath,
            commandLine,
            stderr: stderr ?? undefined,
            extras: `clipCount=${clipPaths.length}; watermarkPath=${watermarkPath ?? "none"}`,
          })
        );
      });

    if (watermarkPath) {
      // Re-encode required to composite the watermark overlay.
      const offset = 48;
      command.input(watermarkPath);
      command.complexFilter([
        // Clips from extractAndRenderSegment are already at target resolution; scale is a no-op
        // but we keep it for safety against any upstream dimension mismatch.
        `[0:v]scale=${width}:${height}:flags=lanczos[base]`,
        `[base][1:v]overlay=W-w-${offset}:H-h-${offset}[v]`,
      ]);
      command.outputOptions([...playbackOptions, "-map", "[v]", "-map", "0:a?"]);
    } else {
      // All input clips come from extractAndRenderSegment (H.264/AAC at the target resolution).
      // Stream copy avoids a re-encode pass and preserves quality exactly.
      command.outputOptions(["-c", "copy"]);
    }

    command.run();
  });
}

/**
 * Concatenate pre-encoded clips using stream copy — no re-encode, no quality loss.
 *
 * All input clips must share the same codec, resolution, and frame rate.
 * Clips produced by extractClip / extractAndRenderSegment always satisfy this.
 */
export async function concatClipsPassthrough({
  clipPaths,
  outputPath,
}: {
  clipPaths: string[];
  outputPath: string;
}) {
  const concatListPath = `${outputPath}.txt`;
  const listContent = clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(concatListPath, listContent);

  return new Promise<void>((resolve, reject) => {
    let commandLine: string | undefined;
    ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      // Stream copy: clips are already H.264/AAC at the correct resolution.
      .outputOptions(["-c", "copy"])
      .output(outputPath)
      .on("start", (cmd) => { commandLine = cmd; })
      .on("end", async () => {
        await fs.unlink(concatListPath).catch(() => null);
        resolve();
      })
      .on("error", async (error, _stdout, stderr) => {
        await fs.unlink(concatListPath).catch(() => null);
        reject(
          buildFfmpegError("concatClipsPassthrough", error, {
            outputPath,
            commandLine,
            stderr: stderr ?? undefined,
            extras: `clipCount=${clipPaths.length}`,
          })
        );
      })
      .run();
  });
}

/**
 * Render a full export from source segments.
 *
 * Quality guarantee:
 *   Each segment is encoded in a single FFmpeg pass: crop/reframe + scale + caption burn-in
 *   all happen together (extractAndRenderSegment). The previous two-pass approach
 *   (extractClip → applyCaptionAndOverlayStyling) caused visible generation loss and is gone.
 *
 *   Concatenation uses stream copy when no watermark is needed, adding zero quality loss.
 *   When a watermark overlay is required it adds one extra encode pass (unavoidable for compositing).
 *
 * Pass count:
 *   No captions, no watermark:  1 encode pass  (extractAndRenderSegment) + stream copy concat
 *   With captions, no watermark: 1 encode pass  (extractAndRenderSegment) + stream copy concat
 *   With watermark:              2 encode passes (extractAndRenderSegment + watermark concat)
 *   Previously (always):         3 encode passes (extract + caption + concat)
 */
export async function renderExport({
  segments,
  preset,
  outputPath,
  captionPaths,
  watermarkPath,
  onProgress,
}: {
  segments: Array<{
    startMs: number;
    endMs: number;
    id: string;
    sourcePath: string;
    reframePlan?: ClipReframePlan | null;
    captionStyle?: ClipCaptionStyleConfig | null;
  }>;
  preset: keyof typeof PRESETS;
  outputPath: string;
  captionPaths?: Record<string, string | undefined | null>;
  watermarkPath?: string | null;
  onProgress?: (state: {
    step: "extracting" | "styling" | "stitching" | "finalizing";
    progressPct: number;
    segmentIndex?: number;
    segmentCount?: number;
  }) => void;
}) {
  const tempDir = `${outputPath}_segments`;
  await fs.mkdir(tempDir, { recursive: true });

  const clipPaths: string[] = [];
  const tempCaptionPaths: string[] = [];
  const renderStart = Date.now();

  try {
    for (const [index, segment] of segments.entries()) {
      const clipPath = path.join(tempDir, `${segment.id}.mp4`);
      const segmentIndex = index + 1;
      const segmentCount = segments.length;

      // Spread the full 18→76% range across all segments (single pass per segment now)
      onProgress?.({
        step: "extracting",
        progressPct: 18 + (segmentIndex - 1) * (58 / Math.max(segmentCount, 1)),
        segmentIndex,
        segmentCount,
      });

      const captionSource = captionPaths?.[segment.id];
      const caption = await resolveCaptionInput(captionSource, tempDir, segment.id);
      if (caption?.temporary) {
        tempCaptionPaths.push(caption.srtPath);
      }

      // Single-pass: crop/reframe + scale + caption burn all in one FFmpeg invocation.
      // Input is always the original source asset — never a preview or intermediate clip.
      await extractAndRenderSegment({
        inputPath: segment.sourcePath,
        startMs: segment.startMs,
        endMs: segment.endMs,
        outputPath: clipPath,
        preset,
        reframePlan: segment.reframePlan,
        srtPath: caption?.srtPath ?? null,
        captionStyle: segment.captionStyle,
      });

      clipPaths.push(clipPath);
    }

    onProgress?.({ step: "stitching", progressPct: 84, segmentCount: segments.length });

    // No-watermark path: stream copy (zero quality loss).
    // Watermark path: one composite re-encode (unavoidable for overlay).
    await concatClips({ clipPaths, outputPath, preset, watermarkPath });

    onProgress?.({ step: "finalizing", progressPct: 96, segmentCount: segments.length });

    logger.info("renderExport completed", {
      outputPath,
      preset,
      segmentCount: segments.length,
      withWatermark: Boolean(watermarkPath),
      withCaptions: Object.values(captionPaths ?? {}).some(Boolean),
      totalDurationMs: Date.now() - renderStart,
    });
  } finally {
    await Promise.all(
      clipPaths.map(async (clipPath) => {
        if (clipPath.startsWith(tempDir)) {
          await fs.unlink(clipPath).catch(() => null);
        }
      })
    );
    await Promise.all(tempCaptionPaths.map((p) => fs.unlink(p).catch(() => null)));
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
  }
}

async function resolveCaptionInput(
  captionSource: string | undefined | null,
  tempDir: string,
  segmentId: string
): Promise<{ srtPath: string; temporary: boolean } | null> {
  if (!captionSource || typeof captionSource !== "string") {
    return null;
  }

  const normalized = captionSource.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return null;
  }

  if (srtUtils.isValidSRT(normalized)) {
    const generatedSrtPath = path.join(tempDir, `${segmentId}.srt`);
    await fs.writeFile(generatedSrtPath, normalized, "utf-8");
    return { srtPath: generatedSrtPath, temporary: true };
  }

  try {
    await fs.access(normalized);
    return { srtPath: normalized, temporary: false };
  } catch {
    return null;
  }
}

/**
 * Probe whether the input is already a web-compatible H.264/AAC MP4.
 * Returns true if we can skip re-encoding and just remux.
 */
async function isWebCompatible(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (_error, metadata) => {
      if (_error || !metadata?.streams) {
        resolve(false);
        return;
      }
      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      const audioStream = metadata.streams.find((s) => s.codec_type === "audio");
      const isH264 = videoStream?.codec_name === "h264";
      const isAac = !audioStream || audioStream.codec_name === "aac";
      resolve(isH264 && isAac);
    });
  });
}

export async function normalizeVideo({
  inputPath,
  outputPath
}: {
  inputPath: string;
  outputPath: string;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // If source is already H.264+AAC, remux without re-encoding to preserve quality
  const canRemux = await isWebCompatible(inputPath);

  return new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg(inputPath);
    if (canRemux) {
      cmd.outputOptions([
        "-c:v", "copy",
        "-c:a", "copy",
        "-movflags", "+faststart"
      ]);
    } else {
      cmd.outputOptions([...playbackOptions]);
    }
    cmd
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

export async function transcodeToMp3({
  inputPath,
  outputPath,
  bitrateKbps = 64,
  sampleRate = 16000,
  channels = 1
}: {
  inputPath: string;
  outputPath: string;
  bitrateKbps?: number;
  sampleRate?: number;
  channels?: number;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vn",
        "-ac",
        String(channels),
        "-ar",
        String(sampleRate),
        "-b:a",
        `${bitrateKbps}k`
      ])
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .save(outputPath);
  });
}

function escapeSubtitlesPath(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/'/g, "\\'");
}

function buildFfmpegError(
  operation: string,
  error: unknown,
  options?: {
    inputPath?: string;
    outputPath?: string;
    commandLine?: string;
    stderr?: string;
    extras?: string;
  }
) {
  const baseMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown ffmpeg error";
  const stderrSnippet = options?.stderr
    ? options.stderr
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-4)
        .join(" | ")
    : null;
  const details = [
    options?.inputPath ? `input=${options.inputPath}` : null,
    options?.outputPath ? `output=${options.outputPath}` : null,
    options?.extras ? options.extras : null,
    options?.commandLine ? `cmd=${options.commandLine}` : null,
    stderrSnippet ? `stderr=${stderrSnippet}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return new Error(details ? `${operation} failed: ${baseMessage} | ${details}` : `${operation} failed: ${baseMessage}`);
}

export async function generateThumbnail({
  inputPath,
  timestampMs,
  outputPath
}: {
  inputPath: string;
  timestampMs: number;
  outputPath: string;
}) {
  const timestampSeconds = timestampMs / 1000;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(timestampSeconds)
      .outputOptions([
        "-frames:v", "1",
        "-q:v", "2",
        "-vf", "scale=480:-1:flags=lanczos"
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

/**
 * Extract audio from video file (for voice translation)
 */
export async function extractAudio({
  videoPath,
  outputPath
}: {
  videoPath: string;
  outputPath: string;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .output(outputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run();
  });
}

/**
 * Replace audio in video file (for voice translation)
 */
export async function replaceAudio({
  videoPath,
  audioPath,
  outputPath
}: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run();
  });
}

/**
 * Get audio duration in seconds
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (error, metadata) => {
      if (error) {
        reject(error);
      } else {
        resolve(metadata.format.duration ?? 0);
      }
    });
  });
}

// ─── Quality-preserving single-pass rendering ────────────────────────────────

export interface SourceMetadata {
  width: number | null;
  height: number | null;
  fps: number | null;
  durationSec: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  videoBitrateKbps: number | null;
  audioBitrateKbps: number | null;
  rotation: number;
}

/**
 * Probe source video for quality-relevant metadata.
 * Used for render logging and adaptive quality decisions.
 */
export async function probeSourceMetadata(filePath: string): Promise<SourceMetadata> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (_error, metadata) => {
      if (_error || !metadata?.streams) {
        resolve({ width: null, height: null, fps: null, durationSec: null, videoCodec: null, audioCodec: null, videoBitrateKbps: null, audioBitrateKbps: null, rotation: 0 });
        return;
      }
      const v = metadata.streams.find((s: any) => s.codec_type === "video");
      const a = metadata.streams.find((s: any) => s.codec_type === "audio");

      let fps: number | null = null;
      const fpsStr = v?.r_frame_rate ?? v?.avg_frame_rate;
      if (fpsStr && typeof fpsStr === "string" && fpsStr.includes("/")) {
        const [num, den] = fpsStr.split("/").map(Number);
        if (den) fps = Math.round((num / den) * 100) / 100;
      }

      const rotationRaw =
        Number(v?.tags?.rotate ?? 0) ||
        Number(v?.side_data_list?.find((e: any) => typeof e.rotation !== "undefined")?.rotation ?? 0);

      resolve({
        width: v?.width ?? null,
        height: v?.height ?? null,
        fps,
        durationSec: metadata.format?.duration ?? null,
        videoCodec: v?.codec_name ?? null,
        audioCodec: a?.codec_name ?? null,
        videoBitrateKbps: v?.bit_rate ? Math.round(Number(v.bit_rate) / 1000) : null,
        audioBitrateKbps: a?.bit_rate ? Math.round(Number(a.bit_rate) / 1000) : null,
        rotation: Math.abs(rotationRaw),
      });
    });
  });
}

/**
 * Build a combined video filter string that applies reframe/crop/scale and caption
 * burn-in in one filter chain — eliminating the need for a second encode pass.
 *
 * Filter order matters:
 *   1. Reframe + scale to target resolution (buildPresetVideoFilter)
 *   2. Burn subtitles at the scaled resolution (font sizes stay correct)
 *   3. Burn timed hook overlays
 */
function buildSinglePassVideoFilter({
  preset,
  reframePlan,
  durationSeconds,
  srtPath,
  captionStyle,
}: {
  preset: keyof typeof PRESETS;
  reframePlan?: ClipReframePlan | null;
  durationSeconds?: number;
  srtPath?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
}): string {
  // Step 1 — reframe + scale (already includes :flags=lanczos in buildPresetVideoFilter)
  const filters: string[] = [buildPresetVideoFilter({ preset, reframePlan, durationSeconds })];

  // Step 2 — subtitle burn (post-scale so absolute font sizes are correct on the target canvas)
  if (srtPath && captionStyle) {
    const animationType = captionStyle.animation?.type ?? "none";
    if (animationType !== "none") {
      logger.warn("render:caption_animation_static_fallback", {
        animationType,
        renderer: "ffmpeg_static",
      });
    }
    filters.push(buildSubtitleFilter(srtPath, captionStyle));
  } else if (srtPath) {
    filters.push(`subtitles='${escapeSubtitlesPath(srtPath)}'`);
  }

  // Step 3 — timed hook overlays
  captionStyle?.hookOverlays?.forEach((overlay) => {
    filters.push(buildHookOverlayFilter(overlay));
  });

  return filters.join(",");
}

/**
 * Extract a segment from source video and apply crop/scale + caption burn-in in
 * a single FFmpeg encode pass.
 *
 * This is the quality-correct replacement for the old two-step
 * extractClip() → applyCaptionAndOverlayStyling() approach which caused a second
 * lossy encode even at CRF 16.
 *
 * Input: always the original source asset path (never a preview or intermediate clip).
 */
export async function extractAndRenderSegment({
  inputPath,
  startMs,
  endMs,
  outputPath,
  preset,
  reframePlan,
  srtPath,
  captionStyle,
  quality = "export",
}: {
  inputPath: string;
  startMs: number;
  endMs: number;
  outputPath: string;
  preset: keyof typeof PRESETS;
  reframePlan?: ClipReframePlan | null;
  srtPath?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
  quality?: "export" | "preview";
}): Promise<void> {
  const startSeconds = startMs / 1000;
  const durationSeconds = Math.max((endMs - startMs) / 1000, 0.12);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const videoFilter = buildSinglePassVideoFilter({
    preset, reframePlan, durationSeconds, srtPath, captionStyle,
  });
  const qualityOpts = quality === "preview" ? [...previewPlaybackOptions] : [...playbackOptions];
  const renderStart = Date.now();

  // Log source metadata for diagnostics (non-blocking — runs concurrently with encode setup)
  const sourceMeta = await probeSourceMetadata(inputPath).catch(() => null);

  return new Promise<void>((resolve, reject) => {
    let commandLine: string | undefined;
    ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .setDuration(durationSeconds)
      .outputOptions(["-vf", videoFilter, ...qualityOpts])
      .output(outputPath)
      .on("start", (cmd) => { commandLine = cmd; })
      .on("end", async () => {
        let fileSizeBytes: number | null = null;
        try { fileSizeBytes = (await fs.stat(outputPath)).size; } catch { /* ignore */ }

        logger.info("render:segment", {
          inputPath,
          outputPath,
          preset,
          quality,
          crf: quality === "preview" ? 24 : 16,
          codec: "libx264",
          audioBitrate: quality === "preview" ? "128k" : "256k",
          reframeMode: reframePlan?.mode ?? "none",
          hasCaptions: Boolean(srtPath),
          hasHookOverlays: Boolean(captionStyle?.hookOverlays?.length),
          streamCopy: false,
          sourceWidth: sourceMeta?.width,
          sourceHeight: sourceMeta?.height,
          sourceFps: sourceMeta?.fps,
          sourceCodec: sourceMeta?.videoCodec,
          sourceAudioCodec: sourceMeta?.audioCodec,
          sourceBitrateKbps: sourceMeta?.videoBitrateKbps,
          fileSizeBytes,
          renderDurationMs: Date.now() - renderStart,
        });
        resolve();
      })
      .on("error", (_error, _stdout, stderr) =>
        reject(buildFfmpegError("extractAndRenderSegment", _error, {
          inputPath, outputPath, commandLine, stderr: stderr ?? undefined,
        }))
      )
      .run();
  });
}
