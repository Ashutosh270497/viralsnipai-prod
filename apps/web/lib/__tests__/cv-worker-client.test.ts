import {
  detectClipWithCvWorker,
  detectScenesWithCvWorker,
  getCvWorkerHealth,
  trackSubjectWithCvWorker,
} from "@/lib/media/cv-worker-client";

describe("cv-worker-client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns unconfigured when no worker URL is set", async () => {
    const result = await getCvWorkerHealth({ baseUrl: null });
    expect(result.status).toBe("unconfigured");
    expect(result.configured).toBe(false);
  });

  it("returns health payload when the worker responds", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "healthy",
        service: "viralsnipai-cv-worker",
        version: "0.1.0",
        dependencies: {
          ffmpeg: { available: true, version: "ffmpeg version test" },
        },
        models: {
          face: "mediapipe-face-detector",
          person: "yolo-onnx",
          scene: "pyscenedetect",
        },
      }),
    } as Response);

    const result = await getCvWorkerHealth({ baseUrl: "http://localhost:8010" });
    expect(result.status).toBe("healthy");
    expect(result.health?.service).toBe("viralsnipai-cv-worker");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8010/health",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  it("returns unreachable on fetch failure", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("connection refused"));
    const result = await getCvWorkerHealth({ baseUrl: "http://localhost:8010" });
    expect(result.status).toBe("unreachable");
    expect(result.error).toContain("connection refused");
  });

  it("posts clip detection requests to the worker", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        frames: [{ timeMs: 0, faces: [], persons: [] }],
        provider: "mediapipe+opencv-hog",
        sampledFrames: 1,
        modelVersions: { face: "mediapipe-face-detector", person: "yolo-onnx" },
      }),
    } as Response);

    const result = await detectClipWithCvWorker(
      {
        sourcePath: "/tmp/video.mp4",
        clipStartMs: 0,
        clipEndMs: 1000,
      },
      { baseUrl: "http://localhost:8010" }
    );

    expect(result?.sampledFrames).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8010/detect/clip",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
  });

  it("posts scene detection requests to the worker", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ cutsMs: [500, 1200], provider: "pyscenedetect" }),
    } as Response);

    const result = await detectScenesWithCvWorker(
      { sourcePath: "/tmp/video.mp4" },
      { baseUrl: "http://localhost:8010" }
    );

    expect(result?.cutsMs).toEqual([500, 1200]);
  });

  it("posts subject tracking requests to the worker", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cropPath: [{ timeMs: 0, x: 0, y: 0, width: 608, height: 1080, confidence: 0.9, detectionType: "face" }],
        strategy: "face_tracking",
        confidence: 0.72,
        provider: "nearest-center",
        sampledFrames: 1,
        faceDetections: 1,
        personDetections: 0,
        primaryTrackLength: 1,
      }),
    } as Response);

    const result = await trackSubjectWithCvWorker(
      {
        sourcePath: "/tmp/video.mp4",
        clipStartMs: 0,
        clipEndMs: 1000,
        targetWidth: 1080,
        targetHeight: 1920,
        detections: [{ timeMs: 0, faces: [], persons: [] }],
      },
      { baseUrl: "http://localhost:8010" }
    );

    expect(result?.strategy).toBe("face_tracking");
    expect(result?.cropPath).toHaveLength(1);
  });
});
