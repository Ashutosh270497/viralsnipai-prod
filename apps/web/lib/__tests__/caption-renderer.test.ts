jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { FfmpegStaticCaptionRenderer, createCaptionRenderer } from "@/lib/captions/caption-renderer";
import { DEFAULT_CLIP_CAPTION_STYLE } from "@/lib/repurpose/caption-style-config";
import type { SmartReframePlan } from "@/lib/media/smart-reframe";

const reframePlan: SmartReframePlan = {
  strategy: "center_crop",
  mode: "stable",
  confidence: 0,
  sourceWidth: 1920,
  sourceHeight: 1080,
  targetWidth: 1080,
  targetHeight: 1920,
  cropWindow: { x: 656, y: 0, width: 608, height: 1080 },
  subjectCenterNormalized: { x: 0.5, y: 0.5 },
  safeZone: { topPct: 0.08, bottomPct: 0.18, leftPct: 0.08, rightPct: 0.08, preferredCaptionY: "lower_third" },
  sampledFrames: 0,
  faceDetections: 0,
  personDetections: 0,
  analyzedAt: new Date(0).toISOString(),
};

describe("FfmpegStaticCaptionRenderer", () => {
  it("warns and falls back when animation is unsupported by ffmpeg_static", async () => {
    const renderer = new FfmpegStaticCaptionRenderer();
    const result = await renderer.renderCaptions({
      sourcePath: "/tmp/source.mp4",
      outputPath: "/tmp/out.mp4",
      captions: [{ index: 1, startMs: 0, endMs: 1000, text: "Hello world" }],
      captionStyle: {
        ...DEFAULT_CLIP_CAPTION_STYLE,
        animation: { type: "bounce", wordHighlight: true, speed: "normal" },
      },
      reframePlan,
      exportQuality: "balanced",
    });

    expect(result.renderer).toBe("ffmpeg_static");
    expect(result.warnings[0]).toContain("static caption fallback");
  });

  it("returns ffmpeg_static when animated renderer is requested but not enabled", () => {
    expect(createCaptionRenderer("remotion_animated").kind).toBe("ffmpeg_static");
  });
});
