import type {
  ClipOutputRatio,
  ClipQualitySignals,
  ClipReframePlan,
  VideoGeometry,
} from "@/lib/types";
import type { TranscriptionSegment } from "@/lib/transcript";

type ClipWord = {
  start: number;
  end: number;
  word: string;
};

const TARGET_RATIOS: Record<ClipOutputRatio, number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "16:9": 16 / 9,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function scoreDistance(distance: number, softLimit: number, hardLimit: number): number {
  if (!Number.isFinite(distance)) return 35;
  if (distance <= softLimit) return 100;
  if (distance >= hardLimit) return 20;
  const progress = (distance - softLimit) / Math.max(1, hardLimit - softLimit);
  return round(100 - progress * 80);
}

function getBoundaryDistance(targetSec: number, values: number[]): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  return values.reduce((best, value) => Math.min(best, Math.abs(value - targetSec)), Number.POSITIVE_INFINITY);
}

function getOverlappingSegments(
  segments: TranscriptionSegment[] | undefined,
  startSec: number,
  endSec: number
): TranscriptionSegment[] {
  if (!segments || segments.length === 0) {
    return [];
  }

  return segments.filter((segment) => segment.end > startSec && segment.start < endSec);
}

function getWords(segments: TranscriptionSegment[], startSec: number, endSec: number): ClipWord[] {
  const words: ClipWord[] = [];

  for (const segment of segments) {
    if (segment.words && segment.words.length > 0) {
      for (const word of segment.words) {
        if (word.end <= startSec || word.start >= endSec) continue;
        const clippedStart = Math.max(word.start, startSec);
        const clippedEnd = Math.min(word.end, endSec);
        if (clippedEnd <= clippedStart) continue;
        const text = word.word.trim();
        if (!text) continue;
        words.push({ start: clippedStart, end: clippedEnd, word: text });
      }
      continue;
    }

    const rawWords = segment.text
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    if (rawWords.length === 0) continue;

    const visibleStart = Math.max(segment.start, startSec);
    const visibleEnd = Math.min(segment.end, endSec);
    const step = (visibleEnd - visibleStart) / Math.max(1, rawWords.length);

    for (let index = 0; index < rawWords.length; index += 1) {
      const wordStart = visibleStart + step * index;
      const wordEnd = Math.min(visibleEnd, wordStart + Math.max(step, 0.08));
      if (wordEnd <= wordStart) continue;
      words.push({ start: wordStart, end: wordEnd, word: rawWords[index] });
    }
  }

  return words.sort((left, right) => left.start - right.start || left.end - right.end);
}

function scoreDurationFit(durationMs: number, minDurationMs: number, maxDurationMs: number): number {
  const midpoint = (minDurationMs + maxDurationMs) / 2;
  const tolerance = Math.max(1, (maxDurationMs - minDurationMs) / 2);
  const deviation = Math.abs(durationMs - midpoint);
  const normalized = clamp(1 - deviation / tolerance, 0, 1);
  return round(45 + normalized * 55);
}

function scoreTranscriptDensity(wordsPerMinute: number): {
  score: number;
  density: "sparse" | "balanced" | "dense";
} {
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0) {
    return { score: 25, density: "sparse" };
  }

  if (wordsPerMinute < 100) {
    return {
      score: round(clamp(35 + (wordsPerMinute / 100) * 35, 20, 70)),
      density: "sparse",
    };
  }

  if (wordsPerMinute <= 185) {
    return {
      score: round(clamp(80 + (1 - Math.abs(wordsPerMinute - 145) / 40) * 20, 70, 100)),
      density: "balanced",
    };
  }

  return {
    score: round(clamp(95 - Math.min(45, (wordsPerMinute - 185) * 0.35), 45, 95)),
    density: "dense",
  };
}

function scorePacingConsistency(words: ClipWord[], durationSec: number): number {
  if (words.length < 3 || durationSec <= 0) {
    return 55;
  }

  const gaps: number[] = [];
  for (let index = 1; index < words.length; index += 1) {
    gaps.push(Math.max(0, words[index].start - words[index - 1].start));
  }

  const averageGap = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  if (averageGap <= 0) return 82;

  const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - averageGap, 2), 0) / gaps.length;
  const deviation = Math.sqrt(variance);
  const normalized = clamp(1 - deviation / Math.max(0.25, averageGap * 1.6), 0, 1);
  const pausesPenalty = gaps.filter((gap) => gap > 1.1).length * 5;

  return round(clamp(45 + normalized * 50 - pausesPenalty, 20, 100));
}

