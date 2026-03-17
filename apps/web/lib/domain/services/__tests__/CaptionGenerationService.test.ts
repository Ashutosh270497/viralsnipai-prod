import { CaptionGenerationService } from "../CaptionGenerationService";
import { srtUtils } from "@/lib/srt-utils";

describe("CaptionGenerationService", () => {
  let service: CaptionGenerationService;

  beforeEach(() => {
    service = new CaptionGenerationService();
  });

  it("generates usable captions for plain-text transcripts on clips with non-zero start", async () => {
    const transcript = [
      "AI customer support can reduce response time dramatically.",
      "But if you remove human escalation paths, trust drops fast.",
      "The best teams combine automation with clear human handoff.",
    ].join(" ");

    const clipStartMs = 149_000;
    const clipEndMs = 194_000;

    const srt = await service.generateSRT(clipStartMs, clipEndMs, transcript, {
      maxWordsPerCaption: 4,
      maxDurationMs: 2000,
    });

    expect(srt).not.toContain("[Generated content]");
    expect(srt).not.toContain("Captions unavailable");

    const entries = srtUtils.parseSRT(srt);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].startMs).toBeGreaterThanOrEqual(0);
    expect(entries[entries.length - 1].endMs).toBeLessThanOrEqual(clipEndMs - clipStartMs);
    expect(entries.some((entry) => entry.text.trim().length > 0)).toBe(true);
  });

  it("sanitizes malformed transcript segments before building SRT", async () => {
    const transcript = JSON.stringify({
      segments: [
        { id: 1, start: 0, end: 0, text: "   " },
        { id: 2, start: 0.1, end: 0.12, text: "hello" },
        { id: 3, start: 0.11, end: 0.2, text: "world" },
        { id: 4, start: 0.21, end: 0.24, text: "short" },
        { id: 5, start: 0.24, end: 1.8, text: "this is the meaningful line" },
      ],
    });

    const srt = await service.generateSRT(0, 2_000, transcript, {
      maxWordsPerCaption: 2,
      maxDurationMs: 1_000,
    });

    const entries = srtUtils.parseSRT(srt);
    expect(entries.length).toBeGreaterThan(0);

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      expect(entry.text.trim().length).toBeGreaterThan(0);
      expect(entry.endMs).toBeGreaterThan(entry.startMs);
      if (i > 0) {
        expect(entry.startMs).toBeGreaterThanOrEqual(entries[i - 1].endMs);
      }
    }
  });

  it("returns clear fallback captions when nothing overlaps clip range", async () => {
    const transcript = JSON.stringify({
      segments: [{ id: 1, start: 50, end: 55, text: "outside clip window" }],
    });

    const srt = await service.generateSRT(0, 5_000, transcript);
    expect(srt).toContain("[Transcript unavailable]");
    expect(srt).toContain("[Regenerate captions for editable transcript]");
  });
});
