import { injectable } from "inversify";

import type {
  CanonicalTranscript,
  TranscriptPrecision,
  TranscriptWord,
} from "@/lib/ai/providers/openai-transcription-provider";
import type { ClipCandidate } from "@/lib/domain/services/ClipCandidateGenerationService";
import { V1_CLIP_POLICY, type ClipPolicy } from "@/lib/repurpose/clip-policy";

export type ClipBoundaryRefinementResult = {
  startMs: number;
  endMs: number;
  confidence: "high" | "medium" | "low";
  precision: TranscriptPrecision;
  boundaryReasons: string[];
};

@injectable()
export class ClipBoundaryRefinementService {
  refine(params: {
    candidate: ClipCandidate;
    transcript: CanonicalTranscript;
    sceneCutsMs: number[];
    durationMs: number;
    policy?: ClipPolicy;
  }): ClipBoundaryRefinementResult {
    const policy = params.policy ?? V1_CLIP_POLICY;
    const words = params.transcript.segments.flatMap((segment) => segment.words ?? []);
    const reasons: string[] = [];

    let startMs = params.candidate.startMs;
    let endMs = params.candidate.endMs;
    let confidence: "high" | "medium" | "low" = "low";

    if (words.length > 0) {
      const firstWord = findNearestWordStart(words, startMs / 1000);
      const lastWord = findNearestWordEnd(words, endMs / 1000);
      if (firstWord) {
        startMs = Math.round(firstWord.start * 1000) - policy.preRollMs;
        reasons.push("Snapped start to nearest word boundary with pre-roll.");
      }
      if (lastWord) {
        endMs = Math.round(lastWord.end * 1000) + policy.postRollMs;
        reasons.push("Snapped end to nearest word boundary with post-roll.");
      }
      confidence = "high";
    } else {
      const overlapping = params.transcript.segments.filter((segment) =>
        segment.end * 1000 > startMs &&
        segment.start * 1000 < endMs
      );
      if (overlapping.length > 0) {
        startMs = Math.round(overlapping[0].start * 1000);
        endMs = Math.round(overlapping[overlapping.length - 1].end * 1000);
        confidence = params.transcript.precision === "none" ? "low" : "medium";
        reasons.push("Snapped boundaries to transcript segment edges.");
      }
    }

    const sceneStart = nearestSceneCutBefore(startMs, params.sceneCutsMs, 1500);
    if (sceneStart !== null) {
      startMs = sceneStart;
      reasons.push("Snapped start to nearby scene cut.");
    }
    const sceneEnd = nearestSceneCutAfter(endMs, params.sceneCutsMs, 2000);
    if (sceneEnd !== null) {
      endMs = sceneEnd;
      reasons.push("Snapped end to nearby scene cut.");
    }

    startMs = Math.max(0, Math.min(startMs, params.durationMs));
    endMs = Math.max(startMs + 1, Math.min(endMs, params.durationMs));

    if (endMs - startMs > policy.maxMs) {
      const limitMs = Math.min(params.durationMs, startMs + policy.maxMs);
      const snappedEnd = words.length > 0 ? snapEndToWordBeforeLimit(words, limitMs, startMs) : null;
      endMs = snappedEnd ?? limitMs;
      reasons.push(snappedEnd !== null
        ? "Trimmed end to V1 maximum clip duration and re-snapped to a word boundary."
        : "Trimmed end to V1 maximum clip duration.");
      if (snappedEnd !== null && endMs - startMs < policy.minMs) {
        const saferEnd = snapEndToWordBeforeLimit(words, Math.min(params.durationMs, startMs + policy.idealMs), startMs);
        if (saferEnd !== null && saferEnd > endMs) {
          endMs = Math.min(saferEnd, limitMs);
          reasons.push("Used safest nearby word boundary after max-duration trimming compromise.");
        }
        confidence = confidence === "high" ? "medium" : confidence;
      }
    }

    const validated = clampAndValidateBoundary({
      startMs,
      endMs,
      durationMs: params.durationMs,
      words,
    });
    startMs = validated.startMs;
    endMs = validated.endMs;
    if (validated.reason) {
      reasons.push(validated.reason);
      confidence = confidence === "high" ? "medium" : confidence;
    }

    if (endMs - startMs < policy.minMs && params.candidate.candidateType !== "fallback") {
      reasons.push("Kept short high-signal clip instead of padding weak context.");
    }

    return {
      startMs,
      endMs,
      confidence,
      precision: params.transcript.precision,
      boundaryReasons: reasons,
    };
  }
}

