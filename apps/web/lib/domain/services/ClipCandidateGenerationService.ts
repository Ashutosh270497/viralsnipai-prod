import { injectable } from "inversify";

import type {
  CanonicalTranscript,
  TranscriptPrecision,
  TranscriptSegment,
  TranscriptWord,
} from "@/lib/ai/providers/openai-transcription-provider";
import { V1_CLIP_POLICY, type ClipPolicy } from "@/lib/repurpose/clip-policy";
import type { ClipQualitySignals } from "@/lib/types";

export type CandidateType =
  | "hook"
  | "story_arc"
  | "problem_solution"
  | "question_answer"
  | "contrarian"
  | "quote"
  | "educational"
  | "fallback";

export type ClipCandidate = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  firstWords: string;
  lastWords: string;
  candidateType: CandidateType;
  wordStartIndex?: number | null;
  wordEndIndex?: number | null;
  sourceSegmentIds: string[];
  deterministicScore: number;
  qualitySignals: ClipQualitySignals;
  reasons: string[];
  transcriptPrecision: TranscriptPrecision;
};

export type ClipCandidateGenerationInput = {
  transcript: CanonicalTranscript;
  durationMs: number;
  sceneCutsMs: number[];
  policy?: ClipPolicy;
  audience?: string;
  tone?: string;
  brief?: string;
};

type FlatWord = TranscriptWord & {
  segmentId: string;
};

@injectable()
export class ClipCandidateGenerationService {
  generateCandidates(input: ClipCandidateGenerationInput): ClipCandidate[] {
    const policy = input.policy ?? V1_CLIP_POLICY;
    const words = flattenWords(input.transcript.segments);
    const candidates =
      words.length > 0
        ? this.generateWordCandidates(words, input, policy)
        : this.generateSegmentCandidates(input.transcript.segments, input, policy);

    return dedupeByOverlap(candidates)
      .sort((a, b) => b.deterministicScore - a.deterministicScore)
      .slice(0, policy.targetCandidateCount)
      .map((candidate, index) => ({
        ...candidate,
        id: `cand-${String(index + 1).padStart(3, "0")}`,
      }));
  }

  private generateWordCandidates(
    words: FlatWord[],
    input: ClipCandidateGenerationInput,
    policy: ClipPolicy
  ): ClipCandidate[] {
    const candidates: ClipCandidate[] = [];
    const minWords = Math.max(12, policy.minWords);
    const maxWords = Math.max(minWords, policy.maxWords);
    const step = Math.max(8, Math.floor(minWords / 2));

    for (let startIndex = 0; startIndex < words.length; startIndex += step) {
      for (const targetWords of [minWords, Math.round((minWords + maxWords) / 2), maxWords]) {
        const endIndex = Math.min(words.length - 1, startIndex + targetWords - 1);
        if (endIndex <= startIndex) continue;

        const startMs = Math.max(0, Math.round(words[startIndex].start * 1000));
        const endMs = Math.min(input.durationMs, Math.round(words[endIndex].end * 1000));
        if (endMs <= startMs) continue;
        if (endMs - startMs > policy.maxMs + policy.postRollMs) continue;
        if (endMs - startMs < Math.min(policy.minMs, input.durationMs)) continue;

        const slice = words.slice(startIndex, endIndex + 1);
        candidates.push(this.buildCandidate({
          id: `candidate-${candidates.length + 1}`,
          startMs,
          endMs,
          text: slice.map((word) => word.word).join(" "),
          wordStartIndex: words[startIndex].index,
          wordEndIndex: words[endIndex].index,
          sourceSegmentIds: [...new Set(slice.map((word) => word.segmentId))],
          transcriptPrecision: input.transcript.precision,
          sceneCutsMs: input.sceneCutsMs,
          durationMs: input.durationMs,
          policy,
        }));
      }
    }

    return candidates;
  }

