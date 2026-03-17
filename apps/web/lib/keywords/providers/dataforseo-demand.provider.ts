import type { DemandProvider } from "@/lib/keywords/providers/interfaces";
import {
  dataForSeoPost,
  mapCountryToLocationCode,
  mapLanguageToCode,
  resolveDataForSeoContext,
} from "@/lib/keywords/providers/dataforseo-client";
import { YouTubeProxyDemandProvider } from "@/lib/keywords/providers/youtube-proxy-demand.provider";

interface DataForSeoSearchVolumeResultItem {
  keyword?: string;
  search_volume?: number;
}

type Confidence = "high" | "medium" | "low";

export class DataForSeoDemandProvider implements DemandProvider {
  private readonly fallback = new YouTubeProxyDemandProvider();

  async getDemand(input: Parameters<DemandProvider["getDemand"]>[0]) {
    const context = resolveDataForSeoContext();
    if (!context) {
      const fallback = await this.fallback.getDemand(input);
      return {
        ...fallback,
        quality: {
          ...fallback.quality,
          confidence: "low" as Confidence,
          warnings: [
            ...fallback.quality.warnings,
            "DATAFORSEO credentials are missing. Using proxy demand fallback.",
          ],
        },
      };
    }

    try {
      const payload = [
        {
          keywords: [input.query.keyword],
          location_code: mapCountryToLocationCode(input.query.country),
          language_code: mapLanguageToCode(input.query.language),
          include_clickstream_data: true,
        },
      ];

      const response = await dataForSeoPost<DataForSeoSearchVolumeResultItem>({
        endpoint: "/v3/keywords_data/google_ads/search_volume/live",
        context,
        payload,
      });

      const volume =
        response?.tasks?.[0]?.result?.[0]?.search_volume;

      if (typeof volume === "number" && Number.isFinite(volume)) {
        return {
          searchVolume: Math.max(0, Math.round(volume)),
          searchVolumeSource: "dataforseo_google_ads_search_volume",
          quality: {
            source: "dataforseo_google_ads",
            confidence: "high" as Confidence,
            warnings: [],
          },
        };
      }

      const fallback = await this.fallback.getDemand(input);
      return {
        ...fallback,
        quality: {
          ...fallback.quality,
          confidence: "medium" as Confidence,
          warnings: [
            ...fallback.quality.warnings,
            "DataForSEO did not return volume for this keyword. Using proxy demand fallback.",
          ],
        },
      };
    } catch (error) {
      const fallback = await this.fallback.getDemand(input);
      return {
        ...fallback,
        quality: {
          ...fallback.quality,
          confidence: "medium" as Confidence,
          warnings: [
            ...fallback.quality.warnings,
            "DataForSEO request failed. Using proxy demand fallback.",
          ],
        },
      };
    }
  }
}

