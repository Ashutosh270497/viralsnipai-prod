export const V1_FEATURES = [
  "landingPage",
  "auth",
  "onboarding",
  "dashboard",
  "projects",
  "createClip",
  "videoUpload",
  "aiClipDetection",
  "captionGeneration",
  "captionEditing",
  "brandKit",
  "exports",
  "billing",
  "settings",
  "usageLimits",
] as const;

export const V2_FEATURES = [
  "viralHookGenerator",
  "platformCaptionGenerator",
  "clipRankingDashboard",
  "contentCalendar",
  "youtubeTitleGenerator",
  "thumbnailIdeas",
  "basicCreatorAnalytics",
  "keywordResearch",
] as const;

export const V3_FEATURES = [
  "snipRadar",
  "xAutomation",
  "autoScheduling",
  "competitorTracking",
  "relationshipCrm",
  "apiWebhooks",
  "imagen",
  "veo",
  "advancedAutomation",
  "advancedAnalytics",
  "voiceCloning",
] as const;

export type V1FeatureName = (typeof V1_FEATURES)[number];
export type V2FeatureName = (typeof V2_FEATURES)[number];
export type V3FeatureName = (typeof V3_FEATURES)[number];
export type LaunchFeatureName = V1FeatureName | V2FeatureName | V3FeatureName;
export type LaunchVersion = "v1" | "v2" | "v3";

const FEATURE_VERSION: Record<LaunchFeatureName, LaunchVersion> = {
  landingPage: "v1",
  auth: "v1",
  onboarding: "v1",
  dashboard: "v1",
  projects: "v1",
  createClip: "v1",
  videoUpload: "v1",
  aiClipDetection: "v1",
  captionGeneration: "v1",
  captionEditing: "v1",
  brandKit: "v1",
  exports: "v1",
  billing: "v1",
  settings: "v1",
  usageLimits: "v1",
  viralHookGenerator: "v2",
  platformCaptionGenerator: "v2",
  clipRankingDashboard: "v2",
  contentCalendar: "v2",
  youtubeTitleGenerator: "v2",
  thumbnailIdeas: "v2",
  basicCreatorAnalytics: "v2",
  keywordResearch: "v2",
  snipRadar: "v3",
  xAutomation: "v3",
  autoScheduling: "v3",
  competitorTracking: "v3",
  relationshipCrm: "v3",
  apiWebhooks: "v3",
  imagen: "v3",
  veo: "v3",
  advancedAutomation: "v3",
  advancedAnalytics: "v3",
  voiceCloning: "v3",
};

const VERSION_ENV: Record<LaunchVersion, string> = {
  v1: "NEXT_PUBLIC_V1_CORE_ENABLED",
  v2: "NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED",
  v3: "NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED",
};

const FEATURE_ENV: Partial<Record<LaunchFeatureName, string>> = {
  viralHookGenerator: "NEXT_PUBLIC_FEATURE_VIRAL_HOOK_GENERATOR_ENABLED",
  platformCaptionGenerator: "NEXT_PUBLIC_FEATURE_PLATFORM_CAPTION_GENERATOR_ENABLED",
  clipRankingDashboard: "NEXT_PUBLIC_FEATURE_CLIP_RANKING_DASHBOARD_ENABLED",
  contentCalendar: "NEXT_PUBLIC_FEATURE_CONTENT_CALENDAR_ENABLED",
  youtubeTitleGenerator: "NEXT_PUBLIC_FEATURE_YOUTUBE_TITLE_GENERATOR_ENABLED",
  thumbnailIdeas: "NEXT_PUBLIC_FEATURE_THUMBNAIL_IDEAS_ENABLED",
  basicCreatorAnalytics: "NEXT_PUBLIC_FEATURE_BASIC_CREATOR_ANALYTICS_ENABLED",
  keywordResearch: "NEXT_PUBLIC_FEATURE_KEYWORD_RESEARCH_ENABLED",
  snipRadar: "NEXT_PUBLIC_FEATURE_SNIPRADAR_ENABLED",
  xAutomation: "NEXT_PUBLIC_FEATURE_X_AUTOMATION_ENABLED",
  autoScheduling: "NEXT_PUBLIC_FEATURE_AUTO_SCHEDULING_ENABLED",
  competitorTracking: "NEXT_PUBLIC_FEATURE_COMPETITOR_TRACKING_ENABLED",
  relationshipCrm: "NEXT_PUBLIC_FEATURE_RELATIONSHIP_CRM_ENABLED",
  apiWebhooks: "NEXT_PUBLIC_FEATURE_API_WEBHOOKS_ENABLED",
  imagen: "NEXT_PUBLIC_FEATURE_IMAGEN_ENABLED",
  veo: "NEXT_PUBLIC_FEATURE_VEO_ENABLED",
  advancedAutomation: "NEXT_PUBLIC_FEATURE_ADVANCED_AUTOMATION_ENABLED",
  advancedAnalytics: "NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS_ENABLED",
  voiceCloning: "NEXT_PUBLIC_FEATURE_VOICE_CLONING_ENABLED",
};

