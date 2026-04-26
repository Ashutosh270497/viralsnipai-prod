import {
  DEFAULT_CLIP_CAPTION_STYLE,
  createDefaultHookOverlay,
  normalizeClipCaptionStyle,
} from "@/lib/repurpose/caption-style-config";

describe("normalizeClipCaptionStyle", () => {
  it("returns defaults for missing input", () => {
    expect(normalizeClipCaptionStyle(null)).toEqual(DEFAULT_CLIP_CAPTION_STYLE);
  });

  it("normalizes overlays and strips invalid entries", () => {
    const style = normalizeClipCaptionStyle({
      presetId: "viral",
      fontSize: 120,
      hookOverlays: [
        {
          id: "hook-1",
          text: "Launch now",
          startMs: -100,
          endMs: 1800,
          position: "top",
          align: "center",
          fontSize: 60,
          textColor: "#fff",
          backgroundColor: "#000000",
          backgroundOpacity: 0.6,
          bold: true,
          italic: false,
        },
        {
          id: "hook-2",
          text: "   ",
        },
      ],
    });

    expect(style.presetId).toBe("viral");
    expect(style.fontSize).toBe(96);
    expect(style.hookOverlays).toHaveLength(1);
    expect(style.hookOverlays[0].startMs).toBe(0);
    expect(style.hookOverlays[0].textColor).toBe("#FFFFFF");
  });

  it("creates default hook overlay with sane timings", () => {
    const overlay = createDefaultHookOverlay({ text: "Test hook" });
    expect(overlay.text).toBe("Test hook");
    expect(overlay.endMs).toBeGreaterThan(overlay.startMs);
  });

  it("normalizes animation config without changing editable caption text", () => {
    const style = normalizeClipCaptionStyle({
      animation: { type: "bounce", wordHighlight: true, speed: "fast" },
      maxWordsPerLine: 5,
      safeZoneAware: false,
    });

    expect(style.animation).toEqual({ type: "bounce", wordHighlight: true, speed: "fast" });
    expect(style.maxWordsPerLine).toBe(5);
    expect(style.safeZoneAware).toBe(false);
  });

  it("maps legacy karaoke toggle into animation config", () => {
    const style = normalizeClipCaptionStyle({ karaoke: true });
    expect(style.animation.type).toBe("karaoke");
    expect(style.animation.wordHighlight).toBe(true);
  });
});
