import { resolveTranscriptEditRanges } from "@/lib/repurpose/transcript-edit-ranges";

describe("resolveTranscriptEditRanges", () => {
  it("returns empty list when metadata is missing", () => {
    expect(resolveTranscriptEditRanges(null, 1_000, 5_000)).toEqual([]);
    expect(resolveTranscriptEditRanges({}, 1_000, 5_000)).toEqual([]);
  });

  it("clamps ranges to clip boundaries and merges near-overlapping ranges", () => {
    const viralityFactors = {
      metadata: {
        transcriptEditRangesMs: [
          { startMs: 500, endMs: 1_300 }, // clamps to 1000-1300
          { startMs: 1_350, endMs: 1_800 }, // merges with previous due 100ms gap rule
          { startMs: 3_200, endMs: 3_700 },
      { startMs: 4_900, endMs: 5_800 }, // clamps to 4900-5000, then dropped (<150ms)
      { startMs: 4_950, endMs: 4_980 }, // dropped (<150ms)
        ],
      },
    };

    expect(resolveTranscriptEditRanges(viralityFactors, 1_000, 5_000)).toEqual([
      { startMs: 1_000, endMs: 1_800 },
      { startMs: 3_200, endMs: 3_700 },
    ]);
  });
});
