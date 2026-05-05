import {
  mergeChunkTranscripts,
  offsetTranscriptTimestamps,
  type CanonicalTranscript,
} from "@/lib/ai/providers/openai-transcription-provider";

function chunk(text: string, start: number, end: number): CanonicalTranscript {
  return {
    text,
    language: "en",
    durationSec: end - start,
    precision: "word",
    provider: "openai",
    model: "whisper-1",
    warnings: [],
    createdAt: "2026-05-05T00:00:00.000Z",
    segments: [{
      id: "seg-1",
      start: 0,
      end: end - start,
      text,
      words: text.split(" ").map((word, index) => ({
        index,
        word,
        start: index,
        end: index + 0.5,
      })),
    }],
  };
}

describe("OpenAI transcription chunk merge", () => {
  it("offsets segment and word timestamps by chunk start", () => {
    const shifted = offsetTranscriptTimestamps(chunk("hello world", 0, 2), 720, "chunk-2");

    expect(shifted.segments[0].start).toBe(720);
    expect(shifted.segments[0].end).toBe(722);
    expect(shifted.segments[0].words?.[0].start).toBe(720);
    expect(shifted.segments[0].words?.[1].end).toBe(721.5);
    expect(shifted.precision).toBe("word");
  });

  it("merges chunk transcripts with globally correct word indices and timestamps", () => {
    const merged = mergeChunkTranscripts([
      { transcript: chunk("first chunk", 0, 2), offsetSec: 0 },
      { transcript: chunk("second chunk", 720, 722), offsetSec: 720 },
    ], "whisper-1");

    expect(merged.provider).toBe("openai");
    expect(merged.precision).toBe("word");
    expect(merged.text).toBe("first chunk second chunk");
    expect(merged.segments).toHaveLength(2);
    expect(merged.segments[1].start).toBe(720);
    expect(merged.segments[1].words?.[0].index).toBe(2);
    expect(merged.segments[1].words?.[0].start).toBe(720);
  });
});