  private generateSegmentCandidates(
    segments: TranscriptSegment[],
    input: ClipCandidateGenerationInput,
    policy: ClipPolicy
  ): ClipCandidate[] {
    const timed = segments.filter((segment) =>
      Number.isFinite(segment.start) &&
      Number.isFinite(segment.end) &&
      segment.end > segment.start &&
      segment.text.trim()
    );
    const candidates: ClipCandidate[] = [];

    for (let startIndex = 0; startIndex < timed.length; startIndex += 1) {
      let text = "";
      let endIndex = startIndex;
      while (endIndex < timed.length) {
        text = [text, timed[endIndex].text].filter(Boolean).join(" ").trim();
        const startMs = Math.round(timed[startIndex].start * 1000);
        const endMs = Math.round(timed[endIndex].end * 1000);
        const duration = endMs - startMs;
        const words = countWords(text);

        if (duration >= policy.minMs && words >= policy.minWords) {
          candidates.push(this.buildCandidate({
            id: `candidate-${candidates.length + 1}`,
            startMs,
            endMs: Math.min(input.durationMs, endMs),
            text,
            wordStartIndex: null,
            wordEndIndex: null,
            sourceSegmentIds: timed.slice(startIndex, endIndex + 1).map((segment) => segment.id),
            transcriptPrecision: input.transcript.precision,
            sceneCutsMs: input.sceneCutsMs,
            durationMs: input.durationMs,
            policy,
          }));
          break;
        }

        if (duration > policy.maxMs || words > policy.maxWords) break;
        endIndex += 1;
      }
    }

    return candidates;
  }

  private buildCandidate(params: {
    id: string;
    startMs: number;
    endMs: number;
    text: string;
    wordStartIndex?: number | null;
    wordEndIndex?: number | null;
    sourceSegmentIds: string[];
    transcriptPrecision: TranscriptPrecision;
    sceneCutsMs: number[];
    durationMs: number;
    policy: ClipPolicy;
  }): ClipCandidate {
    const text = params.text.replace(/\s+/g, " ").trim();
    const words = text.split(/\s+/).filter(Boolean);
    const candidateType = classifyCandidate(text);
    const qualitySignals = buildQualitySignals({
      startMs: params.startMs,
      endMs: params.endMs,
      text,
      candidateType,
      sceneCutsMs: params.sceneCutsMs,
      policy: params.policy,
    });
    const reasons = buildReasons(text, candidateType, qualitySignals);

    return {
      id: params.id,
      startMs: Math.max(0, Math.min(params.startMs, params.durationMs)),
      endMs: Math.max(params.startMs + 1, Math.min(params.endMs, params.durationMs)),
      text,
      firstWords: words.slice(0, 18).join(" "),
      lastWords: words.slice(-18).join(" "),
      candidateType,
      wordStartIndex: params.wordStartIndex ?? null,
      wordEndIndex: params.wordEndIndex ?? null,
      sourceSegmentIds: params.sourceSegmentIds,
      deterministicScore: qualitySignals.overallScore,
      qualitySignals,
      reasons,
      transcriptPrecision: params.transcriptPrecision,
    };
  }
}

function flattenWords(segments: TranscriptSegment[]): FlatWord[] {
  const words: FlatWord[] = [];
  for (const segment of segments) {
    for (const word of segment.words ?? []) {
      words.push({
        ...word,
        index: words.length,
        segmentId: segment.id,
      });
    }
  }
  return words.sort((a, b) => a.start - b.start || a.end - b.end);
}

