import type { ViralityPrediction } from "@/lib/ai/snipradar-analyzer";

export type VariantObjective = "balanced" | "reach" | "replies" | "follows" | "conversion";

export type VariantLabCandidate = {
  id: string;
  label: string;
  strategyFocus: string;
  text: string;
  reasoning: string;
  prediction: ViralityPrediction;
  objectiveScores: Record<VariantObjective, number>;
  winnerReasons: string[];
  isBaseline?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value, 1, 100));
}

function countPattern(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length;
}

function scoreConversionIntent(text: string) {
  const normalized = text.toLowerCase();
  let score = 42;

  if (/(join|sign up|get access|waitlist|dm|book|apply|download|try)/.test(normalized)) score += 22;
  if (/(link in bio|link below|limited|spots|beta|free|today)/.test(normalized)) score += 18;
  if (/(how to|here's|this is how|use this)/.test(normalized)) score += 8;
  if (normalized.includes("?")) score += 4;
  if (normalized.length >= 90 && normalized.length <= 220) score += 8;

  return roundScore(score);
}

function scoreFollowIntent(text: string) {
  const normalized = text.toLowerCase();
  let score = 30;

  if (/(i learned|here's what|behind the scenes|breakdown|playbook|framework|lesson)/.test(normalized)) score += 16;
  if (/\b(i|we)\b/.test(normalized)) score += 8;
  if (/[0-9]/.test(normalized)) score += 10;
  if (/(founder|creator|operator|building|shipped|grew)/.test(normalized)) score += 14;
  if (normalized.length >= 80 && normalized.length <= 220) score += 6;

  return roundScore(score);
}

export function computeObjectiveScores(
  prediction: ViralityPrediction,
  text: string
): Record<VariantObjective, number> {
  const followIntent = scoreFollowIntent(text);
  const conversionIntent = scoreConversionIntent(text);

  return {
    balanced: roundScore(
      prediction.score * 0.55 +
        prediction.breakdown.hook * 0.1 +
        prediction.breakdown.share * 0.1 +
        prediction.breakdown.reply * 0.1 +
        prediction.breakdown.timing * 0.05 +
        prediction.breakdown.emotion * 0.1
    ),
    reach: roundScore(
      prediction.breakdown.hook * 0.32 +
        prediction.breakdown.share * 0.28 +
        prediction.breakdown.emotion * 0.18 +
        prediction.breakdown.timing * 0.14 +
        prediction.score * 0.08
    ),
    replies: roundScore(
      prediction.breakdown.reply * 0.35 +
        prediction.breakdown.hook * 0.2 +
        prediction.breakdown.emotion * 0.18 +
        prediction.breakdown.share * 0.12 +
        prediction.breakdown.timing * 0.15
    ),
    follows: roundScore(
      followIntent * 0.32 +
        prediction.breakdown.hook * 0.2 +
        prediction.breakdown.share * 0.16 +
        prediction.breakdown.emotion * 0.12 +
        prediction.breakdown.reply * 0.08 +
        prediction.score * 0.12
    ),
    conversion: roundScore(
      conversionIntent * 0.36 +
        prediction.breakdown.hook * 0.18 +
        prediction.breakdown.share * 0.14 +
        prediction.breakdown.emotion * 0.1 +
        prediction.breakdown.reply * 0.08 +
        prediction.breakdown.timing * 0.04 +
        prediction.score * 0.1
    ),
  };
}

export function buildWinnerReasons(
  candidate: Pick<VariantLabCandidate, "strategyFocus" | "prediction" | "objectiveScores">,
  objective: VariantObjective,
) {
  const reasons = [`Best fit for ${objective} objective`];
  const { breakdown } = candidate.prediction;

  const dimensionEntries = [
    ["hook", breakdown.hook],
    ["emotion", breakdown.emotion],
    ["share", breakdown.share],
    ["reply", breakdown.reply],
    ["timing", breakdown.timing],
  ] as const;
  const sortedDimensions = [...dimensionEntries].sort((a, b) => b[1] - a[1]);
  const top = sortedDimensions[0];
  if (top && top[1] >= 70) {
    reasons.push(`Strong ${top[0]} signal (${top[1]}/100)`);
  }
  if (candidate.strategyFocus) {
    reasons.push(candidate.strategyFocus);
  }
  return reasons.slice(0, 3);
}

export function pickRecommendedVariant(
  candidates: VariantLabCandidate[],
  objective: VariantObjective
) {
  const ranked = [...candidates].sort((left, right) => {
    return (
      right.objectiveScores[objective] - left.objectiveScores[objective] ||
      right.objectiveScores.balanced - left.objectiveScores.balanced ||
      right.prediction.score - left.prediction.score
    );
  });

  return ranked[0] ?? null;
}

function trimToTweetLimit(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 280);
}

function removeTrailingPunctuation(text: string) {
  return text.replace(/[.!?]+$/, "").trim();
}

export function buildFallbackVariants(baseText: string) {
  const cleaned = trimToTweetLimit(baseText);
  const stripped = removeTrailingPunctuation(cleaned);
  const firstSentence = stripped.split(/(?<=[.!?])\s+/)[0] ?? stripped;

  const contrarianLead = stripped.toLowerCase().startsWith("unpopular opinion")
    ? stripped
    : `Unpopular opinion: ${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`;
  const questionLead = stripped.includes("?")
    ? stripped
    : `${firstSentence}? ${stripped.slice(firstSentence.length).trim() || "That is the real leverage most people miss."}`;
  const proofLead = /[0-9]/.test(stripped)
    ? stripped
    : `${stripped} Here's the proof: one focused system beats random posting every time.`;
  const ctaLead = /(join|get access|waitlist|dm|link)/i.test(stripped)
    ? stripped
    : `${stripped} If you want the playbook, join the waitlist via the link in bio.`;

  return [
    {
      id: "baseline",
      label: "Current draft",
      strategyFocus: "Current baseline",
      text: cleaned,
      reasoning: "This is your current draft, scored as the baseline for comparison.",
      isBaseline: true,
    },
    {
      id: "contrarian",
      label: "Contrarian angle",
      strategyFocus: "Sharper disagreement hook for broader reach",
      text: trimToTweetLimit(contrarianLead),
      reasoning: "Leads with tension to improve stopping power and quote-tweet potential.",
    },
    {
      id: "question",
      label: "Reply magnet",
      strategyFocus: "Question-led framing to invite responses",
      text: trimToTweetLimit(questionLead),
      reasoning: "Turns the core idea into a prompt that should pull more replies and discussion.",
    },
    {
      id: "proof",
      label: "Authority proof",
      strategyFocus: "Adds evidence and specificity for follows",
      text: trimToTweetLimit(proofLead),
      reasoning: "Pushes proof and specificity so the post feels more credible and follow-worthy.",
    },
    {
      id: "cta",
      label: "Conversion CTA",
      strategyFocus: "Direct next-step framing for conversions",
      text: trimToTweetLimit(ctaLead),
      reasoning: "Adds a clearer next action so the post can convert traffic instead of only earning impressions.",
    },
  ].filter((variant, index, variants) => {
    const normalized = variant.text.toLowerCase();
    return normalized.length >= 10 && variants.findIndex((item) => item.text.toLowerCase() === normalized) === index;
  });
}

export function estimateFallbackPrediction(text: string): ViralityPrediction {
  const normalized = text.toLowerCase();
  const hasQuestion = normalized.includes("?");
  const numbers = countPattern(normalized, /\b\d+(\.\d+)?\b/g);
  const listMarkers = countPattern(normalized, /\b(1\.|2\.|3\.|first|second|third)\b/g);
  const ctaWords = countPattern(normalized, /\b(join|sign up|get access|waitlist|dm|download|try)\b/g);
  const controversyWords = countPattern(normalized, /\b(unpopular opinion|wrong|mistake|stop|myth)\b/g);
  const proofWords = countPattern(normalized, /\b(proof|tested|results|grew|shipped|learned|case study)\b/g);
  const length = normalized.length;

  const hook = roundScore(38 + controversyWords * 10 + numbers * 6 + (hasQuestion ? 8 : 0) + (length < 220 ? 6 : 0));
  const emotion = roundScore(36 + controversyWords * 12 + proofWords * 7);
  const share = roundScore(34 + proofWords * 10 + numbers * 5 + listMarkers * 6);
  const reply = roundScore(30 + (hasQuestion ? 18 : 0) + controversyWords * 10);
  const timing = roundScore(42 + (length >= 60 && length <= 220 ? 10 : 0) + Math.min(8, ctaWords * 3));
  const score = roundScore(hook * 0.24 + emotion * 0.18 + share * 0.24 + reply * 0.18 + timing * 0.16);

  const dimensions = [
    ["hook", hook],
    ["emotion", emotion],
    ["share", share],
    ["reply", reply],
    ["timing", timing],
  ] as const;
  const weakest = [...dimensions].sort((a, b) => a[1] - b[1])[0];

  return {
    score,
    breakdown: { hook, emotion, share, reply, timing },
    suggestion:
      weakest[0] === "reply"
        ? "Add a sharper question or stronger opinion gap so more people feel invited to respond."
        : weakest[0] === "share"
          ? "Add one proof point, number, or takeaway worth passing along."
          : weakest[0] === "hook"
            ? "Tighten the opening line so it creates tension in the first 8-12 words."
            : weakest[0] === "emotion"
              ? "Push the emotional contrast harder with a clearer pain, surprise, or payoff."
              : "Make the post feel more current or easier to act on right now.",
  };
}

export function buildVariantLabSummary(
  candidates: VariantLabCandidate[],
  objective: VariantObjective,
  winnerId: string | null
) {
  if (candidates.length === 0) {
    return "No variants available yet.";
  }

  const winner = candidates.find((candidate) => candidate.id === winnerId) ?? candidates[0];
  const baseline = candidates.find((candidate) => candidate.isBaseline) ?? candidates[0];
  const delta = winner.objectiveScores[objective] - baseline.objectiveScores[objective];

  return delta > 0
    ? `${winner.label} is the best option for ${objective}. It leads the baseline by ${delta} points on the target objective while keeping a ${winner.prediction.score}/100 overall score.`
    : `${winner.label} currently leads for ${objective}. The variants are close, so pick based on tone preference and use the winner reasons as the deciding factor.`;
}
