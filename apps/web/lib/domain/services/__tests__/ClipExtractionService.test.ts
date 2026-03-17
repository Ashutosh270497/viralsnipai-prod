import { ClipExtractionService } from "../ClipExtractionService";

describe("ClipExtractionService", () => {
  let service: ClipExtractionService;

  beforeEach(() => {
    service = new ClipExtractionService();
  });

  const transcription = {
    text: "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa",
    segments: [
      {
        start: 0,
        end: 6,
        text: "alpha bravo charlie delta",
        words: [
          { word: "alpha", start: 0.0, end: 0.6 },
          { word: "bravo", start: 0.8, end: 1.4 },
          { word: "charlie", start: 1.6, end: 2.2 },
          { word: "delta", start: 2.4, end: 3.0 },
        ],
      },
      {
        start: 6,
        end: 18,
        text: "echo foxtrot golf hotel india juliet kilo lima",
        words: [
          { word: "echo", start: 6.0, end: 6.4 },
          { word: "foxtrot", start: 6.6, end: 7.2 },
          { word: "golf", start: 7.5, end: 8.0 },
          { word: "hotel", start: 8.3, end: 8.9 },
          { word: "india", start: 9.1, end: 9.7 },
          { word: "juliet", start: 10.0, end: 10.5 },
          { word: "kilo", start: 11.0, end: 11.5 },
          { word: "lima", start: 12.0, end: 12.6 },
        ],
      },
      {
        start: 18,
        end: 30,
        text: "mike november oscar papa",
        words: [
          { word: "mike", start: 18.0, end: 18.5 },
          { word: "november", start: 19.0, end: 19.7 },
          { word: "oscar", start: 20.2, end: 20.8 },
          { word: "papa", start: 21.2, end: 21.8 },
        ],
      },
    ],
  };

  it("extracts clips from percent-based suggestions", () => {
    const result = service.extractClips(
      [
        {
          title: "Main clip",
          hook: "Strong opening",
          startPercent: 20,
          endPercent: 45,
        },
      ],
      30_000,
      transcription,
      {
        minDurationMs: 5_000,
        maxDurationMs: 12_000,
        minClipCount: 1,
        targetClipCount: 1,
      }
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Main clip");
    expect(result[0].startMs).toBeGreaterThanOrEqual(0);
    expect(result[0].endMs).toBeLessThanOrEqual(30_000);
    expect(result[0].qualitySignals?.overallScore).toBeGreaterThan(0);
  });

  it("prefers the stronger overlapping clip during deduplication", () => {
    const result = service.extractClips(
      [
        {
          title: "Weak overlap",
          hook: "Sparse setup",
          startPercent: 15,
          endPercent: 17,
        },
        {
          title: "Strong overlap",
          hook: "Better aligned window",
          startPercent: 16,
          endPercent: 40,
        },
      ],
      40_000,
      transcription,
      {
        minDurationMs: 5_000,
        maxDurationMs: 12_000,
        minClipCount: 1,
        targetClipCount: 1,
        deduplicationThresholdMs: 5_000,
        sceneCutsMs: [6_000, 14_000, 18_000],
      }
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Strong overlap");
    expect(result[0].selectionScore).toBe(result[0].qualitySignals?.overallScore);
  });

  it("extends short clips to the configured minimum duration", () => {
    const result = service.extractClips(
      [
        {
          title: "Short clip",
          hook: "Needs extension",
          startPercent: 5,
          endPercent: 8,
        },
      ],
      30_000,
      transcription,
      {
        minDurationMs: 5_000,
        maxDurationMs: 12_000,
        minClipCount: 1,
        targetClipCount: 1,
      }
    );

    expect(result).toHaveLength(1);
    expect(result[0].endMs - result[0].startMs).toBeGreaterThanOrEqual(5_000);
  });

  it("generates fallback clips when suggestions are empty", () => {
    const result = service.extractClips([], 30_000, transcription, {
      minDurationMs: 5_000,
      maxDurationMs: 8_000,
      minClipCount: 2,
      targetClipCount: 2,
      sceneCutsMs: [5_000, 12_000, 19_000],
    });

    expect(result).toHaveLength(2);
    expect(result.every((clip) => (clip.endMs - clip.startMs) >= 5_000)).toBe(true);
    expect(result.every((clip) => clip.qualitySignals?.overallScore)).toBe(true);
  });

  it("returns transcript text for overlapping segments", () => {
    const text = service.getTranscriptSegment(transcription, 6_000, 20_000);
    expect(text).toContain("echo");
    expect(text).toContain("november");
  });
});
