import { detectRepurposeSceneCuts } from "../scene-detection";
import { detectSceneChanges } from "@/lib/ffmpeg";
import { detectScenesWithCvWorker, getCvWorkerBaseUrl } from "@/lib/media/cv-worker-client";

jest.mock("@/lib/ffmpeg", () => ({
  detectSceneChanges: jest.fn(),
}));

jest.mock("@/lib/media/cv-worker-client", () => ({
  detectScenesWithCvWorker: jest.fn(),
  getCvWorkerBaseUrl: jest.fn(),
}));

describe("detectRepurposeSceneCuts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses CV worker scene cuts when configured and successful", async () => {
    (getCvWorkerBaseUrl as jest.Mock).mockReturnValue("http://localhost:8010");
    (detectScenesWithCvWorker as jest.Mock).mockResolvedValue({
      cutsMs: [1200, 400, 1200],
      provider: "pyscenedetect",
    });

    const result = await detectRepurposeSceneCuts({ inputPath: "/tmp/video.mp4", maxCuts: 10 });

    expect(result).toMatchObject({
      cutsMs: [400, 1200],
      provider: "cv-worker",
      cvProvider: "pyscenedetect",
    });
    expect(detectSceneChanges).not.toHaveBeenCalled();
  });

  it("falls back to FFmpeg when CV worker returns no cuts", async () => {
    (getCvWorkerBaseUrl as jest.Mock).mockReturnValue("http://localhost:8010");
    (detectScenesWithCvWorker as jest.Mock).mockResolvedValue({
      cutsMs: [],
      provider: "ffmpeg-scene",
      fallbackReason: "No scene cuts found.",
    });
    (detectSceneChanges as jest.Mock).mockResolvedValue([3000, 1000]);

    const result = await detectRepurposeSceneCuts({ inputPath: "/tmp/video.mp4", maxCuts: 10 });

    expect(result).toMatchObject({
      cutsMs: [1000, 3000],
      provider: "ffmpeg",
    });
  });

  it("falls back to FFmpeg when CV worker throws", async () => {
    (getCvWorkerBaseUrl as jest.Mock).mockReturnValue("http://localhost:8010");
    (detectScenesWithCvWorker as jest.Mock).mockRejectedValue(new Error("worker unavailable"));
    (detectSceneChanges as jest.Mock).mockResolvedValue([2500]);

    const result = await detectRepurposeSceneCuts({ inputPath: "/tmp/video.mp4", maxCuts: 10 });

    expect(result).toMatchObject({
      cutsMs: [2500],
      provider: "ffmpeg",
    });
  });

  it("uses FFmpeg directly when CV worker is not configured", async () => {
    (getCvWorkerBaseUrl as jest.Mock).mockReturnValue(null);
    (detectSceneChanges as jest.Mock).mockResolvedValue([500]);

    const result = await detectRepurposeSceneCuts({ inputPath: "/tmp/video.mp4", maxCuts: 10 });

    expect(result).toMatchObject({
      cutsMs: [500],
      provider: "ffmpeg",
    });
    expect(detectScenesWithCvWorker).not.toHaveBeenCalled();
  });
});
