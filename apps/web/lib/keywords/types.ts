import type { KeywordSearchResult } from "@/lib/integrations/youtube-keywords";

export interface KeywordResearchQuery {
  keyword: string;
  niche?: string;
  country: string;
  language: string;
}

export interface KeywordDataQuality {
  source: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

export interface KeywordDiscoveryMetadata {
  mode: "single_query" | "multi_query_expansion";
  queriesTried: number;
  queriesSucceeded: number;
  queriesFailed: number;
  truncated: boolean;
  maxExpansions?: number;
  maxResultsPerQuery: number;
  maxVideosReturned: number;
}

export interface KeywordResearchMetrics {
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgDuration: number;
  avgChannelSize: number;
  engagementRate: number;
  topChannelDominance: number;
  averageVideoAge: number;
}

export interface CompetitionComputation {
  score: number;
  difficulty: "easy" | "medium" | "hard";
  recommendation: string;
  breakdown: {
    saturationScore: number;
    authorityScore: number;
    engagementBarrier: number;
    freshnessScore: number;
    volumeScore: number;
  };
}

export interface OpportunityScoreFactorBreakdown {
  score: number;
  weight: number;
  weightedContribution: number;
  rationale: string;
}

export interface OpportunityScoreBreakdown {
  version: "v2";
  rawScore: number;
  confidencePenalty: number;
  finalScore: number;
  confidence: "high" | "medium" | "low";
  factors: {
    demand: OpportunityScoreFactorBreakdown;
    trend: OpportunityScoreFactorBreakdown;
    competitionInverse: OpportunityScoreFactorBreakdown;
    platformFit: OpportunityScoreFactorBreakdown;
    creatorFit: OpportunityScoreFactorBreakdown;
    contentGap: OpportunityScoreFactorBreakdown;
  };
  topDrivers: string[];
}

export interface KeywordResearchResult {
  keyword: string;
  searchVolume: number;
  searchVolumeSource: string;
  competition: CompetitionComputation;
  opportunityScore: number;
  scoreBreakdown: OpportunityScoreBreakdown;
  repurposeReadinessScore: number;
  trendDirection: "rising" | "stable" | "falling";
  searchIntent: "informational" | "transactional" | "navigational";
  platformFit: {
    youtube: number;
    x: number;
    instagram: number;
  };
  estimatedCPM: number;
  metrics: KeywordResearchMetrics;
  topVideos: Array<{
    videoId: string;
    title: string;
    channelTitle: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: string;
    thumbnailUrl: string;
  }>;
  relatedKeywords: string[];
  relatedKeywordClusters: Record<string, string[]>;
  dataQuality: KeywordDataQuality;
  localization: {
    normalizedKeyword: string;
    script: "latin" | "devanagari" | "mixed" | "unknown";
    localeVariants: string[];
    regionBoostApplied: boolean;
  };
  freshnessTimestamp: string;
  discoveryMetadata?: KeywordDiscoveryMetadata;
  rawSearchResult: KeywordSearchResult;
}
