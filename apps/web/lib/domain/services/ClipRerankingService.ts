import { injectable } from "inversify";

import {
  rerankClipCandidates,
  type ClipRerankResult,
  type ClipRerankSelection,
} from "@/lib/ai/providers/openrouter-reasoning-provider";
import type { ClipCandidate } from "@/lib/domain/services/ClipCandidateGenerationService";
import type { TranscriptPrecision } from "@/lib/ai/providers/openai-transcription-provider";
import type { ModelPolicy } from "@/lib/ai/model-policy";
import { logger } from "@/lib/logger";

@injectable()
export class ClipRerankingService {
  async rerank(params: {
    candidates: ClipCandidate[];
    targetClipCount: number;
    audience?: string;
    tone?: string;
    brief?: string;
    callToAction?: string;
    transcriptPrecision: TranscriptPrecision;
    sourceDurationSec: number;
    clipPolicy?: {
      minMs: number;
      idealMs: number;
      maxMs: number;
    };
    modelPolicy?: ModelPolicy;
    model?: string;
  }): Promise<ClipRerankResult> {
    const models = params.modelPolicy
      ? [params.modelPolicy.primaryModel, ...params.modelPolicy.fallbackModels]
      : params.model
        ? [params.model]
        : [];
    const attemptedModels = models.length > 0 ? Array.from(new Set(models)) : [undefined];
    const failures: string[] = [];

    for (const model of attemptedModels) {
      for (const structuredMode of ["json_schema", "json_object"] as const) {
        try {
          const result = await rerankClipCandidates({
            ...params,
            model,
            structuredMode,
            // Reranking owns its fallback sequence. Avoid retrying the same
            // unsupported/fragile structured mode repeatedly before trying the
            // next safer mode or model.
            maxAttempts: 1,
          });
          const filled = fillMissingSelections(result.selected, params);
          logger.info("Clip reranking completed", {
            model: result.model,
            structuredMode: result.structuredMode ?? structuredMode,
            fallbackUsed: model !== params.modelPolicy?.primaryModel || structuredMode !== "json_schema",
            deterministicFallbackUsed: false,
            policyTask: params.modelPolicy?.task,
            requested: params.targetClipCount,
            selected: filled.length,
          });
          return {
            ...result,
            selected: filled,
            deterministicFallbackUsed: false,
            overallWarnings: [
              ...result.overallWarnings,
              ...failures.map((failure) => `Model fallback: ${failure}`),
            ],
          };
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          failures.push(`${model ?? "default"} ${structuredMode} failed: ${reason}`);
          logger.warn("Clip reranking model failed", {
            model,
            structuredMode,
            policyTask: params.modelPolicy?.task,
            reason,
          });
        }
      }
    }

    const selected = buildDeterministicSelections(params);

    return {
      selected,
      overallWarnings: [
        "OpenRouter reranking unavailable; used deterministic candidate ranking.",
        ...failures,
      ],
      model: "deterministic_fallback",
      deterministicFallbackUsed: true,
    };
  }
}

function fillMissingSelections(
  selected: ClipRerankSelection[],
  params: {
    candidates: ClipCandidate[];
    targetClipCount: number;
    callToAction?: string;
  },
): ClipRerankSelection[] {
  if (selected.length >= params.targetClipCount) {
    return selected.slice(0, params.targetClipCount);
  }

  const used = new Set(selected.map((item) => item.candidateId));
  const deterministicFill = buildDeterministicSelections({
    candidates: params.candidates.filter((candidate) => !used.has(candidate.id)),
    targetClipCount: params.targetClipCount - selected.length,
    callToAction: params.callToAction,
  });

  return [
    ...selected,
    ...deterministicFill.map((item, index) => ({
      ...item,
      rank: selected.length + index + 1,
      editingNotes: [
        ...(item.editingNotes ?? []),
        "Filled by deterministic ranking because the model returned fewer strong clips.",
      ],
    })),
  ].slice(0, params.targetClipCount);
}

