import { injectable } from "inversify";

import {
  rerankClipCandidates,
  type ClipRerankResult,
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
      try {
        const result = await rerankClipCandidates({
          ...params,
          model,
        });
        logger.info("Clip reranking completed", {
          model: result.model,
          fallbackUsed: model !== params.modelPolicy?.primaryModel,
          policyTask: params.modelPolicy?.task,
        });
        return {
          ...result,
          overallWarnings: [
            ...result.overallWarnings,
            ...failures.map((failure) => `Model fallback: ${failure}`),
          ],
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${model ?? "default"} failed: ${reason}`);
        logger.warn("Clip reranking model failed", {
          model,
          policyTask: params.modelPolicy?.task,
          reason,
        });
      }
    }

    const selected = params.candidates
      .slice()
      .sort((a, b) => b.deterministicScore - a.deterministicScore)
      .slice(0, params.targetClipCount)
      .map((candidate, index) => ({
        candidateId: candidate.id,
        rank: index + 1,
        title: candidate.firstWords || candidate.text.slice(0, 80) || "Selected highlight",
        hook: candidate.text.slice(0, 180) || candidate.firstWords || "Strong candidate moment.",
        callToAction: params.callToAction ?? null,
        llmScore: 0,
        viralReason: "Selected by deterministic transcript and scene-quality scoring after model fallbacks failed.",
        editingNotes: ["Review manually because OpenRouter reranking was unavailable."],
        platformFit: {
          youtubeShorts: candidate.deterministicScore,
          instagramReels: candidate.deterministicScore,
          tiktok: candidate.deterministicScore,
          x: candidate.deterministicScore,
        },
        finalScore: candidate.deterministicScore,
      }));

    return {
      selected,
      overallWarnings: [
        "OpenRouter reranking unavailable; used deterministic candidate ranking.",
        ...failures,
      ],
      model: params.modelPolicy?.primaryModel ?? params.model ?? "deterministic_fallback",
    };
  }
}
