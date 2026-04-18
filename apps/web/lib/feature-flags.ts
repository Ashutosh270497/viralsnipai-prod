export type FeatureFlags = {
  uiV2Enabled: boolean;
  transcribeUiEnabled: boolean;
  imagenEnabled: boolean;
  veoEnabled: boolean;
  soraEnabled: boolean;
  voicerEnabled: boolean;
  snipRadarEnabled: boolean;
  snipRadarOverviewV2Enabled: boolean;
  snipRadarAnalyticsV2Enabled: boolean;
  snipRadarCreateV2Enabled: boolean;
  snipRadarDiscoverV2Enabled: boolean;
  snipRadarPublishV2Enabled: boolean;
  snipRadarGrowthPlanV2Enabled: boolean;
  // SnipRadar features not yet ready for launch — set to false to hide from UI entirely
  winnerLoopEnabled: boolean;
  relationshipsCrmEnabled: boolean;
  apiWebhooksEnabled: boolean;
  autoDmEnabled: boolean;
  // YouTube ecosystem features not yet ready
  youtubeRepurposeOsEnabled: boolean;
  youtubeVoicerEnabled: boolean;
  youtubeThumbnailGeneratorEnabled: boolean;
};

export const FEATURE_FLAG_KEYS = [
  "uiV2Enabled",
  "transcribeUiEnabled",
  "imagenEnabled",
  "veoEnabled",
  "soraEnabled",
  "voicerEnabled",
  "snipRadarEnabled",
  "snipRadarOverviewV2Enabled",
  "snipRadarAnalyticsV2Enabled",
  "snipRadarCreateV2Enabled",
  "snipRadarDiscoverV2Enabled",
  "snipRadarPublishV2Enabled",
  "snipRadarGrowthPlanV2Enabled",
  "winnerLoopEnabled",
  "relationshipsCrmEnabled",
  "apiWebhooksEnabled",
  "autoDmEnabled",
  "youtubeRepurposeOsEnabled",
  "youtubeVoicerEnabled",
  "youtubeThumbnailGeneratorEnabled",
] as const satisfies ReadonlyArray<keyof FeatureFlags>;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function readEnvFeatureFlags(): FeatureFlags {
  const envValue = process.env.UI_V2_ENABLED ?? process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false";
  const transcribeValue =
    process.env.TRANSCRIBE_UI_ENABLED ?? process.env.NEXT_PUBLIC_TRANSCRIBE_UI_ENABLED ?? "false";
  const imagenValue = process.env.IMAGEN_ENABLED ?? process.env.NEXT_PUBLIC_IMAGEN_ENABLED ?? "false";
  const veoValue = process.env.VEO_ENABLED ?? process.env.NEXT_PUBLIC_VEO_ENABLED ?? "false";
  const soraValue = process.env.SORA_ENABLED ?? process.env.NEXT_PUBLIC_SORA_ENABLED ?? "false";
  const voicerValue = process.env.VOICER_ENABLED ?? process.env.NEXT_PUBLIC_VOICER_ENABLED ?? "true";
  const snipRadarValue =
    process.env.SNIPRADAR_ENABLED ?? process.env.NEXT_PUBLIC_SNIPRADAR_ENABLED ?? "true";
  const snipRadarOverviewV2Value =
    process.env.SNIPRADAR_V2_OVERVIEW_ENABLED ??
    process.env.NEXT_PUBLIC_SNIPRADAR_V2_OVERVIEW_ENABLED ??
    "true";
  const snipRadarAnalyticsV2Value =
    process.env.SNIPRADAR_V2_ANALYTICS_ENABLED ??
    process.env.NEXT_PUBLIC_SNIPRADAR_V2_ANALYTICS_ENABLED ??
    "true";
  const snipRadarCreateV2Value =
    process.env.SNIPRADAR_V2_CREATE_ENABLED ??
    process.env.NEXT_PUBLIC_SNIPRADAR_V2_CREATE_ENABLED ??
    "true";
  const snipRadarDiscoverV2Value =
    process.env.SNIPRADAR_V2_DISCOVER_ENABLED ??
    process.env.NEXT_PUBLIC_SNIPRADAR_V2_DISCOVER_ENABLED ??
    "true";
  const snipRadarPublishV2Value =
    process.env.SNIPRADAR_V2_PUBLISH_ENABLED ??
    process.env.NEXT_PUBLIC_SNIPRADAR_V2_PUBLISH_ENABLED ??
    "true";
  const snipRadarGrowthPlanV2Value =
    process.env.SNIPRADAR_V2_GROWTH_PLAN_ENABLED ??
    process.env.NEXT_PUBLIC_SNIPRADAR_V2_GROWTH_PLAN_ENABLED ??
    "true";
  const forceVeoEnabled = parseBooleanFlag(process.env.FORCE_VEO_ENABLED);
  // Not-ready features — default false; opt-in via env only
  const winnerLoopValue =
    process.env.WINNER_LOOP_ENABLED ?? process.env.NEXT_PUBLIC_WINNER_LOOP_ENABLED ?? "false";
  const relationshipsCrmValue =
    process.env.RELATIONSHIPS_CRM_ENABLED ?? process.env.NEXT_PUBLIC_RELATIONSHIPS_CRM_ENABLED ?? "false";
  const apiWebhooksValue =
    process.env.API_WEBHOOKS_ENABLED ?? process.env.NEXT_PUBLIC_API_WEBHOOKS_ENABLED ?? "false";
  const autoDmValue =
    process.env.AUTO_DM_ENABLED ?? process.env.NEXT_PUBLIC_AUTO_DM_ENABLED ?? "false";
  const youtubeRepurposeOsValue =
    process.env.YOUTUBE_REPURPOSE_OS_ENABLED ?? process.env.NEXT_PUBLIC_YOUTUBE_REPURPOSE_OS_ENABLED ?? "false";
  const youtubeVoicerValue =
    process.env.YOUTUBE_VOICER_ENABLED ?? process.env.NEXT_PUBLIC_YOUTUBE_VOICER_ENABLED ?? "false";
  const youtubeThumbnailGeneratorValue =
    process.env.YOUTUBE_THUMBNAIL_GENERATOR_ENABLED ??
    process.env.NEXT_PUBLIC_YOUTUBE_THUMBNAIL_GENERATOR_ENABLED ??
    "false";
  return {
    uiV2Enabled: parseBooleanFlag(envValue),
    transcribeUiEnabled: parseBooleanFlag(transcribeValue),
    imagenEnabled: parseBooleanFlag(imagenValue),
    // Veo is temporarily paused unless FORCE_VEO_ENABLED=true is supplied.
    veoEnabled: forceVeoEnabled && parseBooleanFlag(veoValue),
    soraEnabled: parseBooleanFlag(soraValue),
    voicerEnabled: parseBooleanFlag(voicerValue),
    snipRadarEnabled: parseBooleanFlag(snipRadarValue),
    snipRadarOverviewV2Enabled: parseBooleanFlag(snipRadarOverviewV2Value),
    snipRadarAnalyticsV2Enabled: parseBooleanFlag(snipRadarAnalyticsV2Value),
    snipRadarCreateV2Enabled: parseBooleanFlag(snipRadarCreateV2Value),
    snipRadarDiscoverV2Enabled: parseBooleanFlag(snipRadarDiscoverV2Value),
    snipRadarPublishV2Enabled: parseBooleanFlag(snipRadarPublishV2Value),
    snipRadarGrowthPlanV2Enabled: parseBooleanFlag(snipRadarGrowthPlanV2Value),
    winnerLoopEnabled: parseBooleanFlag(winnerLoopValue),
    relationshipsCrmEnabled: parseBooleanFlag(relationshipsCrmValue),
    apiWebhooksEnabled: parseBooleanFlag(apiWebhooksValue),
    autoDmEnabled: parseBooleanFlag(autoDmValue),
    youtubeRepurposeOsEnabled: parseBooleanFlag(youtubeRepurposeOsValue),
    youtubeVoicerEnabled: parseBooleanFlag(youtubeVoicerValue),
    youtubeThumbnailGeneratorEnabled: parseBooleanFlag(youtubeThumbnailGeneratorValue),
  };
}

export function isUiV2Enabled(): boolean {
  return readEnvFeatureFlags().uiV2Enabled;
}

export function isTranscribeUiEnabled(): boolean {
  return readEnvFeatureFlags().transcribeUiEnabled;
}

export function isImagenEnabled(): boolean {
  return readEnvFeatureFlags().imagenEnabled;
}

export function isVeoEnabled(): boolean {
  return readEnvFeatureFlags().veoEnabled;
}

export function isSoraEnabled(): boolean {
  return readEnvFeatureFlags().soraEnabled;
}

export function isVoicerEnabled(): boolean {
  return readEnvFeatureFlags().voicerEnabled;
}

export function isSnipRadarEnabled(): boolean {
  return readEnvFeatureFlags().snipRadarEnabled;
}
