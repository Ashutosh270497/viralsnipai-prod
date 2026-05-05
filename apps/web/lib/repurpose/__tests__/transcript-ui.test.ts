import {
  detectFillerWords,
  detectLongPauses,
  getClipWords,
  parseCanonicalTranscript,
  searchTranscript,
} from "@/lib/repurpose/transcript-ui";

const canonicalTranscript = JSON.stringify({
  text: "Um this is a useful quote you know with a pause",
  precision: "word",
  provider: "openai",
  model: "whisper-1",
  warnings: [],
  segments: [
    {
      id: "s1",
      start: 1,
      end: 8,
      text: "Um this is a useful quote you know with a pause",
      words: [
        { index: 0, word: "Um", start: 1, end: 1.2 },
        { index: 1, word: "this", start: 1.25, end: 1.5 },
        { index: 2, word: "is", start: 1.55, end: 1.7 },
        { index: 3, word: "a", start: 1.75, end: 1.85 },
        { index: 4, word: "useful", start: 1.9, end: 2.2 },
        { index: 5, word: "quote", start: 2.25, end: 2.6 },
        { index: 6, word: "you", start: 3.6, end: 3.8 },
        { index: 7, word: "know", start: 3.85, end: 4.1 },
        { index: 8, word: "with", start: 4.15, end: 4.35 },
        { index: 9, word: "a", start: 4.4, end: 4.5 },
        { index: 10, word: "pause", start: 4.55, end: 4.9 },
      ],
    },
  ],
});

describe("transcript-ui", () => {
  it("parses canonical word transcripts into millisecond UI words", () => {
    const transcript = parseCanonicalTranscript(canonicalTranscript);

    expect(transcript.precision).toBe("word");
    expect(transcript.words).toHaveLength(11);
    expect(transcript.words[0]).toMatchObject({ word: "Um", startMs: 1000, endMs: 1200 });
  });

  it("falls back safely for legacy plain transcripts", () => {
    const transcript = parseCanonicalTranscript("plain transcript without timing");

    expect(transcript.isLegacy).toBe(true);
    expect(transcript.precision).toBe("none");
    expect(transcript.words).toHaveLength(0);
    expect(transcript.segments[0].text).toContain("plain transcript");
  });

  it("extracts clip words by timestamp overlap", () => {
    const transcript = parseCanonicalTranscript(canonicalTranscript);
    const words = getClipWords(transcript, 1800, 2700);

    expect(words.map((word) => word.word)).toEqual(["a", "useful", "quote"]);
  });

  it("searches word-level transcript and returns word indices", () => {
    const transcript = parseCanonicalTranscript(canonicalTranscript);
    const results = searchTranscript(transcript, "useful quote");

    expect(results[0]).toMatchObject({
      matchText: "useful quote",
      wordStartIndex: 4,
      wordEndIndex: 5,
    });
  });

  it("detects filler words and long pauses", () => {
    const transcript = parseCanonicalTranscript(canonicalTranscript);

    expect(detectFillerWords(transcript).map((match) => match.text)).toEqual(["Um", "you know"]);
    expect(detectLongPauses(transcript, 900)).toEqual([
      expect.objectContaining({ startMs: 2600, endMs: 3600, durationMs: 1000 }),
    ]);
  });
});
