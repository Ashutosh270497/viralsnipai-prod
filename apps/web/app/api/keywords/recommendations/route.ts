export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeSearchIntent } from "@/lib/algorithms/competition-score";
import {
  dedupeKeywordsLocaleAware,
  generateLocaleVariants,
  normalizeKeywordForLocale,
} from "@/lib/keywords/localization";
import {
  buildOutcomeSignalProfile,
  extractOutcomeTokens,
  scoreKeywordAgainstOutcome,
} from "@/lib/keywords/outcome-feedback";
import {
  checkKeywordQuota,
  projectUsageAfterConsume,
  recordKeywordUsage,
} from "@/lib/keywords/monetization";

type Intent = "informational" | "transactional" | "navigational";

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

function scoreRecord(record: {
  avgViews: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  competition: number;
  trendDirection: string | null;
  difficulty: string;
  isSaved: boolean;
}): number {
  const views = record.avgViews ?? 0;
  const likes = record.avgLikes ?? 0;
  const comments = record.avgComments ?? 0;
  const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

  const viewScore = Math.min(100, Math.round((Math.log10(Math.max(views, 1)) / 6) * 100));
  const engagementScore = Math.min(100, Math.round(engagementRate * 10));
  const competitionEase = Math.max(0, 100 - record.competition);

  const trendBonus =
    record.trendDirection === "rising" ? 10 : record.trendDirection === "stable" ? 4 : 0;

  const difficultyBonus = record.difficulty === "easy" ? 8 : record.difficulty === "medium" ? 4 : 0;

  return Math.round(
    viewScore * 0.4 +
      engagementScore * 0.25 +
      competitionEase * 0.25 +
      trendBonus +
      difficultyBonus +
      (record.isSaved ? 3 : 0),
  );
}

function extractTokens(keyword: string): string[] {
  return extractOutcomeTokens(keyword);
}

function confidenceFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const country = (searchParams.get("country") ?? "IN").toUpperCase();
    const language = (searchParams.get("language") ?? "en").toLowerCase();
    const recommendationQuota = await checkKeywordQuota(userId, "recommendations");

    if (!recommendationQuota.allowed) {
      return NextResponse.json(
        {
          error: "Personalized recommendations limit reached for this billing period.",
          message:
            recommendationQuota.tier === "free"
              ? "Upgrade to Starter to generate more personalized keyword opportunities."
              : "Upgrade your plan to unlock higher recommendation limits.",
          usage: recommendationQuota,
          upgrade: {
            required: true,
            targetPlan: recommendationQuota.tier === "free" ? "starter" : "creator",
            path: "/pricing",
          },
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const usageAfterRecommendation = projectUsageAfterConsume(recommendationQuota, 1);

    if (!(prisma as any).keywordResearch) {
      return NextResponse.json(
        { recommendations: [], message: "Keyword research model unavailable" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const history = await prisma.keywordResearch.findMany({
      where: {
        userId,
        lastUpdated: {
          gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { lastUpdated: "desc" },
      take: 300,
    });

    if (history.length === 0) {
      try {
        await recordKeywordUsage(userId, "recommendations", {
          recommendationsCount: 0,
          reason: "insufficient_history",
          country,
          language,
        });
      } catch (usageError) {
        console.warn("[Keywords] Recommendations usage log failed:", usageError);
      }
      return NextResponse.json(
        {
          recommendations: [],
          profile: {
            confidence: "low",
            searchedKeywords: 0,
            outcomeSignalsUsed: 0,
            feedbackWeight: 0,
            rollingWindowDays: 180,
            avgOutcomeScore: 0,
            dominantOutcomeIntent: "informational",
            dominantIntent: "informational",
            topPatternTokens: [],
            topOutcomeTokens: [],
            country,
            language,
          },
          usage: usageAfterRecommendation,
          message: "Need more keyword history to personalize recommendations.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const weightedHistory = history.map((record) => ({
      record,
      score: scoreRecord(record),
    }));
    weightedHistory.sort((a, b) => b.score - a.score);
    const topHistory = weightedHistory.slice(0, 40);

    const intentWeights: Record<Intent, number> = {
      informational: 0,
      transactional: 0,
      navigational: 0,
    };

    const tokenWeights = new Map<string, number>();
    const candidateVotes = new Map<
      string,
      { votes: number; sources: Set<string>; sourceType: "history_related" | "pattern_generated" }
    >();

    for (const { record, score } of topHistory) {
      const intent = (record.searchIntent as Intent | null) ?? analyzeSearchIntent(record.keyword);
      intentWeights[intent] += score;

      for (const token of extractTokens(record.keyword)) {
        tokenWeights.set(token, (tokenWeights.get(token) ?? 0) + score);
      }

      const related = parseJsonArray(record.relatedKeywords).slice(0, 20);
      for (const rawKeyword of related) {
        const keyword = normalizeKeywordForLocale(rawKeyword);
        if (!keyword || keyword === normalizeKeywordForLocale(record.keyword)) continue;

        const existing = candidateVotes.get(keyword);
        if (existing) {
          existing.votes += score;
          existing.sources.add(record.keyword);
        } else {
          candidateVotes.set(keyword, {
            votes: score,
            sources: new Set([record.keyword]),
            sourceType: "history_related",
          });
        }
      }
    }

    const outcomeProfile = await buildOutcomeSignalProfile({ userId });
    for (const [token, score] of outcomeProfile.tokenWeights.entries()) {
      tokenWeights.set(token, (tokenWeights.get(token) ?? 0) + Math.round(score * 0.55));
    }

    const topTokens = [...tokenWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([token]) => token);

    const patternSuggestions = new Set<string>();
    for (const token of topTokens) {
      patternSuggestions.add(`${token} tutorial`);
      patternSuggestions.add(`how to ${token}`);
      patternSuggestions.add(`${token} for beginners`);
      patternSuggestions.add(`${token} tips`);
      patternSuggestions.add(`best ${token}`);
    }

    for (const suggestion of patternSuggestions) {
      const keyword = normalizeKeywordForLocale(suggestion);
      const existing = candidateVotes.get(keyword);
      if (existing) {
        existing.votes += 15;
      } else {
        candidateVotes.set(keyword, {
          votes: 15,
          sources: new Set(["pattern_model"]),
          sourceType: "pattern_generated",
        });
      }
    }

    const localeVariants = dedupeKeywordsLocaleAware(
      [...candidateVotes.keys()].flatMap((keyword) =>
        generateLocaleVariants({ keyword, country, language }),
      ),
    );
    for (const variant of localeVariants) {
      const existing = candidateVotes.get(variant);
      if (existing) {
        existing.votes += country === "IN" ? 6 : 2;
      } else {
        candidateVotes.set(variant, {
          votes: country === "IN" ? 6 : 2,
          sources: new Set(["locale_variant"]),
          sourceType: "pattern_generated",
        });
      }
    }

    const candidates = [...candidateVotes.entries()];
    if (candidates.length === 0) {
      try {
        await recordKeywordUsage(userId, "recommendations", {
          recommendationsCount: 0,
          reason: "no_candidates",
          country,
          language,
        });
      } catch (usageError) {
        console.warn("[Keywords] Recommendations usage log failed:", usageError);
      }
      return NextResponse.json(
        {
          recommendations: [],
          profile: {
            confidence: "low",
            searchedKeywords: history.length,
            outcomeSignalsUsed: outcomeProfile.outcomeSignalsUsed,
            feedbackWeight: outcomeProfile.feedbackWeight,
            rollingWindowDays: outcomeProfile.windowDays,
            avgOutcomeScore: outcomeProfile.avgOutcomeScore,
            dominantOutcomeIntent: outcomeProfile.dominantOutcomeIntent,
            dominantIntent: "informational",
            topPatternTokens: topTokens.slice(0, 8),
            topOutcomeTokens: outcomeProfile.topOutcomeTokens.slice(0, 8),
            country,
            language,
          },
          usage: usageAfterRecommendation,
          message: "No recommendation candidates generated yet.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const maxVotes = Math.max(...candidates.map(([, data]) => data.votes), 1);
    const maxIntentWeight = Math.max(...Object.values(intentWeights), 1);

    const recommendations = candidates
      .map(([keyword, data]) => {
        const normalized = normalizeKeywordForLocale(keyword);
        const tokens = extractTokens(normalized);
        const overlapCount = tokens.filter((t) => topTokens.includes(t)).length;
        const overlapScore = Math.min(30, overlapCount * 8);

        const predictedIntent = analyzeSearchIntent(normalized);
        const intentFit = (intentWeights[predictedIntent] / maxIntentWeight) * 25;
        const voteScore = (data.votes / maxVotes) * 45;
        const outcomeFit = scoreKeywordAgainstOutcome(outcomeProfile, normalized);
        const outcomeBoost = Math.round(
          outcomeFit.adjustment * (1 + outcomeProfile.feedbackWeight),
        );

        const regionScore =
          country === "IN"
            ? normalized.includes("hindi") || normalized.includes("india")
              ? 8
              : 3
            : 0;

        const personalizedScore = Math.max(
          1,
          Math.min(
            100,
            Math.round(voteScore + overlapScore + intentFit + regionScore + outcomeBoost),
          ),
        );

        return {
          keyword: normalized,
          personalizedScore,
          confidence: confidenceFromScore(personalizedScore),
          predictedIntent,
          sourceType: data.sourceType,
          rationale: [
            data.sourceType === "history_related"
              ? "Derived from your high-performing related keyword history"
              : "Generated from your recurring keyword patterns",
            overlapCount > 0
              ? `Matches ${overlapCount} strong pattern token(s)`
              : "Broad topical match",
            `Intent fit: ${predictedIntent}`,
            outcomeProfile.feedbackWeight > 0
              ? `Outcome model fit: ${outcomeFit.creatorFitScore}/100`
              : "Outcome model warming up",
          ].join(" · "),
          seedKeywords: [...data.sources].slice(0, 3),
          outcomeFitScore: outcomeFit.creatorFitScore,
        };
      })
      .filter((item) => item.keyword.length >= 3)
      .sort((a, b) => b.personalizedScore - a.personalizedScore)
      .slice(0, 25);

    const dominantIntent = (Object.entries(intentWeights).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "informational") as Intent;

    const avgTopScore =
      recommendations.length > 0
        ? Math.round(
            recommendations.reduce((sum, r) => sum + r.personalizedScore, 0) /
              recommendations.length,
          )
        : 0;

    try {
      await recordKeywordUsage(userId, "recommendations", {
        recommendationsCount: recommendations.length,
        country,
        language,
      });
    } catch (usageError) {
      console.warn("[Keywords] Recommendations usage log failed:", usageError);
    }

    return NextResponse.json(
      {
        recommendations,
        profile: {
          confidence: confidenceFromScore(avgTopScore),
          searchedKeywords: history.length,
          outcomeSignalsUsed: outcomeProfile.outcomeSignalsUsed,
          feedbackWeight: outcomeProfile.feedbackWeight,
          rollingWindowDays: outcomeProfile.windowDays,
          avgOutcomeScore: outcomeProfile.avgOutcomeScore,
          dominantOutcomeIntent: outcomeProfile.dominantOutcomeIntent,
          topOutcomeTokens: outcomeProfile.topOutcomeTokens.slice(0, 8),
          dominantIntent,
          topPatternTokens: topTokens.slice(0, 8),
          country,
          language,
        },
        usage: usageAfterRecommendation,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Keywords] Recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate keyword recommendations" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
