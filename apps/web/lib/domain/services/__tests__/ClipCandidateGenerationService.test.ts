import { ClipCandidateGenerationService } from "@/lib/domain/services/ClipCandidateGenerationService";
import { V1_CLIP_POLICY } from "@/lib/repurpose/clip-policy";
import type { CanonicalTranscript } from "@/lib/ai/providers/openai-transcription-provider";

function makeTranscript(): CanonicalTranscript {
  const words = Array.from({ length: 90 }).map((_, index) => ({
    index,
    word: index === 0 ? "Stop" : index % 11 === 0 ? "mistake" : `word${index}`,
    start: index * 0.55,
    end: index * 0.55 + 0.32,
    confidence: null,
  }));

  return {
    text: words.map((word) => word.word).join(" "),
    segments: [{
      id: "seg-1",
      start: 0,
      end: 52,
      text: words.map((word) => word.word).join(" "),
      words,
    }],
    precision: "word",
    provider: "openai",
    model: "whisper-1",
    warnings: [],
    createdAt: "2026-05-05T00:00:00.000Z",
  };
}

function makeLongTranscript(wordCount = 700): CanonicalTranscript {
  const words = Array.from({ length: wordCount }).map((_, index) => ({
    index,
    word:
      index % 37 === 0
        ? "mistake"
        : index % 53 === 0
          ? "growth"
          : index % 71 === 0
            ? "question"
            : `word${index}`,
    start: index * 0.42,
    end: index * 0.42 + 0.28,
    confidence: null,
  }));

  return {
    text: words.map((word) => word.word).join(" "),
    segments: [{
      id: "seg-1",
      start: 0,
      end: wordCount * 0.42,
      text: words.map((word) => word.word).join(" "),
      words,
    }],
    precision: "word",
    provider: "openai",
    model: "whisper-1",
    warnings: [],
    createdAt: "2026-05-05T00:00:00.000Z",
  };
}

describe("ClipCandidateGenerationService", () => {
  it("generates real timestamped candidates within the V1 clip policy", () => {
    const service = new ClipCandidateGenerationService();
    const candidates = service.generateCandidates({
      transcript: makeTranscript(),
      durationMs: 60_000,
      sceneCutsMs: [18_000, 36_000],
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(V1_CLIP_POLICY.targetCandidateCount);
    for (const candidate of candidates) {
      expect(candidate.startMs).toBeGreaterThanOrEqual(0);
      expect(candidate.endMs).toBeGreaterThan(candidate.startMs);
      expect(candidate.endMs - candidate.startMs).toBeLessThanOrEqual(V1_CLIP_POLICY.maxMs + V1_CLIP_POLICY.postRollMs);
      expect(candidate.transcriptPrecision).toBe("word");
    }
  });

  it("keeps a larger candidate pool for reranking than the final target count", () => {
    const service = new ClipCandidateGenerationService();
    const candidates = service.generateCandidates({
      transcript: makeLongTranscript(),
      durationMs: 300_000,
      sceneCutsMs: [45_000, 90_000, 135_000, 180_000, 225_000],
      targetClipCount: 3,
    });

    expect(candidates.length).toBeGreaterThanOrEqual(15);
    expect(candidates.length).toBeLessThanOrEqual(60);
  });
});
