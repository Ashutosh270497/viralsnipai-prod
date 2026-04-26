import "openai/shims/node";

import {
  isSyntheticTranscriptText,
  parseOpenRouterTranscriptionContent,
} from "@/lib/transcript";

describe("transcript helpers", () => {
  it("parses OpenRouter JSON transcription responses", () => {
    const result = parseOpenRouterTranscriptionContent(
      JSON.stringify({
        text: "Hello world. This is real speech.",
        segments: [
          { start: 0, end: 2.5, text: "Hello world." },
          { start: "2.5", end: "5", text: "This is real speech." },
        ],
      })
    );

    expect(result.text).toBe("Hello world. This is real speech.");
    expect(result.segments).toEqual([
      { start: 0, end: 2.5, text: "Hello world." },
      { start: 2.5, end: 5, text: "This is real speech." },
    ]);
  });

  it("falls back to raw text when the model returns non-json transcript text", () => {
    const result = parseOpenRouterTranscriptionContent("A plain transcript without JSON.");

    expect(result).toEqual({
      text: "A plain transcript without JSON.",
      segments: [],
    });
  });

  it("detects synthetic placeholder transcripts", () => {
    expect(isSyntheticTranscriptText("This is synthetic transcript segment 1 from video.mp4.")).toBe(true);
    expect(isSyntheticTranscriptText("This is the actual speaker talking about OpenAI.")).toBe(false);
  });
});
