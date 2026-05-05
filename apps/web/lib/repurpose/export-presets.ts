export type ExportOutputType = "mp4" | "srt" | "vtt" | "thumbnail" | "zip";

export type PlatformExportPresetId =
  | "youtube_shorts"
  | "instagram_reels"
  | "tiktok"
  | "x_video"
  | "linkedin"
  | "square_feed"
  | "landscape_youtube";

export interface PlatformExportPreset {
  id: PlatformExportPresetId;
  label: string;
  description: string;
  legacyPreset: "shorts_9x16_1080" | "square_1x1_1080" | "portrait_4x5_1080" | "landscape_16x9_1080";
  aspectRatio: "9:16" | "1:1" | "4:5" | "16:9";
  width: number;
  height: number;
  maxDurationSec: number;
  captionSafeZone: {
    topPct: number;
    bottomPct: number;
    leftPct: number;
    rightPct: number;
  };
  bitrateKbps: number;
  fileNamePrefix: string;
  thumbnailRequired: boolean;
}

export const PLATFORM_EXPORT_PRESETS: Record<PlatformExportPresetId, PlatformExportPreset> = {
  youtube_shorts: {
    id: "youtube_shorts",
    label: "YouTube Shorts",
    description: "Vertical 1080x1920 export for Shorts.",
    legacyPreset: "shorts_9x16_1080",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    maxDurationSec: 60,
    captionSafeZone: { topPct: 0.1, bottomPct: 0.22, leftPct: 0.08, rightPct: 0.08 },
    bitrateKbps: 8000,
    fileNamePrefix: "youtube-shorts",
    thumbnailRequired: true,
  },
  instagram_reels: {
    id: "instagram_reels",
    label: "Instagram Reels",
    description: "Vertical Reels export with caption-safe lower area.",
    legacyPreset: "shorts_9x16_1080",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    maxDurationSec: 90,
    captionSafeZone: { topPct: 0.12, bottomPct: 0.24, leftPct: 0.08, rightPct: 0.08 },
    bitrateKbps: 8000,
    fileNamePrefix: "instagram-reels",
    thumbnailRequired: true,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    description: "Vertical TikTok export with aggressive UI-safe margins.",
    legacyPreset: "shorts_9x16_1080",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    maxDurationSec: 60,
    captionSafeZone: { topPct: 0.14, bottomPct: 0.28, leftPct: 0.1, rightPct: 0.12 },
    bitrateKbps: 9000,
    fileNamePrefix: "tiktok",
    thumbnailRequired: false,
  },
  x_video: {
    id: "x_video",
    label: "X Video",
    description: "Landscape 1080p export for X posts.",
    legacyPreset: "landscape_16x9_1080",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    maxDurationSec: 140,
    captionSafeZone: { topPct: 0.08, bottomPct: 0.16, leftPct: 0.05, rightPct: 0.05 },
    bitrateKbps: 10000,
    fileNamePrefix: "x-video",
    thumbnailRequired: true,
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    description: "Portrait feed export for LinkedIn thought leadership clips.",
    legacyPreset: "portrait_4x5_1080",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    maxDurationSec: 120,
    captionSafeZone: { topPct: 0.1, bottomPct: 0.18, leftPct: 0.08, rightPct: 0.08 },
    bitrateKbps: 8000,
    fileNamePrefix: "linkedin",
    thumbnailRequired: true,
  },
  square_feed: {
    id: "square_feed",
    label: "Square Feed",
    description: "Square 1080x1080 export for feeds and carousels.",
    legacyPreset: "square_1x1_1080",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    maxDurationSec: 90,
    captionSafeZone: { topPct: 0.1, bottomPct: 0.18, leftPct: 0.08, rightPct: 0.08 },
    bitrateKbps: 7000,
    fileNamePrefix: "square-feed",
    thumbnailRequired: true,
  },
  landscape_youtube: {
    id: "landscape_youtube",
    label: "Landscape YouTube",
    description: "Full HD landscape export for YouTube or website embeds.",
    legacyPreset: "landscape_16x9_1080",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    maxDurationSec: 600,
    captionSafeZone: { topPct: 0.08, bottomPct: 0.16, leftPct: 0.05, rightPct: 0.05 },
    bitrateKbps: 12000,
    fileNamePrefix: "youtube-landscape",
    thumbnailRequired: true,
  },
};

export const PLATFORM_EXPORT_PRESET_VALUES = [
  "youtube_shorts",
  "instagram_reels",
  "tiktok",
  "x_video",
  "linkedin",
  "square_feed",
  "landscape_youtube",
] as const satisfies readonly PlatformExportPresetId[];

export function resolvePlatformExportPreset(value?: string | null) {
  if (value && value in PLATFORM_EXPORT_PRESETS) {
    return PLATFORM_EXPORT_PRESETS[value as PlatformExportPresetId];
  }
  return PLATFORM_EXPORT_PRESETS.youtube_shorts;
}

export function isExportOutputType(value: unknown): value is ExportOutputType {
  return value === "mp4" || value === "srt" || value === "vtt" || value === "thumbnail" || value === "zip";
}
