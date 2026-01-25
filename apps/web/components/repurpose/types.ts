export interface ProjectSummary {
  id: string;
  title: string;
}

export interface ProjectAsset {
  id: string;
  path: string;
  type: string;
  durationSec?: number | null;
  transcript?: string | null;
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
  previewPath?: string | null;
}

export interface ProjectExport {
  id: string;
  preset: string;
  status: string;
}

export interface ProjectDetail {
  id: string;
  title: string;
  topic?: string | null;
  assets: ProjectAsset[];
  clips: ProjectClip[];
  exports: ProjectExport[];
}
