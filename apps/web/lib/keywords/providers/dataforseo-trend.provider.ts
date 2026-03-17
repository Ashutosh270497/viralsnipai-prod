import type { TrendProvider } from "@/lib/keywords/providers/interfaces";
import { ProxyTrendProvider } from "@/lib/keywords/providers/proxy-trend.provider";
import {
  dataForSeoPost,
  mapCountryToLocationCode,
  mapLanguageToCode,
  resolveDataForSeoContext,
} from "@/lib/keywords/providers/dataforseo-client";

interface DataForSeoTrendsResult {
  values?: Array<{
    value?: number;
  }>;
}

function classifyTrend(values: number[]): "rising" | "stable" | "falling" {
  if (values.length < 2) return "stable";
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const delta = last - first;
  const pct = first > 0 ? delta / first : 0;
  if (pct > 0.15) return "rising";
  if (pct < -0.15) return "falling";
  return "stable";
}

export class DataForSeoTrendProvider implements TrendProvider {
  private readonly fallback = new ProxyTrendProvider();

  async getTrend(input: Parameters<TrendProvider["getTrend"]>[0]) {
    const context = resolveDataForSeoContext();
    if (!context) {
      const fallback = await this.fallback.getTrend(input);
      return {
        ...fallback,
        qualityWarning:
          "DATAFORSEO credentials missing. Using recency-inferred trend fallback.",
      };
    }

    try {
      const payload = [
        {
          keywords: [input.query.keyword],
          location_code: mapCountryToLocationCode(input.query.country),
          language_code: mapLanguageToCode(input.query.language),
        },
      ];

      const response = await dataForSeoPost<DataForSeoTrendsResult>({
        endpoint: "/v3/keywords_data/google_trends/explore/live",
        context,
        payload,
      });

      const rawValues =
        response?.tasks?.[0]?.result?.[0]?.values
          ?.map((v) => v.value)
          .filter((v): v is number => typeof v === "number") ?? [];

      if (rawValues.length > 1) {
        return {
          trendDirection: classifyTrend(rawValues),
        };
      }

      const fallback = await this.fallback.getTrend(input);
      return {
        ...fallback,
        qualityWarning:
          "DataForSEO Trends did not return a usable timeseries. Using recency-inferred trend fallback.",
      };
    } catch {
      const fallback = await this.fallback.getTrend(input);
      return {
        ...fallback,
        qualityWarning:
          "DataForSEO Trends request failed. Using recency-inferred trend fallback.",
      };
    }
  }
}

