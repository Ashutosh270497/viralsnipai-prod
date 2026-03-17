import { analyzeSearchIntent, estimateCPM, generateRelatedKeywordSuggestions } from "@/lib/algorithms/competition-score";
import {
  clusterKeywordsByRoot,
  dedupeKeywordsLocaleAware,
  detectKeywordScript,
  generateLocaleVariants,
  normalizeKeywordForLocale,
} from "@/lib/keywords/localization";
import type { CompetitionProvider, DemandProvider, DiscoveryProvider, TrendProvider } from "@/lib/keywords/providers/interfaces";
import { DataForSeoDemandProvider } from "@/lib/keywords/providers/dataforseo-demand.provider";
import { DataForSeoTrendProvider } from "@/lib/keywords/providers/dataforseo-trend.provider";
import { HeuristicCompetitionProvider } from "@/lib/keywords/providers/heuristic-competition.provider";
import { ProxyTrendProvider } from "@/lib/keywords/providers/proxy-trend.provider";
import { YouTubeDiscoveryProvider } from "@/lib/keywords/providers/youtube-discovery.provider";
import { YouTubeProxyDemandProvider } from "@/lib/keywords/providers/youtube-proxy-demand.provider";
import type {
  KeywordResearchQuery,
  KeywordResearchResult,
  OpportunityScoreBreakdown,
} from "@/lib/keywords/types";

