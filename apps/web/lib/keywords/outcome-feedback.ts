import { analyzeSearchIntent } from "@/lib/algorithms/competition-score";
import { normalizeKeywordForLocale } from "@/lib/keywords/localization";
import { prisma } from "@/lib/prisma";

type Intent = "informational" | "transactional" | "navigational";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "your",
]);

function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function extractOutcomeTokens(input: string): string[] {
  return normalizeKeywordForLocale(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function scorePostedOutcome(record: {
  actualLikes: number | null;
  actualRetweets: number | null;
  actualReplies: number | null;
  actualImpressions: number | null;
}): number {
  const likes = record.actualLikes ?? 0;
  const retweets = record.actualRetweets ?? 0;
  const replies = record.actualReplies ?? 0;
  const impressions = record.actualImpressions ?? 0;
  if (impressions <= 0) return 0;

  const weightedEngagement = likes + retweets * 2 + replies * 2.5;
  const er = (weightedEngagement / impressions) * 100;
  const engagementScore = Math.min(100, Math.round(er * 20));
  const reachScore = Math.min(
    100,
    Math.round((Math.log10(Math.max(impressions, 1)) / 6) * 100)
  );
  return Math.round(engagementScore * 0.65 + reachScore * 0.35);
}

function ageDecayFactor(postedAt: Date | null, halfLifeDays: number): number {
  if (!postedAt) return 1;
  const ageDays = Math.max(
    0,
    (Date.now() - postedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const lambda = Math.log(2) / Math.max(1, halfLifeDays);
  return Math.exp(-lambda * ageDays);
}

export interface OutcomeSignalProfile {
  windowDays: number;
  outcomeSignalsUsed: number;
  feedbackWeight: number;
  avgOutcomeScore: number;
  topOutcomeTokens: string[];
  dominantOutcomeIntent: Intent;
  tokenWeights: Map<string, number>;
  intentWeights: Record<Intent, number>;
}

export interface OutcomeKeywordFeedback {
  creatorFitScore: number;
  tokenFitScore: number;
  intentFitScore: number;
  adjustment: number;
  matchedTokens: string[];
}

export async function buildOutcomeSignalProfile(params: {
  userId: string;
  windowDays?: number;
  maxRows?: number;
}): Promise<OutcomeSignalProfile> {
  const windowDays = params.windowDays ?? 180;
  const maxRows = params.maxRows ?? 500;
  const halfLifeDays = Math.max(14, Math.round(windowDays * 0.45));

  const postedSignals = await prisma.tweetDraft.findMany({
    where: {
      userId: params.userId,
      status: "posted",
      postedAt: { gte: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) },
      actualImpressions: { gt: 0 },
    },
    select: {
      text: true,
      postedAt: true,
      actualLikes: true,
      actualRetweets: true,
      actualReplies: true,
      actualImpressions: true,
    },
    take: maxRows,
  });

  const intentWeights: Record<Intent, number> = {
    informational: 0,
    transactional: 0,
    navigational: 0,
  };
  const tokenWeights = new Map<string, number>();
  let outcomeSignalsUsed = 0;
  let weightedScoreSum = 0;

  for (const draft of postedSignals) {
    const rawScore = scorePostedOutcome(draft);
    if (rawScore <= 0) continue;

    const decay = ageDecayFactor(draft.postedAt, halfLifeDays);
    const weightedScore = rawScore * decay;
    weightedScoreSum += weightedScore;
    outcomeSignalsUsed++;

    const intent = analyzeSearchIntent(draft.text);
    intentWeights[intent] += weightedScore;

    for (const token of extractOutcomeTokens(draft.text)) {
      tokenWeights.set(token, (tokenWeights.get(token) ?? 0) + weightedScore);
    }
  }

  const topOutcomeTokens = [...tokenWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([token]) => token);

  const dominantOutcomeIntent = (Object.entries(intentWeights).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] ?? "informational") as Intent;

  const feedbackWeight = Math.min(1, outcomeSignalsUsed / 60);
  const avgOutcomeScore =
    outcomeSignalsUsed > 0 ? Math.round(weightedScoreSum / outcomeSignalsUsed) : 0;

  return {
    windowDays,
    outcomeSignalsUsed,
    feedbackWeight,
    avgOutcomeScore,
    topOutcomeTokens,
    dominantOutcomeIntent,
    tokenWeights,
    intentWeights,
  };
}

export function scoreKeywordAgainstOutcome(
  profile: OutcomeSignalProfile,
  keyword: string
): OutcomeKeywordFeedback {
  if (profile.outcomeSignalsUsed === 0 || profile.feedbackWeight <= 0) {
    return {
      creatorFitScore: 50,
      tokenFitScore: 50,
      intentFitScore: 50,
      adjustment: 0,
      matchedTokens: [],
    };
  }

  const normalized = normalizeKeywordForLocale(keyword);
  const tokens = extractOutcomeTokens(normalized);
  const keywordIntent = analyzeSearchIntent(normalized);

  const maxTokenWeight = Math.max(...profile.tokenWeights.values(), 1);
  const tokenScores = tokens
    .map((token) => profile.tokenWeights.get(token) ?? 0)
    .filter((score) => score > 0);
  const tokenFitScore =
    tokenScores.length > 0
      ? clampScore(
          (tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length / maxTokenWeight) *
            100
        )
      : 45;

  const maxIntentWeight = Math.max(...Object.values(profile.intentWeights), 1);
  const intentFitScore = clampScore(
    ((profile.intentWeights[keywordIntent] ?? 0) / maxIntentWeight) * 100
  );

  const creatorFitScore = clampScore(tokenFitScore * 0.65 + intentFitScore * 0.35);
  const adjustment = Math.round(
    (creatorFitScore - 50) * 0.24 * profile.feedbackWeight
  );

  const matchedTokens = tokens
    .filter((token) => profile.tokenWeights.has(token))
    .sort(
      (a, b) =>
        (profile.tokenWeights.get(b) ?? 0) - (profile.tokenWeights.get(a) ?? 0)
    )
    .slice(0, 5);

  return {
    creatorFitScore,
    tokenFitScore,
    intentFitScore,
    adjustment,
    matchedTokens,
  };
}

