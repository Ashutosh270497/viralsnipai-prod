import {
  buildFallbackVariants,
  computeObjectiveScores,
  estimateFallbackPrediction,
  pickRecommendedVariant,
  type VariantLabCandidate,
} from "@/lib/snipradar/variant-lab";

describe("variant lab scoring", () => {
  it("gives CTA-heavy posts a stronger conversion score than reply score", () => {
    const prediction = estimateFallbackPrediction(
      "We turned one creator workflow into a repeatable system. Join the beta waitlist via the link in bio."
    );

    const scores = computeObjectiveScores(prediction, "Join the beta waitlist via the link in bio today.");

    expect(scores.conversion).toBeGreaterThan(scores.replies);
    expect(scores.conversion).toBeGreaterThanOrEqual(50);
  });

  it("picks the best candidate for the chosen objective", () => {
    const candidates: VariantLabCandidate[] = [
      {
        id: "baseline",
        label: "Baseline",
        strategyFocus: "Current draft",
        text: "Current draft",
        reasoning: "Current draft",
        prediction: estimateFallbackPrediction("Current draft"),
        objectiveScores: {
          balanced: 58,
          reach: 55,
          replies: 48,
          follows: 52,
          conversion: 44,
        },
        winnerReasons: [],
        isBaseline: true,
      },
      {
        id: "reply",
        label: "Reply magnet",
        strategyFocus: "Question-led framing",
        text: "What if the thing killing your growth is the tactic everyone keeps copying?",
        reasoning: "Question-led framing",
        prediction: estimateFallbackPrediction(
          "What if the thing killing your growth is the tactic everyone keeps copying?"
        ),
        objectiveScores: {
          balanced: 71,
          reach: 68,
          replies: 83,
          follows: 69,
          conversion: 50,
        },
        winnerReasons: [],
      },
    ];

    expect(pickRecommendedVariant(candidates, "replies")?.id).toBe("reply");
    expect(pickRecommendedVariant(candidates, "balanced")?.id).toBe("reply");
  });

  it("builds a deduplicated fallback set that includes the baseline", () => {
    const variants = buildFallbackVariants("Creators keep posting more when they should be sharpening the hook.");

    expect(variants[0]?.id).toBe("baseline");
    expect(variants.length).toBeGreaterThanOrEqual(3);
    expect(new Set(variants.map((variant) => variant.text.toLowerCase())).size).toBe(variants.length);
  });
});
