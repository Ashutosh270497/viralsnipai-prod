export type CvWorkerStatus = "healthy" | "degraded" | "unconfigured" | "unreachable";

export type CvWorkerDependencyStatus = {
  available: boolean;
  version?: string | null;
};

export type CvWorkerHealth = {
  status: "healthy" | "degraded";
  service: string;
  version: string;
  dependencies: Record<string, CvWorkerDependencyStatus>;
  models: Record<string, string | null>;
};

export type CvWorkerHealthResult = {
  configured: boolean;
  status: CvWorkerStatus;
  url: string | null;
  latencyMs?: number;
  health?: CvWorkerHealth;
  error?: string;
};

export type CvDetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: "face" | "person" | "subject";
};

export type CvFrameDetections = {
  timeMs: number;
  faces: CvDetectionBox[];
  persons: CvDetectionBox[];
};

export type CvClipDetectionResponse = {
  frames: CvFrameDetections[];
  provider: string;
  sampledFrames: number;
  modelVersions: Record<string, string | null>;
  fallbackReason?: string | null;
};

export type CvSceneDetectionResponse = {
  cutsMs: number[];
  provider: string;
  fallbackReason?: string | null;
};

export type CvCropKeyframe = {
  timeMs: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  detectionType: "face" | "person" | "interpolated" | "fallback";
};

export type CvTrackSubjectResponse = {
  cropPath: CvCropKeyframe[];
  strategy: "face_tracking" | "person_tracking" | "center_crop";
  confidence: number;
  provider: string;
  sampledFrames: number;
  faceDetections: number;
  personDetections: number;
  primaryTrackLength: number;
  interpolatedKeyframes?: number;
  fallbackKeyframes?: number;
  fallbackReason?: string | null;
};

export function getCvWorkerBaseUrl() {
  const raw = process.env.CV_WORKER_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

function createTimeoutSignal(timeoutMs: number) {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);
  return { signal: abortController.signal, clear: () => clearTimeout(timer) };
}

async function postCvWorker<TResponse>(
  path: string,
  body: unknown,
  options?: {
    timeoutMs?: number;
    baseUrl?: string | null;
  }
): Promise<TResponse | null> {
  const baseUrl = options?.baseUrl ?? getCvWorkerBaseUrl();
  if (!baseUrl) return null;

  const timeout = createTimeoutSignal(options?.timeoutMs ?? 30_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: timeout.signal,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      throw new Error(`CV worker ${path} returned HTTP ${response.status}`);
    }
    return payload as TResponse;
  } finally {
    timeout.clear();
  }
}

export async function getCvWorkerHealth(options?: {
  timeoutMs?: number;
  baseUrl?: string | null;
}): Promise<CvWorkerHealthResult> {
  const baseUrl = options?.baseUrl ?? getCvWorkerBaseUrl();
  if (!baseUrl) {
    return {
      configured: false,
      status: "unconfigured",
      url: null,
    };
  }

  const startedAt = Date.now();
  const timeoutMs = options?.timeoutMs ?? 2_500;
  const timeout = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      cache: "no-store",
      signal: timeout.signal,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      return {
        configured: true,
        status: "unreachable",
        url: baseUrl,
        latencyMs: Date.now() - startedAt,
        error: `CV worker health returned HTTP ${response.status}`,
      };
    }

    const health = payload as CvWorkerHealth;
    return {
      configured: true,
      status: health.status,
      url: baseUrl,
      latencyMs: Date.now() - startedAt,
      health,
    };
  } catch (error) {
    return {
      configured: true,
      status: "unreachable",
      url: baseUrl,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    timeout.clear();
  }
}

export async function detectClipWithCvWorker(
  input: {
    sourcePath: string;
    clipStartMs: number;
    clipEndMs: number;
    sampleIntervalMs?: number;
    maxFrames?: number;
    detectFaces?: boolean;
    detectPersons?: boolean;
  },
  options?: { timeoutMs?: number; baseUrl?: string | null }
): Promise<CvClipDetectionResponse | null> {
  return postCvWorker<CvClipDetectionResponse>("/detect/clip", input, options);
}

export async function detectScenesWithCvWorker(
  input: {
    sourcePath: string;
    threshold?: number;
    maxCuts?: number;
  },
  options?: { timeoutMs?: number; baseUrl?: string | null }
): Promise<CvSceneDetectionResponse | null> {
  return postCvWorker<CvSceneDetectionResponse>("/scene-detect", input, options);
}

export async function trackSubjectWithCvWorker(
  input: {
    sourcePath: string;
    clipStartMs: number;
    clipEndMs: number;
    targetWidth: number;
    targetHeight: number;
    sourceWidth?: number;
    sourceHeight?: number;
    mode?: "dynamic_auto" | "dynamic_face" | "dynamic_person";
    smoothness?: "low" | "medium" | "high";
    subjectPosition?: "center" | "slightly_up" | "slightly_down";
    detections: CvFrameDetections[];
  },
  options?: { timeoutMs?: number; baseUrl?: string | null }
): Promise<CvTrackSubjectResponse | null> {
  return postCvWorker<CvTrackSubjectResponse>("/track-subject", input, options);
}
