import {
  MEDIA_RUNTIME_PROFILE,
  getMediaRuntimeProfile,
  getMediaRuntimeRiskSummary,
} from "@/lib/platform/media-processing-runtime";

describe("media processing runtime profile", () => {
  it("documents the current and target execution modes", () => {
    expect(getMediaRuntimeProfile().currentMode).toBe("in_process_web_runtime");
    expect(MEDIA_RUNTIME_PROFILE.targetMode).toBe("dedicated_worker_target");
  });

  it("tracks the current FFmpeg-backed job entrypoints", () => {
    expect(MEDIA_RUNTIME_PROFILE.currentEntrypoints).toEqual(
      expect.arrayContaining([
        "apps/web/lib/render-queue.ts",
        "apps/web/lib/youtube-ingest-queue.ts",
        "apps/web/lib/voice-translation-queue.ts",
      ])
    );
  });

  it("summarizes known runtime risks", () => {
    expect(getMediaRuntimeRiskSummary()).toContain("FFmpeg");
    expect(MEDIA_RUNTIME_PROFILE.persistentStorageRequired).toBe(true);
  });
});
