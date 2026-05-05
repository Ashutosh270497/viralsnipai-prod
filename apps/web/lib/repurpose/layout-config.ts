import type { ClipOutputRatio, ClipReframePlan } from "@/lib/types";

export type LayoutPreset =
  | "full_screen_crop"
  | "center_crop"
  | "speaker_focus"
  | "split_screen"
  | "podcast_two_speaker"
  | "screen_share_speaker"
  | "picture_in_picture"
  | "square_letterbox"
  | "manual_crop";

export type LayoutAspectRatio = ClipOutputRatio | "original";

export type LayoutBackgroundMode = "crop" | "blur" | "letterbox" | "solid";

export interface LayoutCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClipLayoutConfig {
  preset: LayoutPreset;
  aspectRatio: LayoutAspectRatio;
  cropBox: LayoutCropBox;
  speakerRegion?: LayoutCropBox | null;
  screenRegion?: LayoutCropBox | null;
  backgroundMode: LayoutBackgroundMode;
  blurBackground: boolean;
  borderRadius: number;
  padding: number;
  safeZones: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  reframeConfidence: "high" | "medium" | "low";
  reason: string;
  updatedAt?: string;
}

export const ASPECT_RATIO_VALUES = ["9:16", "1:1", "4:5", "16:9", "original"] as const satisfies readonly LayoutAspectRatio[];

export const LAYOUT_PRESET_VALUES = [
  "full_screen_crop",
  "center_crop",
  "speaker_focus",
  "split_screen",
  "podcast_two_speaker",
  "screen_share_speaker",
  "picture_in_picture",
  "square_letterbox",
  "manual_crop",
] as const satisfies readonly LayoutPreset[];

export const ASPECT_RATIO_PRESETS: Record<LayoutAspectRatio, { label: string; ratio: number | null }> = {
  "9:16": { label: "9:16 Shorts/Reels/TikTok", ratio: 9 / 16 },
  "1:1": { label: "1:1 Square", ratio: 1 },
  "4:5": { label: "4:5 Portrait Feed", ratio: 4 / 5 },
  "16:9": { label: "16:9 Landscape", ratio: 16 / 9 },
  original: { label: "Original source", ratio: null },
};

export const LAYOUT_PRESETS: Record<LayoutPreset, { label: string; description: string; confidence: ClipLayoutConfig["reframeConfidence"] }> = {
  full_screen_crop: {
    label: "Full-screen crop",
    description: "Fill the frame with a clean platform crop.",
    confidence: "medium",
  },
  center_crop: {
    label: "Center crop",
    description: "Use the source center when detection is unavailable.",
    confidence: "medium",
  },
  speaker_focus: {
    label: "Speaker focus",
    description: "Keep the speaker-safe region in frame.",
    confidence: "medium",
  },
  split_screen: {
    label: "Split screen",
    description: "Two stacked or side-by-side source regions.",
    confidence: "low",
  },
  podcast_two_speaker: {
    label: "Podcast two-speaker",
    description: "Balanced crop for conversational podcasts.",
    confidence: "low",
  },
  screen_share_speaker: {
    label: "Screen share + speaker",
    description: "Reserve room for screen content and speaker.",
    confidence: "low",
  },
  picture_in_picture: {
    label: "Picture-in-picture",
    description: "Main content with speaker inset planning.",
    confidence: "low",
  },
  square_letterbox: {
    label: "Square letterbox",
    description: "Preserve source composition inside a square frame.",
    confidence: "high",
  },
  manual_crop: {
    label: "Manual crop",
    description: "Use the crop box selected in the editor.",
    confidence: "high",
  },
};

const DEFAULT_CROP_BOX: LayoutCropBox = { x: 0, y: 0, width: 1, height: 1 };
const DEFAULT_SAFE_ZONES = { top: 0.1, bottom: 0.2, left: 0.08, right: 0.08 };

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}

export function isLayoutAspectRatio(value: unknown): value is LayoutAspectRatio {
  return typeof value === "string" && ASPECT_RATIO_VALUES.includes(value as LayoutAspectRatio);
}

export function isLayoutPreset(value: unknown): value is LayoutPreset {
  return typeof value === "string" && LAYOUT_PRESET_VALUES.includes(value as LayoutPreset);
}

export function getAspectRatioValue(aspectRatio: LayoutAspectRatio, fallback = 9 / 16) {
  return ASPECT_RATIO_PRESETS[aspectRatio]?.ratio ?? fallback;
}

export function normalizeCropBox(value: unknown, fallback: LayoutCropBox = DEFAULT_CROP_BOX): LayoutCropBox {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const width = clamp(raw.width, 0.08, 1, fallback.width);
  const height = clamp(raw.height, 0.08, 1, fallback.height);
  const x = clamp(raw.x, 0, 1 - width, Math.min(fallback.x, 1 - width));
  const y = clamp(raw.y, 0, 1 - height, Math.min(fallback.y, 1 - height));

  return {
    x: round4(x),
    y: round4(y),
    width: round4(width),
    height: round4(height),
  };
}

