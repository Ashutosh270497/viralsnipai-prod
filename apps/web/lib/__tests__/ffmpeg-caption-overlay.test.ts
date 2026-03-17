import { buildCaptionOverlayFilterChain } from "@/lib/ffmpeg";
import { normalizeClipCaptionStyle } from "@/lib/repurpose/caption-style-config";

describe("buildCaptionOverlayFilterChain", () => {
  it("builds subtitle styling and timed hook overlays into one filter chain", () => {
    const style = normalizeClipCaptionStyle({
      fontFamily: "Inter",
      position: "bottom",
      hookOverlays: [
        {
          id: "hook-1",
          text: "This is the hook",
          startMs: 0,
          endMs: 2400,
          position: "top",
          align: "center",
          fontSize: 64,
          textColor: "#FFFFFF",
          backgroundColor: "#000000",
          backgroundOpacity: 0.55,
          bold: true,
          italic: false,
        },
      ],
    });

    const filter = buildCaptionOverlayFilterChain({
      preset: "shorts_9x16_1080",
      srtPath: "/tmp/test.srt",
      captionStyle: style,
    });

    expect(filter).toContain("subtitles='/tmp/test.srt'");
    expect(filter).toContain("force_style=");
    expect(filter).toContain("drawtext");
    expect(filter).toContain("between(t,0.00,2.40)");
    expect(filter).toContain("scale=1080:1920");
  });

  it("still builds overlay-only filters when captions are disabled", () => {
    const style = normalizeClipCaptionStyle({
      hookOverlays: [
        {
          id: "hook-1",
          text: "Overlay only",
          startMs: 500,
          endMs: 1500,
          position: "center",
          align: "left",
          fontSize: 58,
          textColor: "#FFFFFF",
          backgroundColor: "#111111",
          backgroundOpacity: 0.5,
          bold: true,
          italic: false,
        },
      ],
    });

    const filter = buildCaptionOverlayFilterChain({
      preset: "square_1x1_1080",
      captionStyle: style,
    });

    expect(filter).not.toContain("subtitles=");
    expect(filter).toContain("drawtext");
    expect(filter).toContain("scale=1080:1080");
  });
});