function classifyCandidate(text: string): CandidateType {
  const lower = text.toLowerCase();
  if (/\?/.test(text) || /\b(why|how|what|when|where|who)\b/.test(lower)) return "question_answer";
  if (/\b(problem|mistake|struggle|broken|failed|pain)\b/.test(lower) && /\b(solution|fix|worked|changed|result)\b/.test(lower)) return "problem_solution";
  if (/\b(stop|wrong|myth|nobody|don't|never|contrary|instead)\b/.test(lower)) return "contrarian";
  if (/\b(learn|framework|step|lesson|strategy|tactic)\b/.test(lower)) return "educational";
  if (/["“”]/.test(text)) return "quote";
  if (/\b(but|then|because|until|finally)\b/.test(lower)) return "story_arc";
  if (/\b(secret|watch|here's|this is|the reason)\b/.test(lower)) return "hook";
  return "fallback";
}

function buildQualitySignals(params: {
  startMs: number;
  endMs: number;
  text: string;
  candidateType: CandidateType;
  sceneCutsMs: number[];
  policy: ClipPolicy;
}): ClipQualitySignals {
  const durationMs = params.endMs - params.startMs;
  const wordCount = countWords(params.text);
  const durationSec = Math.max(1, durationMs / 1000);
  const wordsPerMinute = Math.round((wordCount / durationSec) * 60);
  const durationFit = Math.max(0, 100 - Math.abs(durationMs - params.policy.idealMs) / 350);
  const transcriptDensity = Math.max(0, Math.min(100, (wordsPerMinute / 180) * 100));
  const sceneCutsInside = params.sceneCutsMs.filter((cut) => cut > params.startMs && cut < params.endMs).length;
  const nearestBoundary = nearestSceneBoundaryDistance(params.startMs, params.endMs, params.sceneCutsMs);
  const sceneAlignment = nearestBoundary <= 1500 ? 92 : nearestBoundary <= 3500 ? 72 : 55;
  const cutCleanliness = params.text.trim().match(/[.!?]$/) ? 88 : 64;
  const typeBonus = params.candidateType === "fallback" ? 0 : 10;
  const overallScore = Math.round(
    Math.max(0, Math.min(100,
      durationFit * 0.24 +
      transcriptDensity * 0.24 +
      sceneAlignment * 0.18 +
      cutCleanliness * 0.18 +
      Math.min(100, 55 + typeBonus + sceneCutsInside * 2) * 0.16
    ))
  );

  return {
    overallScore,
    durationFit: Math.round(durationFit),
    transcriptDensity: Math.round(transcriptDensity),
    sceneAlignment,
    cutCleanliness,
    pacingConsistency: transcriptDensity > 85 ? 74 : transcriptDensity > 45 ? 88 : 60,
    hardCutRisk: cutCleanliness > 80 && sceneAlignment > 70 ? "low" : sceneAlignment > 60 ? "medium" : "high",
    contentDensity: wordsPerMinute > 210 ? "dense" : wordsPerMinute < 105 ? "sparse" : "balanced",
    wordsPerMinute,
    transcriptSegmentCount: 0,
    sceneCutsInside,
    boundaryDistanceMs: nearestBoundary,
    reasons: [],
  };
}

function buildReasons(text: string, type: CandidateType, quality: ClipQualitySignals): string[] {
  const reasons = [`Detected ${type.replace("_", " ")} pattern.`];
  if (/\d/.test(text)) reasons.push("Contains a specific number or result.");
  if (quality.contentDensity === "balanced") reasons.push("Balanced speech density.");
  if (quality.hardCutRisk === "low") reasons.push("Clean candidate boundary.");
  return reasons;
}

function dedupeByOverlap(candidates: ClipCandidate[]): ClipCandidate[] {
  const kept: ClipCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.deterministicScore - a.deterministicScore)) {
    const duplicate = kept.some((existing) => overlapRatio(candidate, existing) > 0.55);
    if (!duplicate) kept.push(candidate);
  }
  return kept;
}

function overlapRatio(a: Pick<ClipCandidate, "startMs" | "endMs">, b: Pick<ClipCandidate, "startMs" | "endMs">) {
  const overlap = Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs));
  const smaller = Math.max(1, Math.min(a.endMs - a.startMs, b.endMs - b.startMs));
  return overlap / smaller;
}

function nearestSceneBoundaryDistance(startMs: number, endMs: number, sceneCutsMs: number[]) {
  if (sceneCutsMs.length === 0) return 9_999;
  return Math.min(...sceneCutsMs.map((cut) => Math.min(Math.abs(cut - startMs), Math.abs(cut - endMs))));
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}