export function buildCenteredCropBox(aspectRatio: LayoutAspectRatio, sourceAspectRatio = 16 / 9): LayoutCropBox {
  const targetRatio = getAspectRatioValue(aspectRatio, sourceAspectRatio);
  if (!Number.isFinite(targetRatio) || targetRatio <= 0 || !Number.isFinite(sourceAspectRatio) || sourceAspectRatio <= 0) {
    return DEFAULT_CROP_BOX;
  }

  if (Math.abs(sourceAspectRatio - targetRatio) < 0.02) {
    return DEFAULT_CROP_BOX;
  }

  if (sourceAspectRatio > targetRatio) {
    const width = targetRatio / sourceAspectRatio;
    return normalizeCropBox({ x: (1 - width) / 2, y: 0, width, height: 1 });
  }

  const height = sourceAspectRatio / targetRatio;
  return normalizeCropBox({ x: 0, y: (1 - height) / 2, width: 1, height });
}

export function normalizeClipLayoutConfig(value: unknown): ClipLayoutConfig {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const preset = isLayoutPreset(raw.preset) ? raw.preset : "center_crop";
  const aspectRatio = isLayoutAspectRatio(raw.aspectRatio) ? raw.aspectRatio : "9:16";
  const safeZones = raw.safeZones && typeof raw.safeZones === "object" ? (raw.safeZones as Record<string, unknown>) : {};
  const backgroundMode =
    raw.backgroundMode === "blur" || raw.backgroundMode === "letterbox" || raw.backgroundMode === "solid"
      ? raw.backgroundMode
      : "crop";

  return {
    preset,
    aspectRatio,
    cropBox: normalizeCropBox(raw.cropBox, buildCenteredCropBox(aspectRatio)),
    speakerRegion: raw.speakerRegion ? normalizeCropBox(raw.speakerRegion) : null,
    screenRegion: raw.screenRegion ? normalizeCropBox(raw.screenRegion) : null,
    backgroundMode,
    blurBackground: Boolean(raw.blurBackground),
    borderRadius: clamp(raw.borderRadius, 0, 48, 0),
    padding: clamp(raw.padding, 0, 120, 0),
    safeZones: {
      top: clamp(safeZones.top, 0, 0.35, DEFAULT_SAFE_ZONES.top),
      bottom: clamp(safeZones.bottom, 0, 0.35, DEFAULT_SAFE_ZONES.bottom),
      left: clamp(safeZones.left, 0, 0.25, DEFAULT_SAFE_ZONES.left),
      right: clamp(safeZones.right, 0, 0.25, DEFAULT_SAFE_ZONES.right),
    },
    reframeConfidence:
      raw.reframeConfidence === "high" || raw.reframeConfidence === "low" || raw.reframeConfidence === "medium"
        ? raw.reframeConfidence
        : LAYOUT_PRESETS[preset].confidence,
    reason:
      typeof raw.reason === "string" && raw.reason.trim()
        ? raw.reason.trim()
        : LAYOUT_PRESETS[preset].description,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export function extractLayoutConfigFromMetadata(viralityFactors: unknown): ClipLayoutConfig | null {
  const raw = viralityFactors && typeof viralityFactors === "object" ? (viralityFactors as Record<string, unknown>) : null;
  const metadata = raw?.metadata && typeof raw.metadata === "object" ? (raw.metadata as Record<string, unknown>) : null;
  return metadata?.layoutConfig ? normalizeClipLayoutConfig(metadata.layoutConfig) : null;
}

export function aspectRatioToClipOutputRatio(aspectRatio: number): ClipOutputRatio {
  if (Math.abs(aspectRatio - 1) < 0.08) return "1:1";
  if (Math.abs(aspectRatio - 4 / 5) < 0.08) return "4:5";
  if (aspectRatio > 1.25) return "16:9";
  return "9:16";
}

export function layoutConfigToReframePlan(config: ClipLayoutConfig | null | undefined, targetAspectRatio: number): ClipReframePlan | null {
  if (!config || config.aspectRatio === "original") {
    return null;
  }

  const cropBox = normalizeCropBox(config.cropBox, buildCenteredCropBox(config.aspectRatio));
  const ratio = aspectRatioToClipOutputRatio(targetAspectRatio);
  const mode: ClipReframePlan["mode"] =
    config.preset === "square_letterbox" || config.backgroundMode === "letterbox"
      ? "letterbox"
      : config.preset === "speaker_focus"
      ? "speaker_focus"
      : "center_crop";

  return {
    ratio,
    mode,
    anchor: config.preset === "speaker_focus" ? "speaker" : "center",
    confidence: config.reframeConfidence,
    safeZone: {
      x: round4(cropBox.x),
      y: round4(cropBox.y),
      width: round4(cropBox.width),
      height: round4(cropBox.height),
    },
    manualCropBox: mode === "letterbox" ? undefined : cropBox,
    reasoning: config.reason,
  };
}

function round4(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