const ENV_VALUES: Record<string, string | undefined> = {
  NEXT_PUBLIC_V1_CORE_ENABLED: process.env.NEXT_PUBLIC_V1_CORE_ENABLED,
  NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED: process.env.NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED,
  NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED: process.env.NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED,
  NEXT_PUBLIC_FEATURE_VIRAL_HOOK_GENERATOR_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_VIRAL_HOOK_GENERATOR_ENABLED,
  NEXT_PUBLIC_FEATURE_PLATFORM_CAPTION_GENERATOR_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_PLATFORM_CAPTION_GENERATOR_ENABLED,
  NEXT_PUBLIC_FEATURE_CLIP_RANKING_DASHBOARD_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_CLIP_RANKING_DASHBOARD_ENABLED,
  NEXT_PUBLIC_FEATURE_CONTENT_CALENDAR_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_CONTENT_CALENDAR_ENABLED,
  NEXT_PUBLIC_FEATURE_YOUTUBE_TITLE_GENERATOR_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_YOUTUBE_TITLE_GENERATOR_ENABLED,
  NEXT_PUBLIC_FEATURE_THUMBNAIL_IDEAS_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_THUMBNAIL_IDEAS_ENABLED,
  NEXT_PUBLIC_FEATURE_BASIC_CREATOR_ANALYTICS_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_BASIC_CREATOR_ANALYTICS_ENABLED,
  NEXT_PUBLIC_FEATURE_KEYWORD_RESEARCH_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_KEYWORD_RESEARCH_ENABLED,
  NEXT_PUBLIC_FEATURE_SNIPRADAR_ENABLED: process.env.NEXT_PUBLIC_FEATURE_SNIPRADAR_ENABLED,
  NEXT_PUBLIC_FEATURE_X_AUTOMATION_ENABLED: process.env.NEXT_PUBLIC_FEATURE_X_AUTOMATION_ENABLED,
  NEXT_PUBLIC_FEATURE_AUTO_SCHEDULING_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_AUTO_SCHEDULING_ENABLED,
  NEXT_PUBLIC_FEATURE_COMPETITOR_TRACKING_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_COMPETITOR_TRACKING_ENABLED,
  NEXT_PUBLIC_FEATURE_RELATIONSHIP_CRM_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_RELATIONSHIP_CRM_ENABLED,
  NEXT_PUBLIC_FEATURE_API_WEBHOOKS_ENABLED: process.env.NEXT_PUBLIC_FEATURE_API_WEBHOOKS_ENABLED,
  NEXT_PUBLIC_FEATURE_IMAGEN_ENABLED: process.env.NEXT_PUBLIC_FEATURE_IMAGEN_ENABLED,
  NEXT_PUBLIC_FEATURE_VEO_ENABLED: process.env.NEXT_PUBLIC_FEATURE_VEO_ENABLED,
  NEXT_PUBLIC_FEATURE_ADVANCED_AUTOMATION_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_ADVANCED_AUTOMATION_ENABLED,
  NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS_ENABLED:
    process.env.NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS_ENABLED,
  NEXT_PUBLIC_FEATURE_VOICE_CLONING_ENABLED: process.env.NEXT_PUBLIC_FEATURE_VOICE_CLONING_ENABLED,
};

function envValue(name: string): string | undefined {
  return ENV_VALUES[name];
}

export function parseFeatureFlag(value: string | undefined): boolean | null {
  if (value === undefined || value === "") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }
  return null;
}

export function getLaunchVersion(featureName: LaunchFeatureName): LaunchVersion {
  return FEATURE_VERSION[featureName];
}

export function isLaunchVersionEnabled(version: LaunchVersion): boolean {
  const parsed = parseFeatureFlag(envValue(VERSION_ENV[version]));
  if (parsed !== null) {
    return parsed;
  }

  return version === "v1";
}

export function isFeatureEnabled(featureName: LaunchFeatureName): boolean {
  const featureEnvName = FEATURE_ENV[featureName];
  if (featureEnvName) {
    const parsed = parseFeatureFlag(envValue(featureEnvName));
    if (parsed !== null) {
      return parsed;
    }
  }

  return isLaunchVersionEnabled(getLaunchVersion(featureName));
}

export function getEnabledLaunchFeatures() {
  return [...V1_FEATURES, ...V2_FEATURES, ...V3_FEATURES].filter(isFeatureEnabled);
}
