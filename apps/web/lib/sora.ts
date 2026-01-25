import { randomUUID } from "crypto";

const API_KEY = process.env.OPENAI_API_KEY?.trim() ?? "";
const HAS_API_KEY = Boolean(API_KEY);
const MODEL = process.env.SORA_MODEL?.trim() || "sora-2";
const CUSTOM_ENDPOINT = process.env.SORA_API_URL?.trim();
const BETA_HEADER = process.env.SORA_BETA_HEADER?.trim();
const FALLBACK_TO_MOCK = parseBoolean(process.env.SORA_MOCK_ON_FAILURE ?? "true");

type ParsedVideo = {
  id?: string;
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  raw?: unknown;
};

export type SoraVideo = {
  id: string;
  prompt: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  createdAt: string;
  providerMetadata?: Record<string, unknown>;
};

export type SoraRequest = {
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
  referenceImage?: File | null;
  referenceVideo?: File | null;
};

type SoraEndpointError = {
  url: string;
  status?: number;
  body?: string;
  message?: string;
};

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function createMockVideo(request: SoraRequest, metadata?: Record<string, unknown>): SoraVideo {
  return {
    id: randomUUID(),
    prompt: request.prompt,
    videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnailUrl: "https://images.placeholders.dev/?width=720&height=1280&text=Sora+Preview",
    duration: Math.min(Math.max(request.durationSeconds ?? 10, 4), 60),
    createdAt: new Date().toISOString(),
    providerMetadata: { mock: true, model: MODEL, ...metadata }
  };
}

function buildCandidateEndpoints(): string[] {
  const defaults = [
    "https://api.openai.com/v1/videos",
    "https://api.openai.com/v1/video/generations",
    "https://api.openai.com/v1/videos/generate",
    "https://api.openai.com/v1/videos/generations"
  ];
  const candidates = CUSTOM_ENDPOINT ? [CUSTOM_ENDPOINT, ...defaults] : defaults;
  return Array.from(new Set(candidates));
}

function buildFormData(request: SoraRequest): FormData {
  const form = new FormData();
  form.append("model", MODEL);
  form.append("prompt", request.prompt);
  if (request.aspectRatio) {
    form.append("aspect_ratio", request.aspectRatio);
  }
  if (request.durationSeconds) {
    form.append("duration_seconds", String(request.durationSeconds));
  }
  if (request.referenceImage) {
    form.append("reference_image", request.referenceImage);
  }
  if (request.referenceVideo) {
    form.append("reference_video", request.referenceVideo);
  }
  return form;
}

function parseVideoPayload(payload: any): ParsedVideo | null {
  if (!payload) return null;

  const candidate =
    payload?.data?.[0] ??
    payload?.video ??
    payload?.videos?.[0] ??
    payload?.output?.[0] ??
    payload?.result;

  if (candidate) {
    const videoAsset =
      candidate?.video ??
      candidate?.asset ??
      candidate;

    const url =
      videoAsset?.url ??
      videoAsset?.video_url ??
      videoAsset?.download_url ??
      payload?.video_url;

    const thumbnail =
      videoAsset?.thumbnail ??
      videoAsset?.thumbnail_url ??
      payload?.thumbnail ??
      payload?.thumbnail_url ??
      candidate?.preview;

    const duration =
      videoAsset?.duration ??
      candidate?.duration ??
      payload?.duration;

    return {
      id: candidate?.id ?? videoAsset?.id,
      url,
      thumbnailUrl: thumbnail,
      duration,
      raw: payload
    };
  }

  return null;
}

async function postToEndpoint(endpoint: string, body: FormData) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_KEY}`
  };
  if (BETA_HEADER) {
    headers["OpenAI-Beta"] = BETA_HEADER;
  }
  return fetch(endpoint, {
    method: "POST",
    headers,
    body
  });
}

export async function generateSoraVideo(request: SoraRequest): Promise<SoraVideo> {
  if (!HAS_API_KEY) {
    return createMockVideo(request, { reason: "missing_api_key" });
  }

  const endpoints = buildCandidateEndpoints();
  const failedAttempts: SoraEndpointError[] = [];

  for (const endpoint of endpoints) {
    try {
      const response = await postToEndpoint(endpoint, buildFormData(request));
      if (!response.ok) {
        const body = await response.text();
        failedAttempts.push({ url: endpoint, status: response.status, body });
        if (response.status === 404 || response.status === 405 || response.status === 501) {
          continue;
        }
        throw new Error(`Sora API error (${response.status}) at ${endpoint}: ${body.slice(0, 400)}`);
      }

      const payload = await response.json();
      const parsed = parseVideoPayload(payload);
      if (!parsed || !parsed.url) {
        throw new Error(`Sora response missing video data from ${endpoint}`);
      }

      return {
        id: parsed.id ?? randomUUID(),
        prompt: request.prompt,
        videoUrl: parsed.url,
        thumbnailUrl: parsed.thumbnailUrl ?? "https://images.placeholders.dev/?width=720&height=1280&text=Sora+Preview",
        duration: parsed.duration ?? Math.min(Math.max(request.durationSeconds ?? 10, 4), 60),
        createdAt: new Date().toISOString(),
        providerMetadata: typeof parsed.raw === "object" ? (parsed.raw as Record<string, unknown>) : undefined
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedAttempts.push({ url: endpoint, message });
    }
  }

  if (FALLBACK_TO_MOCK) {
    if (failedAttempts.length > 0) {
      console.warn("[Sora]", "Falling back to mock video.", {
        reason: "all_endpoints_failed",
        attempts: failedAttempts
      });
    }
    return createMockVideo(request, {
      reason: "fallback_after_failure",
      attempts: failedAttempts.slice(0, 3)
    });
  }

  const [primaryError] = failedAttempts;
  const serialized = failedAttempts
    .map((attempt) => `${attempt.url} → ${attempt.status ?? ""} ${attempt.message ?? ""}`.trim())
    .join("; ");
  const message =
    primaryError?.message ??
    `Unable to reach Sora endpoint(s). Attempts: ${serialized || "unknown error"}`;
  throw new Error(message);
}
