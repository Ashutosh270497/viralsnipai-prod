import type { KeywordSearchResult } from "@/lib/integrations/youtube-keywords";
import type {
  CompetitionComputation,
  KeywordDataQuality,
  KeywordResearchMetrics,
  KeywordResearchQuery,
} from "@/lib/keywords/types";

export interface DiscoveryProvider {
  discover(
    query: KeywordResearchQuery,
    options?: {
      allowMockFallback?: boolean;
      maxExpansions?: number;
      maxResultsPerQuery?: number;
    }
  ): Promise<KeywordSearchResult>;
}

export interface DemandProvider {
  getDemand(input: {
    query: KeywordResearchQuery;
    searchResult: KeywordSearchResult;
    metrics: KeywordResearchMetrics;
  }): Promise<{
    searchVolume: number;
    searchVolumeSource: string;
    quality: KeywordDataQuality;
  }>;
}

export interface TrendProvider {
  getTrend(input: {
    query: KeywordResearchQuery;
    searchResult: KeywordSearchResult;
    metrics: KeywordResearchMetrics;
  }): Promise<{
    trendDirection: "rising" | "stable" | "falling";
    qualityWarning?: string;
  }>;
}

export interface CompetitionProvider {
  getCompetition(input: {
    query: KeywordResearchQuery;
    searchResult: KeywordSearchResult;
    metrics: KeywordResearchMetrics;
  }): Promise<CompetitionComputation>;

  getOpportunityScore(input: {
    query: KeywordResearchQuery;
    competition: number;
    searchVolume: number;
  }): Promise<number>;
}
