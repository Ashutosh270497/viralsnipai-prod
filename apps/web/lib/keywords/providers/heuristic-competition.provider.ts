import {
  calculateCompetitionScore,
  calculateOpportunityScore,
} from "@/lib/algorithms/competition-score";
import type { CompetitionProvider } from "@/lib/keywords/providers/interfaces";

export class HeuristicCompetitionProvider implements CompetitionProvider {
  async getCompetition({
    searchResult,
    metrics,
  }: Parameters<CompetitionProvider["getCompetition"]>[0]) {
    return calculateCompetitionScore({
      totalResults: searchResult.totalResults,
      topChannelSize: metrics.avgChannelSize,
      avgViews: metrics.avgViews,
      uploadFrequency: Math.round(
        searchResult.videos.length /
          Math.max(1, metrics.averageVideoAge / 30)
      ),
      domainAuthority: Math.min(
        100,
        Math.round(metrics.topChannelDominance * 2)
      ),
      videoAge: metrics.averageVideoAge,
      engagementRate: metrics.engagementRate,
    });
  }

  async getOpportunityScore({
    query,
    competition,
    searchVolume,
  }: Parameters<CompetitionProvider["getOpportunityScore"]>[0]) {
    const base = calculateOpportunityScore(competition, searchVolume);

    let multiplier = 1;
    if (query.country.toUpperCase() === "IN") {
      multiplier += 0.06;
      if (query.language.toLowerCase() === "hi") {
        multiplier += 0.04;
      }
    }

    return Math.max(1, Math.min(100, Math.round(base * multiplier)));
  }
}
