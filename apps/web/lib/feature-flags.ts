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
