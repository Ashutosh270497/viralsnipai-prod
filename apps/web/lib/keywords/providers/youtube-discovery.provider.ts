import {
  calculateKeywordMetrics,
  type KeywordSearchResult,
  searchKeyword,
} from "@/lib/integrations/youtube-keywords";
import { buildKeywordDiscoveryQueries } from "@/lib/keywords/discovery-expansion";
import type { DiscoveryProvider } from "@/lib/keywords/providers/interfaces";
import type { KeywordResearchMetrics, KeywordResearchQuery } from "@/lib/keywords/types";

const DEFAULT_MAX_EXPANSIONS = 8;
const DEFAULT_MAX_RESULTS_PER_QUERY = 12;
const DEFAULT_MAX_TOTAL_VIDEOS = 120;
const DEFAULT_DISCOVERY_TIMEOUT_MS = 9000;
const DEFAULT_DISCOVERY_CONCURRENCY = 4;

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function getEnvInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clampInt(parsed, min, max);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutRef: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutRef = setTimeout(() => reject(new Error("DISCOVERY_QUERY_TIMEOUT")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutRef) clearTimeout(timeoutRef);
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  const output: Array<PromiseSettledResult<R>> = new Array(items.length);
  let nextIndex = 0;

  const runner = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      try {
        const value = await worker(items[currentIndex]);
        output[currentIndex] = { status: "fulfilled", value };
      } catch (error) {
        output[currentIndex] = { status: "rejected", reason: error };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner())
  );
  return output;
}

export class YouTubeDiscoveryProvider implements DiscoveryProvider {
  async discover(
    query: KeywordResearchQuery,
    options?: {
      allowMockFallback?: boolean;
      maxExpansions?: number;
      maxResultsPerQuery?: number;
    }
  ): Promise<KeywordSearchResult> {
    const allowMockFallback = options?.allowMockFallback ?? true;
    const maxExpansions = clampInt(
      options?.maxExpansions ??
        getEnvInt(
          "KEYWORD_DISCOVERY_MAX_EXPANSIONS",
          DEFAULT_MAX_EXPANSIONS,
          1,
          24
        ),
      1,
      24
    );
    const maxResultsPerQuery = clampInt(
      options?.maxResultsPerQuery ??
        getEnvInt(
          "KEYWORD_DISCOVERY_RESULTS_PER_QUERY",
          DEFAULT_MAX_RESULTS_PER_QUERY,
          5,
          25
        ),
      5,
      25
    );
    const maxTotalVideos = getEnvInt(
      "KEYWORD_DISCOVERY_MAX_TOTAL_VIDEOS",
      DEFAULT_MAX_TOTAL_VIDEOS,
      20,
      250
    );
    const timeoutMs = getEnvInt(
      "KEYWORD_DISCOVERY_TIMEOUT_MS",
      DEFAULT_DISCOVERY_TIMEOUT_MS,
      2000,
      20000
    );
    const concurrency = getEnvInt(
      "KEYWORD_DISCOVERY_CONCURRENCY",
      DEFAULT_DISCOVERY_CONCURRENCY,
      1,
      8
    );

    const expanded = buildKeywordDiscoveryQueries({
      keyword: query.keyword,
      language: query.language,
      maxExpansions,
    });

    const settled = await runWithConcurrency(
      expanded.queries,
      concurrency,
      async (expandedQuery) => {
        const result = await withTimeout(
          searchKeyword(expandedQuery, maxResultsPerQuery, {
            regionCode: query.country.toUpperCase(),
            relevanceLanguage: query.language.toLowerCase(),
            allowMockFallback,
          }),
          timeoutMs
        );

        return {
          expandedQuery,
          result,
        };
      }
    );

    const successful = settled.filter(
      (item): item is PromiseFulfilledResult<{ expandedQuery: string; result: KeywordSearchResult }> =>
        item.status === "fulfilled"
    );
    const failedCount = settled.length - successful.length;

    if (successful.length === 0) {
      throw new Error("YOUTUBE_API_SEARCH_FAILED");
    }

    const warnings = new Set<string>();
    const mergedVideos: KeywordSearchResult["videos"] = [];
    const seenVideoIds = new Set<string>();

    for (const hit of successful) {
      for (const warning of hit.value.result.dataQuality.warnings) warnings.add(warning);
      for (const video of hit.value.result.videos) {
        const dedupeKey = video.videoId || `${video.channelId}:${video.title}`;
        if (!dedupeKey || seenVideoIds.has(dedupeKey)) continue;
        seenVideoIds.add(dedupeKey);
        mergedVideos.push(video);
        if (mergedVideos.length >= maxTotalVideos) break;
      }
      if (mergedVideos.length >= maxTotalVideos) break;
    }

    const hasYoutubeApiSource = successful.some(
      (hit) => hit.value.result.dataQuality.source === "youtube_api"
    );
    if (failedCount > 0) {
      warnings.add(
        `Partial discovery: ${failedCount} of ${expanded.queries.length} query expansions failed or timed out.`
      );
    }
    if (expanded.truncated) {
      warnings.add(
        `Discovery query set was truncated to ${expanded.queries.length} expansions by guardrails.`
      );
    }

    const totalResults = successful.reduce((maxTotal, hit) => {
      return Math.max(maxTotal, hit.value.result.totalResults);
    }, mergedVideos.length);

    const freshnessTimestamp = successful
      .map((hit) => hit.value.result.freshnessTimestamp)
      .filter(Boolean)
      .sort()
      .at(-1) ?? new Date().toISOString();

    return {
      keyword: query.keyword,
      totalResults,
      videos: mergedVideos,
      freshnessTimestamp,
      discoveryMetadata: {
        mode: "multi_query_expansion" as const,
        queriesTried: expanded.queries.length,
        queriesSucceeded: successful.length,
        queriesFailed: failedCount,
        truncated: expanded.truncated,
        maxExpansions,
        maxResultsPerQuery,
        maxVideosReturned: mergedVideos.length,
      },
      dataQuality: {
        source: hasYoutubeApiSource ? "youtube_api" : "mock",
        confidence: hasYoutubeApiSource
          ? failedCount === 0
            ? "high"
            : "medium"
          : "low",
        warnings: Array.from(warnings),
      },
    };
  }

  static extractMetricsFromSearchResult(
    searchResult: KeywordSearchResult
  ): KeywordResearchMetrics {
    return calculateKeywordMetrics(searchResult);
  }
}
