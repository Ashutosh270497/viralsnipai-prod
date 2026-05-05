import { injectable } from "inversify";

import {
  rerankClipCandidates,
  type ClipRerankResult,
} from "@/lib/ai/providers/openrouter-reasoning-provider";
import type { ClipCandidate } from "@/lib/domain/services/ClipCandidateGenerationService";
import type { TranscriptPrecision } from "@/lib/ai/providers/openai-transcription-provider";

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
    model?: string;
  }): Promise<ClipRerankResult> {
    return rerankClipCandidates(params);
  }
}
