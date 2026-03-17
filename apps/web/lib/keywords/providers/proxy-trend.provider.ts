import type { TrendProvider } from "@/lib/keywords/providers/interfaces";

export class ProxyTrendProvider implements TrendProvider {
  async getTrend({ metrics }: Parameters<TrendProvider["getTrend"]>[0]) {
    const trendDirection: "rising" | "stable" | "falling" =
      metrics.averageVideoAge < 30
        ? "rising"
        : metrics.averageVideoAge < 90
          ? "stable"
          : "falling";

    return {
      trendDirection,
      qualityWarning:
        "Trend direction is inferred from top-video recency and not from a dedicated trend API.",
    };
  }
}

