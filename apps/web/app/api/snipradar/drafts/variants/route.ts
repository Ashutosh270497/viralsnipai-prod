export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  generateVariantCandidates,
  predictVirality,
  scoreVariantCandidates,
  type ViralityPrediction,
} from "@/lib/ai/snipradar-analyzer";
import { getCurrentUser } from "@/lib/auth";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import { requireSnipRadarFeature } from "@/lib/snipradar/billing-gates-server";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import {
  buildFallbackVariants,
  buildVariantLabSummary,
  buildWinnerReasons,
  computeObjectiveScores,
  estimateFallbackPrediction,
  pickRecommendedVariant,
  type VariantLabCandidate,
  type VariantObjective,
} from "@/lib/snipradar/variant-lab";

const requestSchema = z.object({
  text: z.string().min(10).max(280),
  niche: z.string().min(2).max(60).optional(),
  followerCount: z.number().int().nonnegative().optional(),
  objective: z.enum(["balanced", "reach", "replies", "follows", "conversion"]).optional(),
  count: z.number().int().min(2).max(SNIPRADAR.VARIANT_LAB_MAX_VARIANTS).optional(),
});

type VariantResponse = {
  objective: VariantObjective;
  summary: string;
  recommendedVariantId: string | null;
  variants: VariantLabCandidate[];
};

type VariantSeed = {
  id: string;
  label: string;
  strategyFocus: string;
  text: string;
  reasoning: string;
  isBaseline?: boolean;
};

/**
 * POST /api/snipradar/drafts/variants
 * Generate and compare publish-ready draft variants
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await requireSnipRadarFeature(
      user.id,
      "variantLab",
      "Variant Lab is available on Plus and Pro plans."
    );
    if (!gate.ok) {
      return gate.response;
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:drafts:variants", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: Math.max(3, Math.floor(SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS / 2)),
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating another variant batch." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid variant payload" },
        { status: 400 }
      );
    }

    const text = parsed.data.text.trim();
    const objective = parsed.data.objective ?? "balanced";
    const count = parsed.data.count ?? 3;
    const niche = parsed.data.niche?.trim() || undefined;
    const followerCount = parsed.data.followerCount;

    const fallbackVariants = buildFallbackVariants(text);
    const aiVariants = await generateVariantCandidates({
      text,
      niche,
      followerCount,
      count,
    });

    const baseVariants: VariantSeed[] = [
      fallbackVariants[0],
      ...aiVariants.map((variant, index) => ({
        id: `ai-${index + 1}`,
        label: variant.label,
        strategyFocus: variant.strategyFocus,
        text: variant.text,
        reasoning: variant.reasoning,
        isBaseline: false,
      })),
    ]
      .filter((variant): variant is VariantSeed => Boolean(variant))
      .filter((variant, index, variants) => {
        const normalized = variant.text.toLowerCase();
        return variants.findIndex((item) => item.text.toLowerCase() === normalized) === index;
      });

    const candidatePool: VariantSeed[] =
      baseVariants.length >= 2
        ? baseVariants
        : fallbackVariants.slice(0, SNIPRADAR.VARIANT_LAB_MAX_VARIANTS);

    const aiScores = await scoreVariantCandidates({
      variants: candidatePool.map((variant) => ({ id: variant.id, text: variant.text })),
      niche,
      followerCount,
    });

    const variants: VariantLabCandidate[] = [];
    for (const variant of candidatePool) {
      const prediction: ViralityPrediction =
        aiScores[variant.id] ??
        (variant.isBaseline
          ? (await predictVirality({ text: variant.text, niche, followerCount })) ?? estimateFallbackPrediction(variant.text)
          : estimateFallbackPrediction(variant.text));

      const objectiveScores = computeObjectiveScores(prediction, variant.text);
      variants.push({
        ...variant,
        prediction,
        objectiveScores,
        winnerReasons: [],
      });
    }

    const recommended = pickRecommendedVariant(variants, objective);
    const responseVariants = variants.map((variant) => ({
      ...variant,
      winnerReasons: buildWinnerReasons(variant, objective),
    }));

    const response: VariantResponse = {
      objective,
      summary: buildVariantLabSummary(responseVariants, objective, recommended?.id ?? null),
      recommendedVariantId: recommended?.id ?? null,
      variants: responseVariants,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    if (error?.message?.startsWith("RATE_LIMIT:")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Try again in a few minutes." },
        { status: 429 }
      );
    }
    console.error("[SnipRadar Variant Lab] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate variants" },
      { status: 500 }
    );
  }
}
