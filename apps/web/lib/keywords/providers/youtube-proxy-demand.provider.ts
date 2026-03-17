import type { DemandProvider } from "@/lib/keywords/providers/interfaces";

export class YouTubeProxyDemandProvider implements DemandProvider {
  async getDemand({ searchResult }: Parameters<DemandProvider["getDemand"]>[0]) {
    const source = searchResult.dataQuality.source;
    const warnings = [...searchResult.dataQuality.warnings];

    if (source === "youtube_api") {
      warnings.push(
        "Search volume is a YouTube result-count proxy and should be treated as directional demand."
      );
    }

    return {
      searchVolume: searchResult.totalResults,
      searchVolumeSource: "youtube_total_results_proxy",
      quality: {
        source: source === "youtube_api" ? "youtube_api_proxy" : "mock",
        confidence:
          source === "youtube_api"
            ? "medium"
            : "low",
        warnings,
      } as const,
    };
  }
}