function buildDeterministicSelections(params: {
  candidates: ClipCandidate[];
  targetClipCount: number;
  callToAction?: string;
}): ClipRerankSelection[] {
  return params.candidates
    .map((candidate) => {
      const ranking = scoreDeterministicCandidate(candidate);
      return { candidate, ...ranking };
    })
    .sort((a, b) => b.score - a.score || a.candidate.startMs - b.candidate.startMs)
    .slice(0, params.targetClipCount)
    .map(({ candidate, score, reasons }, index) => ({
      candidateId: candidate.id,
      rank: index + 1,
      title: buildDeterministicTitle(candidate),
      hook: candidate.text.slice(0, 180) || candidate.firstWords || "Strong candidate moment.",
      callToAction: params.callToAction ?? null,
      llmScore: 0,
      viralReason: `Selected by deterministic ranking: ${reasons.slice(0, 3).join(" ")}`,
      editingNotes: [
        "Review manually because OpenRouter reranking was unavailable.",
        ...reasons,
      ],
      platformFit: {
        youtubeShorts: score,
        instagramReels: score,
        tiktok: score,
        x: score,
      },
      finalScore: score,
    }));
}

function scoreDeterministicCandidate(candidate: ClipCandidate): { score: number; reasons: string[] } {
  const text = candidate.text.toLowerCase();
  const firstWords = candidate.firstWords.toLowerCase();
  const reasons: string[] = [];
  let score = candidate.deterministicScore;

  const hookPattern = /\b(stop|secret|mistake|truth|reason|why|how|what|nobody|never|always|best|worst)\b/;
  if (hookPattern.test(firstWords)) {
    score += 9;
    reasons.push("Strong first-three-second hook.");
  }

  if (/\b\d+(?:[.,]\d+)?\s*(?:%|percent|x|times|days|weeks|months|years|minutes|hours)?\b/.test(text)) {
    score += 8;
    reasons.push("Contains specific numbers or measurable claims.");
  }

  if (/\?/.test(candidate.text) || /\b(why|how|what|should|can)\b/.test(text)) {
    score += 7;
    reasons.push("Question-answer structure is likely self-contained.");
  }

  if (/\b(wrong|myth|contrary|instead|but|however|nobody|don't|never)\b/.test(text)) {
    score += 7;
    reasons.push("Contrarian or tension-based language.");
  }

  if (candidate.qualitySignals.contentDensity === "balanced") {
    score += 6;
    reasons.push("Balanced speech density.");
  } else if (candidate.qualitySignals.contentDensity === "sparse") {
    score -= 6;
    reasons.push("Lower content density.");
  }

  if (candidate.qualitySignals.hardCutRisk === "low") {
    score += 6;
    reasons.push("Clean speech/scene boundary.");
  } else if (candidate.qualitySignals.hardCutRisk === "high") {
    score -= 8;
    reasons.push("Higher hard-cut risk.");
  }

  const fillerMatches = text.match(/\b(um|uh|like|basically|actually|literally|i mean|you know)\b/g) ?? [];
  const wordCount = Math.max(1, candidate.text.split(/\s+/).filter(Boolean).length);
  const fillerDensity = fillerMatches.length / wordCount;
  if (fillerDensity > 0.08) {
    score -= 10;
    reasons.push("High filler-word density.");
  }

  if (/^(so|basically|today i will|in this video|okay|alright)\b/.test(firstWords)) {
    score -= 8;
    reasons.push("Weak intro phrase avoided.");
  }

  const durationMs = candidate.endMs - candidate.startMs;
  if (durationMs >= 24_000 && durationMs <= 45_000) {
    score += 4;
    reasons.push("Duration fits short-form review defaults.");
  }

  if (candidate.transcriptPrecision === "word") {
    score += 4;
    reasons.push("Word-level transcript timing.");
  }

  if (reasons.length === 0) {
    reasons.push("Highest deterministic content and boundary score.");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

function buildDeterministicTitle(candidate: ClipCandidate): string {
  const clean = candidate.firstWords || candidate.text.slice(0, 80);
  return clean
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, 90) || "Selected highlight";
}
