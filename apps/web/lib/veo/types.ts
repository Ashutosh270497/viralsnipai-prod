import { randomUUID } from "crypto";

export type VeoAspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export type VeoRequest = {
  prompt: string;
  aspectRatio?: VeoAspectRatio;
  durationSeconds?: number;
  stylePreset?: string;
  negativePrompt?: string;
  sampleCount?: number;
  addWatermark?: boolean;
  includeRaiReason?: boolean;
  generateAudio?: boolean;
  personGeneration?: string;
  resolution?: string;
};

export type VeoVideo = {
  id: string;
  prompt: string;
  videoUrl: string;
  thumbnailUrl: string;
  providerMetadata?: Record<string, unknown>;
};

export type VeoHighlight = {
  title: string;
  hook: string;
  startPercent: number;
  endPercent: number;
  callToAction?: string;
};

export function createMockVideo(request: VeoRequest): VeoVideo {
  const id = randomUUID();
  const encodedPrompt = encodeURIComponent(request.prompt.slice(0, 80) || "veo");
  return {
    id,
    prompt: request.prompt,
    videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnailUrl: `https://images.placeholders.dev/?width=640&height=360&text=${encodedPrompt}`,
    providerMetadata: { mock: true }
  };
}