export function analyzeClipQuality(params: {
  startMs: number;
  endMs: number;
  transcriptionSegments?: TranscriptionSegment[];
  sceneCutsMs?: number[];
  minDurationMs?: number;
  maxDurationMs?: number;
}): ClipQualitySignals {
  const {
    startMs,
    endMs,
    transcriptionSegments = [],
    sceneCutsMs = [],
    minDurationMs = 60_000,
    maxDurationMs = 95_000,
  } = params;

  const durationMs = Math.max(1, endMs - startMs);
  const startSec = startMs / 1000;
  const endSec = endMs / 1000;
  const durationSec = durationMs / 1000;
  const overlappingSegments = getOverlappingSegments(transcriptionSegments, startSec, endSec);
  const words = getWords(overlappingSegments, startSec, endSec);
  const wordsPerMinute = durationSec > 0 ? (words.length / durationSec) * 60 : 0;

  const { score: transcriptDensity, density } = scoreTranscriptDensity(wordsPerMinute);
  const durationFit = scoreDurationFit(durationMs, minDurationMs, maxDurationMs);

  const sceneCuts = sceneCutsMs
    .filter((cut) => Number.isFinite(cut) && cut >= startMs && cut <= endMs)
    .sort((left, right) => left - right);
  const startBoundaryScene = getBoundaryDistance(startMs, sceneCutsMs);
  const endBoundaryScene = getBoundaryDistance(endMs, sceneCutsMs);
  const sceneAlignment = round(
    (scoreDistance(startBoundaryScene, 1_000, 3_500) + scoreDistance(endBoundaryScene, 1_200, 4_000)) / 2
  );

  const wordStarts = words.map((word) => word.start);
  const wordEnds = words.map((word) => word.end);
  const startBoundaryWord = getBoundaryDistance(startSec, wordStarts) * 1000;
  const endBoundaryWord = getBoundaryDistance(endSec, wordEnds) * 1000;
  const cutCleanliness = round(
    (scoreDistance(startBoundaryWord, 180, 900) + scoreDistance(endBoundaryWord, 220, 1_100)) / 2
  );

  const pacingConsistency = scorePacingConsistency(words, durationSec);
  const boundaryDistanceMs = round(Math.min(Number.isFinite(startBoundaryWord) ? startBoundaryWord : 0, 9_999) + Math.min(Number.isFinite(endBoundaryWord) ? endBoundaryWord : 0, 9_999));

  const hardCutRisk: "low" | "medium" | "high" =
    cutCleanliness >= 78 && sceneAlignment >= 70
      ? "low"
      : cutCleanliness >= 55 && sceneAlignment >= 45
      ? "medium"
      : "high";

  const overallScore = round(
    clamp(
      durationFit * 0.22 +
        transcriptDensity * 0.24 +
        sceneAlignment * 0.2 +
        cutCleanliness * 0.18 +
        pacingConsistency * 0.16,
      0,
      100
    )
  );

  const reasons: string[] = [];
  if (durationFit >= 78) reasons.push("Duration fits the target clip window.");
  if (transcriptDensity >= 78) reasons.push("Transcript density is in a strong range for short-form viewing.");
  if (sceneAlignment >= 70) reasons.push("Clip boundaries align closely with scene transitions.");
  if (cutCleanliness >= 72) reasons.push("Word boundaries suggest clean in/out cuts.");
  if (pacingConsistency >= 72) reasons.push("Speech cadence is stable across the selected range.");
  if (hardCutRisk === "high") reasons.push("Boundary timing still risks abrupt visual or spoken cutoffs.");

  return {
    overallScore,
    durationFit,
    transcriptDensity,
    sceneAlignment,
    cutCleanliness,
    pacingConsistency,
    hardCutRisk,
    contentDensity: density,
    wordsPerMinute: round(wordsPerMinute),
    transcriptSegmentCount: overlappingSegments.length,
    sceneCutsInside: sceneCuts.length,
    boundaryDistanceMs: round(boundaryDistanceMs),
    reasons,
  };
}

