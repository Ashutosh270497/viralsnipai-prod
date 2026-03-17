import type { ViralityFactors } from "@/lib/types";
import type { ClipCaptionStyleConfig } from "@/lib/repurpose/caption-style-config";

export interface ProjectSummary {
  id: string;
  title: string;
}

export interface ProjectAsset {
  id: string;
  path: string;
  type: "audio" | "video" | string;
  durationSec?: number | null;
  transcript?: string | null;
  sourceLanguage?: string;
  createdAt: string;
  storagePath?: string;
}

export interface ProjectClip {
  id: string;
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
}

export interface ProjectExport {
  id: string;
  clipIds?: string[];
  preset: string;
  includeCaptions?: boolean;
  status: string;
  outputPath?: string;
  storagePath?: string;
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectDetail {
  id: string;
  title: string;
  topic?: string | null;
  assets: ProjectAsset[];
  clips: ProjectClip[];
  exports: ProjectExport[];
}
