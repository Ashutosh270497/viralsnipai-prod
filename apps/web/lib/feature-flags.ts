import { isFeatureEnabled, parseFeatureFlag } from "@/config/features";

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
  return parseFeatureFlag(value) ?? false;
}

export function readEnvFeatureFlags(): FeatureFlags {
  const envValue = process.env.UI_V2_ENABLED ?? process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false";
  const transcribeValue =
    process.env.TRANSCRIBE_UI_ENABLED ?? process.env.NEXT_PUBLIC_TRANSCRIBE_UI_ENABLED ?? "false";
  const soraValue = process.env.SORA_ENABLED ?? process.env.NEXT_PUBLIC_SORA_ENABLED ?? "false";
  const forceVeoEnabled = parseBooleanFlag(process.env.FORCE_VEO_ENABLED);
  const snipRadarEnabled = isFeatureEnabled("snipRadar");
  const voiceCloningEnabled = isFeatureEnabled("voiceCloning");
  return {
    uiV2Enabled: parseBooleanFlag(envValue),
    transcribeUiEnabled: parseBooleanFlag(transcribeValue),
    imagenEnabled: isFeatureEnabled("imagen"),
    // Veo is temporarily paused unless FORCE_VEO_ENABLED=true is supplied.
    veoEnabled: forceVeoEnabled && isFeatureEnabled("veo"),
    soraEnabled: parseBooleanFlag(soraValue),
    voicerEnabled: voiceCloningEnabled,
    snipRadarEnabled,
    snipRadarOverviewV2Enabled: snipRadarEnabled,
    snipRadarAnalyticsV2Enabled: snipRadarEnabled && isFeatureEnabled("advancedAnalytics"),
    snipRadarCreateV2Enabled: snipRadarEnabled,
    snipRadarDiscoverV2Enabled: snipRadarEnabled,
    snipRadarPublishV2Enabled: snipRadarEnabled,
    snipRadarGrowthPlanV2Enabled: snipRadarEnabled,
    winnerLoopEnabled: isFeatureEnabled("advancedAutomation"),
    relationshipsCrmEnabled: isFeatureEnabled("relationshipCrm"),
    apiWebhooksEnabled: isFeatureEnabled("apiWebhooks"),
    autoDmEnabled: isFeatureEnabled("advancedAutomation"),
    youtubeRepurposeOsEnabled: isFeatureEnabled("createClip"),
    youtubeVoicerEnabled: voiceCloningEnabled,
    youtubeThumbnailGeneratorEnabled: isFeatureEnabled("thumbnailIdeas"),
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
