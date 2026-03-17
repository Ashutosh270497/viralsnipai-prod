export type UploadStorageDriver = "local" | "s3";

export interface HookGenerationPayload {
  topic: string;
  sourceUrl?: string;
  audience?: string;
  tone?: string;
  projectId?: string;
}

export interface ScriptGenerationPayload {
  hook: string;
  audience?: string;
  tone?: string;
  durationSec?: number;
  projectId: string;
}

export interface HighlightGenerationPayload {
  assetId: string;
  strategy?: string;
  target?: number;
}

export interface CaptionGenerationPayload {
  clipId: string;
}

export interface ExportPresetConfig {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
}

export const EXPORT_PRESETS: ExportPresetConfig[] = [
  {
    id: "shorts_9x16_1080",
    label: "Vertical Shorts (1080x1920)",
    description: "Optimized for TikTok/Reels/Shorts",
    width: 1080,
    height: 1920
  },
  {
    id: "square_1x1_1080",
    label: "Square (1080x1080)",
    description: "Great for Instagram feed",
    width: 1080,
    height: 1080
  },
  {
    id: "portrait_4x5_1080",
    label: "Portrait Feed (1080x1350)",
    description: "Great for Instagram/Facebook feed posts",
    width: 1080,
    height: 1350
  },
  {
    id: "landscape_16x9_1080",
    label: "Landscape (1920x1080)",
    description: "Full HD landscape export",
    width: 1920,
    height: 1080
  }
];

export interface HighlightSuggestion {
  title: string;
  hook: string;
  startPercent: number;
  endPercent: number;
  callToAction?: string;
}