function findNearestWordStart(words: TranscriptWord[], targetSec: number): TranscriptWord | null {
  return nearestWord(words, targetSec, (word) => word.start, 1.2, 0.8);
}

function findNearestWordEnd(words: TranscriptWord[], targetSec: number): TranscriptWord | null {
  return nearestWord(words, targetSec, (word) => word.end, 1.0, 1.4);
}

function nearestWord(
  words: TranscriptWord[],
  targetSec: number,
  getValue: (word: TranscriptWord) => number,
  lookBackSec: number,
  lookAheadSec: number
) {
  let best: TranscriptWord | null = null;
  let bestDistance = Infinity;
  for (const word of words) {
    const value = getValue(word);
    const delta = value - targetSec;
    if (delta < -lookBackSec || delta > lookAheadSec) continue;
    const distance = Math.abs(delta);
    if (distance < bestDistance) {
      best = word;
      bestDistance = distance;
    }
  }
  return best;
}

function nearestSceneCutBefore(targetMs: number, cutsMs: number[], windowMs: number) {
  const candidates = cutsMs.filter((cut) => cut <= targetMs && targetMs - cut <= windowMs);
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function nearestSceneCutAfter(targetMs: number, cutsMs: number[], windowMs: number) {
  const candidates = cutsMs.filter((cut) => cut >= targetMs && cut - targetMs <= windowMs);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

export function snapEndToWordBeforeLimit(
  words: TranscriptWord[],
  limitMs: number,
  startMs: number
): number | null {
  const candidates = words
    .map((word) => Math.round(word.end * 1000))
    .filter((end) => end <= limitMs && end > startMs + 250);
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function snapStartToWordNearTarget(words: TranscriptWord[], targetMs: number): number | null {
  const targetSec = targetMs / 1000;
  const word = findNearestWordStart(words, targetSec);
  return word ? Math.max(0, Math.round(word.start * 1000)) : null;
}

export function clampAndValidateBoundary({
  startMs,
  endMs,
  durationMs,
  words,
}: {
  startMs: number;
  endMs: number;
  durationMs: number;
  words: TranscriptWord[];
}): { startMs: number; endMs: number; reason?: string } {
  let nextStart = Math.max(0, Math.min(startMs, durationMs));
  let nextEnd = Math.max(nextStart + 1, Math.min(endMs, durationMs));
  let reason: string | undefined;

  if (words.length > 0) {
    const cutsMidWord = words.some((word) => {
      const wordStartMs = Math.round(word.start * 1000);
      const wordEndMs = Math.round(word.end * 1000);
      return nextEnd > wordStartMs && nextEnd < wordEndMs;
    });
    const wordEnd = cutsMidWord ? snapEndToWordBeforeLimit(words, nextEnd, nextStart) : null;
    if (wordEnd !== null) {
      nextEnd = wordEnd;
      reason = "Final end boundary re-snapped to avoid a mid-word cut.";
    }

    if (nextEnd <= nextStart) {
      const startSnap = snapStartToWordNearTarget(words, nextStart);
      if (startSnap !== null && startSnap < nextEnd) {
        nextStart = startSnap;
        reason = "Final start boundary adjusted to keep a valid word-aligned clip.";
      }
    }
  }

  if (nextEnd <= nextStart) {
    nextEnd = Math.min(durationMs, nextStart + 1);
    reason = "Final boundary clamped to maintain a positive clip duration.";
  }

  return { startMs: nextStart, endMs: nextEnd, reason };
}
