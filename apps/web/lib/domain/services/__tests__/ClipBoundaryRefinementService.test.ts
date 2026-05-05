import { ClipBoundaryRefinementService } from "@/lib/domain/services/ClipBoundaryRefinementService";
import type { ClipCandidate } from "@/lib/domain/services/ClipCandidateGenerationService";
import type { CanonicalTranscript } from "@/lib/ai/providers/openai-transcription-provider";

const transcript: CanonicalTranscript = {
  text: "This is the exact transcript with word timings",
  precision: "word",
  provider: "openai",
  model: "whisper-1",
  warnings: [],
  createdAt: "2026-05-05T00:00:00.000Z",
  segments: [{
    id: "seg-1",
    start: 10,
    end: 20,
    text: "This is the exact transcript with word timings",
    words: [
      { index: 0, word: "This", start: 10.2, end: 10.5 },
      { index: 1, word: "is", start: 10.6, end: 10.8 },
      { index: 2, word: "timings", start: 19.1, end: 19.6 },
    ],
  }],
};

const candidate: ClipCandidate = {
  id: "cand-001",
  startMs: 10_250,
  endMs: 19_200,
  text: transcript.text,
  firstWords: "This is",
  lastWords: "word timings",
  candidateType: "educational",
  wordStartIndex: 0,
  wordEndIndex: 2,
  sourceSegmentIds: ["seg-1"],
  deterministicScore: 80,
  qualitySignals: {
    overallScore: 80,
    durationFit: 70,
    transcriptDensity: 75,
    sceneAlignment: 80,
    cutCleanliness: 85,
    pacingConsistency: 80,
    hardCutRisk: "low",
    contentDensity: "balanced",
    wordsPerMinute: 150,
    transcriptSegmentCount: 1,
    sceneCutsInside: 0,
    boundaryDistanceMs: 500,
    reasons: [],
  },
  reasons: [],
  transcriptPrecision: "word",
};

describe("ClipBoundaryRefinementService", () => {
  it("snaps final boundaries to local word and scene data", () => {
    const result = new ClipBoundaryRefinementService().refine({
      candidate,
      transcript,
      sceneCutsMs: [10_000, 20_000],
      durationMs: 30_000,
    });

    expect(result.confidence).toBe("high");
    expect(result.precision).toBe("word");
    expect(result.startMs).toBe(9_900);
    expect(result.endMs).toBe(20_100);
    expect(result.boundaryReasons.join(" ")).toContain("word boundary");
  });
});
