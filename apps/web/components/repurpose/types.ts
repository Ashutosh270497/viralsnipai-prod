import type { ClipReviewStatus, ViralityFactors } from "@/lib/types";
import type { ClipCaptionStyleConfig } from "@/lib/repurpose/caption-style-config";
import type { ClipEnhancement } from "@/lib/repurpose/creative-enhancements";

export interface ProjectSummary {
  id: string;
  title: string;
}

export interface ProjectAsset {
  id: string;
  path: string;
  type: "audio" | "video" | string;
  durationSec?: number | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  transcript?: string | null;
  sourceLanguage?: string;
  createdAt: string;
  storagePath?: string;
}

export interface ProjectClip {
  id: string;
  assetId?: string | null;
  startMs: number;
  endMs: number;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
  previewPath?: string | null;
  thumbnail?: string | null;
  viralityScore?: number | null;
  viralityFactors?: ViralityFactors | null;
  enhancements?: ClipEnhancement[];
  version: number;
  reviewStatus?: ClipReviewStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectExport {
  id: string;
  userId?: string | null;
  clipIds?: string[];
  preset: string;
  includeCaptions?: boolean;
  status: string;
  progress?: number | null;
  phase?: string | null;
  outputFormat?: string | null;
  platformPreset?: string | null;
  aspectRatio?: string | null;
  captionTrackId?: string | null;
  layoutPreset?: string | null;
  outputPath?: string;
  storagePath?: string;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectDetail {
  id: string;
  title: string;
  topic?: string | null;
  status?: "ready" | "ingesting" | "exporting" | "failed" | string;
  assets: ProjectAsset[];
  clips: ProjectClip[];
  exports: ProjectExport[];
}