function inferReframeMode(sourceRatio: number, targetRatio: number): ClipReframePlan["mode"] {
  const difference = Math.abs(sourceRatio - targetRatio);
  if (difference < 0.08) return "native";
  if (sourceRatio > targetRatio) {
    return targetRatio < 1 ? "speaker_focus" : "center_crop";
  }
  return "letterbox";
}

function inferTracking(params: {
  mode: ClipReframePlan["mode"];
  geometry: VideoGeometry;
  targetRatio: number;
  confidence: ClipReframePlan["confidence"];
  qualitySignals: ClipQualitySignals;
}): ClipReframePlan["tracking"] | undefined {
  const { mode, geometry, targetRatio, confidence, qualitySignals } = params;

  if (mode !== "speaker_focus") {
    return undefined;
  }

  const confidenceMultiplier =
    confidence === "high" ? 1 : confidence === "medium" ? 0.82 : 0.64;
  const pacingMultiplier = qualitySignals.pacingConsistency >= 72 ? 1 : 0.78;
  const roomMultiplier = geometry.aspectRatio > targetRatio ? 1 : 0.75;
  const baseTravel = clamp(
    (geometry.aspectRatio - targetRatio) * 0.11 * confidenceMultiplier * pacingMultiplier * roomMultiplier,
    0.035,
    0.16
  );

  return {
    axis: geometry.width >= geometry.height ? "horizontal" : "vertical",
    travel: round(baseTravel),
    lockStrength: round(
      clamp(
        (confidence === "high" ? 0.9 : confidence === "medium" ? 0.74 : 0.58) *
          (qualitySignals.sceneAlignment >= 70 ? 1 : 0.88),
        0.45,
        0.95
      )
    ),
    easing: "ease_in_out",
  };
}

export function buildClipReframePlans(params: {
  geometry?: VideoGeometry | null;
  qualitySignals: ClipQualitySignals;
}): ClipReframePlan[] {
  const { geometry, qualitySignals } = params;

  if (!geometry) {
    return [];
  }

  return (Object.entries(TARGET_RATIOS) as Array<[ClipOutputRatio, number]>).map(([ratio, targetRatio]) => {
    const mode = inferReframeMode(geometry.aspectRatio, targetRatio);
    const confidence =
      qualitySignals.hardCutRisk === "low" && qualitySignals.pacingConsistency >= 70
        ? "high"
        : qualitySignals.hardCutRisk === "medium"
        ? "medium"
        : "low";

    const anchor =
      mode === "speaker_focus"
        ? "speaker"
        : mode === "letterbox"
        ? "safe_area"
        : "center";

    const safeZone =
      ratio === "9:16"
        ? { x: 0.18, y: 0.08, width: 0.64, height: 0.84 }
        : ratio === "1:1"
        ? { x: 0.08, y: 0.08, width: 0.84, height: 0.84 }
        : { x: 0.04, y: 0.12, width: 0.92, height: 0.76 };

    let reasoning = "Keeps the source framing nearly native.";
    if (mode === "speaker_focus") {
      reasoning = "Portrait delivery should bias toward the active speaker safe area.";
    } else if (mode === "center_crop") {
      reasoning = "Wide source can be center-cropped without sacrificing the main action window.";
    } else if (mode === "letterbox") {
      reasoning = "Source is narrower than target, so preserving composition is safer than aggressive crop.";
    }

    return {
      ratio,
      mode,
      anchor,
      confidence,
      safeZone,
      tracking: inferTracking({
        mode,
        geometry,
        targetRatio,
        confidence,
        qualitySignals,
      }),
      reasoning,
    };
  });
}

export function selectBestReframePlan(
  plans: ClipReframePlan[] | undefined | null,
  targetAspectRatio: number
): ClipReframePlan | null {
  if (!plans || plans.length === 0 || !Number.isFinite(targetAspectRatio) || targetAspectRatio <= 0) {
    return null;
  }

  let bestPlan: ClipReframePlan | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const plan of plans) {
    const ratio = TARGET_RATIOS[plan.ratio];
    const distance = Math.abs(ratio - targetAspectRatio);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPlan = plan;
    }
  }

  return bestPlan;
}

export function blendViralityScore(
  aiScore: number | null | undefined,
  deterministicScore: number
): number {
  if (!Number.isFinite(aiScore as number)) {
    return Math.round(deterministicScore);
  }

  return Math.round(clamp((aiScore as number) * 0.72 + deterministicScore * 0.28, 0, 100));
}