interface OrchestratorDeps {
  discovery: DiscoveryProvider;
  demand: DemandProvider;
  trend: TrendProvider;
  competition: CompetitionProvider;
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function computePlatformFit(params: {
  trendDirection: "rising" | "stable" | "falling";
  searchIntent: "informational" | "transactional" | "navigational";
  metrics: { engagementRate: number; averageVideoAge: number; topChannelDominance: number };
  competitionScore: number;
}) {
  const { trendDirection, searchIntent, metrics, competitionScore } = params;
  const trendBoost = trendDirection === "rising" ? 14 : trendDirection === "stable" ? 7 : 2;
  const engagementBoost = Math.min(18, Math.round(metrics.engagementRate * 2));
  const freshnessBoost = metrics.averageVideoAge < 45 ? 10 : metrics.averageVideoAge < 120 ? 6 : 2;
  const competitionEase = 100 - competitionScore;

  const youtubeBase =
    40 +
    trendBoost +
    engagementBoost +
    Math.round(competitionEase * 0.25);
  const xBase =
    35 +
    trendBoost +
    Math.round(competitionEase * 0.22) +
    (searchIntent === "informational" ? 6 : 3);
  const instagramBase =
    33 +
    freshnessBoost +
    Math.round(competitionEase * 0.2) +
    (searchIntent === "navigational" ? 2 : 6);

  return {
    youtube: clampScore(youtubeBase),
    x: clampScore(xBase),
    instagram: clampScore(instagramBase),
  };
}

function computeRepurposeReadinessScore(params: {
  opportunityScore: number;
  platformFit: { youtube: number; x: number; instagram: number };
  trendDirection: "rising" | "stable" | "falling";
}) {
  const avgPlatformFit =
    (params.platformFit.youtube + params.platformFit.x + params.platformFit.instagram) / 3;
  const trendBonus = params.trendDirection === "rising" ? 8 : params.trendDirection === "stable" ? 4 : 0;
  return clampScore(params.opportunityScore * 0.65 + avgPlatformFit * 0.35 + trendBonus);
}

function computeDemandScore(searchVolume: number): number {
  return clampScore((Math.log10(Math.max(searchVolume, 1)) / 7) * 100);
}

function computeTrendScore(trendDirection: "rising" | "stable" | "falling"): number {
  if (trendDirection === "rising") return 85;
  if (trendDirection === "stable") return 60;
  return 35;
}

function computeCreatorFitScore(params: {
  searchIntent: "informational" | "transactional" | "navigational";
  platformFit: { youtube: number; x: number; instagram: number };
  metrics: { engagementRate: number };
  country: string;
  script: "latin" | "devanagari" | "mixed" | "unknown";
}): number {
  const intentBase =
    params.searchIntent === "informational"
      ? 72
      : params.searchIntent === "transactional"
        ? 62
        : 52;
  const avgPlatformFit =
    (params.platformFit.youtube + params.platformFit.x + params.platformFit.instagram) / 3;
  const engagementAdj = Math.min(8, Math.max(-8, Math.round((params.metrics.engagementRate - 3) * 1.5)));
  const regionAdj = params.country.toUpperCase() === "IN" ? 4 : 0;
  const scriptAdj = params.script === "mixed" ? -6 : 0;

  return clampScore(intentBase * 0.6 + avgPlatformFit * 0.4 + engagementAdj + regionAdj + scriptAdj);
}

function computeContentGapScore(competition: {
  breakdown: {
    saturationScore: number;
    authorityScore: number;
    freshnessScore: number;
  };
}): number {
  const saturationGap = 100 - competition.breakdown.saturationScore;
  const authorityGap = 100 - competition.breakdown.authorityScore;
  const freshnessGap = 100 - competition.breakdown.freshnessScore;
  return clampScore(saturationGap * 0.5 + authorityGap * 0.25 + freshnessGap * 0.25);
}

function getConfidencePenalty(confidence: "high" | "medium" | "low"): number {
  if (confidence === "medium") return 8;
  if (confidence === "low") return 16;
  return 0;
}

function computeOpportunityScoreV2(params: {
  searchVolume: number;
  trendDirection: "rising" | "stable" | "falling";
  competitionScore: number;
  competitionBreakdown: {
    saturationScore: number;
    authorityScore: number;
    freshnessScore: number;
  };
  platformFit: { youtube: number; x: number; instagram: number };
  searchIntent: "informational" | "transactional" | "navigational";
  metrics: { engagementRate: number };
  country: string;
  script: "latin" | "devanagari" | "mixed" | "unknown";
  confidence: "high" | "medium" | "low";
}): OpportunityScoreBreakdown {
  const weights = {
    demand: 0.22,
    trend: 0.15,
    competitionInverse: 0.2,
    platformFit: 0.18,
    creatorFit: 0.15,
    contentGap: 0.1,
  } as const;

  const demandScore = computeDemandScore(params.searchVolume);
  const trendScore = computeTrendScore(params.trendDirection);
  const competitionInverseScore = clampScore(100 - params.competitionScore);
  const platformFitScore = clampScore(
    (params.platformFit.youtube + params.platformFit.x + params.platformFit.instagram) / 3
  );
  const creatorFitScore = computeCreatorFitScore({
    searchIntent: params.searchIntent,
    platformFit: params.platformFit,
    metrics: params.metrics,
    country: params.country,
    script: params.script,
  });
  const contentGapScore = computeContentGapScore({
    breakdown: params.competitionBreakdown,
  });

  const rawScore =
    demandScore * weights.demand +
    trendScore * weights.trend +
    competitionInverseScore * weights.competitionInverse +
    platformFitScore * weights.platformFit +
    creatorFitScore * weights.creatorFit +
    contentGapScore * weights.contentGap;

  const confidencePenalty = getConfidencePenalty(params.confidence);
  const finalScore = clampScore(rawScore - confidencePenalty);

  const weighted = {
    demand: Number((demandScore * weights.demand).toFixed(2)),
    trend: Number((trendScore * weights.trend).toFixed(2)),
    competitionInverse: Number((competitionInverseScore * weights.competitionInverse).toFixed(2)),
    platformFit: Number((platformFitScore * weights.platformFit).toFixed(2)),
    creatorFit: Number((creatorFitScore * weights.creatorFit).toFixed(2)),
    contentGap: Number((contentGapScore * weights.contentGap).toFixed(2)),
  };

  const topDrivers = [
    { label: "demand", value: weighted.demand },
    { label: "competitionInverse", value: weighted.competitionInverse },
    { label: "platformFit", value: weighted.platformFit },
    { label: "creatorFit", value: weighted.creatorFit },
    { label: "trend", value: weighted.trend },
    { label: "contentGap", value: weighted.contentGap },
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((d) => d.label);

  return {
    version: "v2",
    rawScore: Number(rawScore.toFixed(2)),
    confidencePenalty,
    finalScore,
    confidence: params.confidence,
    factors: {
      demand: {
        score: demandScore,
        weight: weights.demand,
        weightedContribution: weighted.demand,
        rationale: "Higher validated demand increases addressable reach.",
      },
      trend: {
        score: trendScore,
        weight: weights.trend,
        weightedContribution: weighted.trend,
        rationale: "Rising trends get priority because timing compounds distribution.",
      },
      competitionInverse: {
        score: competitionInverseScore,
        weight: weights.competitionInverse,
        weightedContribution: weighted.competitionInverse,
        rationale: "Lower competition raises probability of winning distribution.",
      },
      platformFit: {
        score: platformFitScore,
        weight: weights.platformFit,
        weightedContribution: weighted.platformFit,
        rationale: "Cross-platform fit improves repurposing ROI across channels.",
      },
      creatorFit: {
        score: creatorFitScore,
        weight: weights.creatorFit,
        weightedContribution: weighted.creatorFit,
        rationale: "Intent and audience fit increase creator-specific conversion probability.",
      },
      contentGap: {
        score: contentGapScore,
        weight: weights.contentGap,
        weightedContribution: weighted.contentGap,
        rationale: "Content gap captures whitespace where fresh assets can outperform incumbents.",
      },
    },
    topDrivers,
  };
}

export class KeywordResearchOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async research(
    query: KeywordResearchQuery,
    options?: { allowMockFallback?: boolean }
  ): Promise<KeywordResearchResult> {
    const searchResult = await this.deps.discovery.discover(query, {
      allowMockFallback: options?.allowMockFallback ?? true,
    });

    const metrics = YouTubeDiscoveryProvider.extractMetricsFromSearchResult(searchResult);
    const demand = await this.deps.demand.getDemand({
      query,
      searchResult,
      metrics,
    });
    const competition = await this.deps.competition.getCompetition({
      query,
      searchResult,
      metrics,
    });
    const trend = await this.deps.trend.getTrend({
      query,
      searchResult,
      metrics,
    });

    const localeVariants = generateLocaleVariants(query);
    const relatedKeywords = dedupeKeywordsLocaleAware([
      ...localeVariants,
      ...generateRelatedKeywordSuggestions(query.keyword),
    ]);
    const relatedKeywordClusters = clusterKeywordsByRoot(relatedKeywords);
    const searchIntent = analyzeSearchIntent(query.keyword);
    const platformFit = computePlatformFit({
      trendDirection: trend.trendDirection,
      searchIntent,
      metrics,
      competitionScore: competition.score,
    });
    const warnings = [...demand.quality.warnings];
    if (trend.qualityWarning) warnings.push(trend.qualityWarning);
    const script = detectKeywordScript(query.keyword);
    if (script === "mixed") {
      warnings.push(
        "Detected mixed script keyword (Latin + Devanagari). Results may include blended intent."
      );
    }

    const scoreBreakdown = computeOpportunityScoreV2({
      searchVolume: demand.searchVolume,
      trendDirection: trend.trendDirection,
      competitionScore: competition.score,
      competitionBreakdown: {
        saturationScore: competition.breakdown.saturationScore,
        authorityScore: competition.breakdown.authorityScore,
        freshnessScore: competition.breakdown.freshnessScore,
      },
      platformFit,
      searchIntent,
      metrics: { engagementRate: metrics.engagementRate },
      country: query.country,
      script,
      confidence: demand.quality.confidence,
    });
    const opportunityScore = scoreBreakdown.finalScore;
    const repurposeReadinessScore = computeRepurposeReadinessScore({
      opportunityScore,
      platformFit,
      trendDirection: trend.trendDirection,
    });
    const estimatedCPM = estimateCPM(
      query.niche || "general",
      metrics.engagementRate,
      metrics.avgViews
    );

    const topVideos = searchResult.videos.slice(0, 10).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      publishedAt: v.publishedAt,
      thumbnailUrl: v.thumbnailUrl,
    }));

    return {
      keyword: query.keyword.toLowerCase(),
      searchVolume: demand.searchVolume,
      searchVolumeSource: demand.searchVolumeSource,
      competition,
      opportunityScore,
      scoreBreakdown,
      repurposeReadinessScore,
      trendDirection: trend.trendDirection,
      searchIntent,
      platformFit,
      estimatedCPM,
      metrics,
      topVideos,
      relatedKeywords,
      relatedKeywordClusters,
      dataQuality: {
        ...demand.quality,
        warnings: [...new Set(warnings)],
      },
      localization: {
        normalizedKeyword: normalizeKeywordForLocale(query.keyword),
        script,
        localeVariants,
        regionBoostApplied: query.country.toUpperCase() === "IN",
      },
      freshnessTimestamp: searchResult.freshnessTimestamp ?? new Date().toISOString(),
      discoveryMetadata: searchResult.discoveryMetadata,
      rawSearchResult: searchResult,
    };
  }
}

export function createDefaultKeywordResearchOrchestrator() {
  const useDataForSeo = !!(
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD
  );

  return new KeywordResearchOrchestrator({
    discovery: new YouTubeDiscoveryProvider(),
    demand: useDataForSeo
      ? new DataForSeoDemandProvider()
      : new YouTubeProxyDemandProvider(),
    trend: useDataForSeo ? new DataForSeoTrendProvider() : new ProxyTrendProvider(),
    competition: new HeuristicCompetitionProvider(),
  });
}

