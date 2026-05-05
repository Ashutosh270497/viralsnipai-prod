import { TranscriptionService } from "@/lib/domain/services/TranscriptionService";
import type { TranscriptionResult } from "@/lib/domain/services/TranscriptionService";

const wordTranscript: TranscriptionResult = {
  text: "word timed transcript",
  precision: "word",
  provider: "openai",
  model: "whisper-1",
  warnings: [],
  createdAt: "2026-05-05T00:00:00.000Z",
  segments: [{
    id: "seg-1",
    start: 0,
    end: 1,
    text: "word timed transcript",
    words: [{ index: 0, word: "word", start: 0, end: 0.3 }],
  }],
};

describe("TranscriptionService V1 precision reuse", () => {
  it("re-transcribes segment-level transcripts when word precision is required", async () => {
    const service = new TranscriptionService();
    const transcribe = jest.spyOn(service, "transcribe").mockResolvedValue(wordTranscript);
    const existing = JSON.stringify({
      text: "segment only",
      precision: "segment",
      provider: "openai",
      model: "whisper-1",
      segments: [{ id: "seg-1", start: 0, end: 3, text: "segment only" }],
      warnings: [],
      createdAt: "2026-05-05T00:00:00.000Z",
    });

    const result = await service.getOrCreateTranscription("/tmp/source.mp4", existing, {
      forceRetranscribeOnUntimed: true,
    });

    expect(transcribe).toHaveBeenCalledWith("/tmp/source.mp4", { forceRetranscribeOnUntimed: true });
    expect(result.precision).toBe("word");
  });

  it("reuses existing word-level transcripts when word precision is required", async () => {
    const service = new TranscriptionService();
    const transcribe = jest.spyOn(service, "transcribe").mockResolvedValue(wordTranscript);
    const existing = service.serializeTranscription(wordTranscript);

    const result = await service.getOrCreateTranscription("/tmp/source.mp4", existing, {
      forceRetranscribeOnUntimed: true,
    });

    expect(transcribe).not.toHaveBeenCalled();
    expect(result.precision).toBe("word");
  });
});
