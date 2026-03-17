import {
  normalizeCaptionTimelineSegments,
  normalizeTranscriptEditRanges,
} from "@/lib/repurpose/transcript-sync";

describe("transcript-sync utilities", () => {
  describe("normalizeTranscriptEditRanges", () => {
    it("clamps, filters short ranges, and merges overlaps/gaps", () => {
      const ranges = normalizeTranscriptEditRanges(
        [
          { startMs: -120, endMs: 250 }, // clamp to clip start
          { startMs: 260, endMs: 320 }, // too short, removed
          { startMs: 400, endMs: 700 },
          { startMs: 760, endMs: 980 }, // merged with previous (gap <= 100ms)
          { startMs: 1500, endMs: 1400 }, // invalid after clamp
        ],
        100,
        2000
      );

      expect(ranges).toEqual([
        { startMs: 100, endMs: 250 },
        { startMs: 400, endMs: 980 },
      ]);
    });
  });

  describe("normalizeCaptionTimelineSegments", () => {
    it("normalizes to monotonic clip-relative caption timeline", () => {
      const normalized = normalizeCaptionTimelineSegments(
        [
          { startMs: -100, endMs: 90, text: "  hello   world  " },
          { startMs: 80, endMs: 120, text: "alpha" },
          { startMs: 118, endMs: 130, text: "beta" },
          { startMs: 130, endMs: 135, text: " " }, // empty dropped
        ],
        {
          clipDurationMs: 500,
          minDurationMs: 120,
        }
      );

      expect(normalized.length).toBe(3);
      expect(normalized[0]).toMatchObject({
        startMs: 0,
        endMs: 120,
        text: "hello world",
      });
      expect(normalized[1].startMs).toBeGreaterThanOrEqual(normalized[0].endMs);
      expect(normalized[1].endMs - normalized[1].startMs).toBeGreaterThanOrEqual(120);
      expect(normalized[2].startMs).toBeGreaterThanOrEqual(normalized[1].endMs);
      expect(normalized[2].endMs).toBeLessThanOrEqual(500);
    });
  });
});
