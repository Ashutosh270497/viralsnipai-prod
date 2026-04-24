import { isFeatureEnabled, isLaunchVersionEnabled } from "@/config/features";

export const ECOSYSTEM_COOKIE_KEY = "clippers_ecosystem";

export type Ecosystem = "x" | "youtube";

export function parseEcosystem(value: string | null | undefined): Ecosystem | null {
  if (value === "x" || value === "youtube") {
    return value;
  }
  return null;
}

export function getEcosystemHome(ecosystem: Ecosystem): string {
  if (ecosystem === "x" && !isFeatureEnabled("snipRadar")) {
    return "/dashboard";
  }
  return ecosystem === "x" ? "/snipradar/overview" : "/dashboard";
}

export function isRouteAllowedForEcosystem(pathname: string, ecosystem: Ecosystem): boolean {
  if (!pathname || pathname === "/") {
    return true;
  }

  // Global routes available in both ecosystems.
  if (pathname.startsWith("/settings") || pathname.startsWith("/activity")) {
    return true;
  }

  if (!isRouteAllowedForLaunchFeatures(pathname)) {
    return false;
  }

  if (ecosystem === "x" && isFeatureEnabled("snipRadar")) {
    return pathname === "/snipradar" || pathname.startsWith("/snipradar/");
  }

  // YouTube ecosystem can access everything except X-only feature routes.
  return !(pathname === "/snipradar" || pathname.startsWith("/snipradar/"));
}

export function isRouteAllowedForLaunchFeatures(pathname: string): boolean {
  if (pathname === "/snipradar" || pathname.startsWith("/snipradar/")) {
    return isFeatureEnabled("snipRadar");
  }
  if (pathname.startsWith("/keywords")) {
    return isFeatureEnabled("keywordResearch");
  }
  if (pathname.startsWith("/competitors")) {
    return isFeatureEnabled("competitorTracking");
  }
  if (pathname.startsWith("/imagen")) {
    return isFeatureEnabled("imagen");
  }
  if (pathname.startsWith("/veo")) {
    return isFeatureEnabled("veo");
  }
  if (pathname.startsWith("/voicer")) {
    return isFeatureEnabled("voiceCloning");
  }
  if (pathname.startsWith("/dashboard/content-calendar")) {
    return isFeatureEnabled("contentCalendar");
  }
  if (pathname.startsWith("/dashboard/title-generator")) {
    return isFeatureEnabled("youtubeTitleGenerator");
  }
  if (pathname.startsWith("/dashboard/thumbnail-generator")) {
    return isFeatureEnabled("thumbnailIdeas");
  }
  if (pathname.startsWith("/dashboard/script-generator")) {
    return isLaunchVersionEnabled("v2");
  }
  if (pathname.startsWith("/hooksmith") || pathname.startsWith("/niche-discovery")) {
    return isLaunchVersionEnabled("v2");
  }
  if (pathname.startsWith("/video") || pathname.startsWith("/transcribe")) {
    return isLaunchVersionEnabled("v3");
  }

  return true;
}
