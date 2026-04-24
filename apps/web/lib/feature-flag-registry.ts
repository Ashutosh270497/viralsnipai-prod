import { FEATURE_FLAG_KEYS, type FeatureFlagKey, type FeatureFlags } from "@/lib/feature-flags";

export type FlagOwner = "platform" | "growth" | "repurpose" | "transcribe" | "media_ai";

export type FlagStage = "experiment" | "beta" | "ga" | "kill_switch";

export interface FeatureFlagDefinition {
  key: keyof FeatureFlags;
  envVar: string;
  publicEnvVar?: string;
  owner: FlagOwner;
  stage: FlagStage;
  defaultValue: boolean;
  description: string;
  killSwitchBehavior: string;
  removeWhen: string | null;
}

export const FEATURE_FLAG_REGISTRY: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  uiV2Enabled: {
    key: "uiV2Enabled",
    envVar: "UI_V2_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_UI_V2_ENABLED",
    owner: "platform",
    stage: "kill_switch",
    defaultValue: false,
    description: "Legacy UI V1/V2 shell switch for the main web experience.",
    killSwitchBehavior: "Set both UI_V2_ENABLED and NEXT_PUBLIC_UI_V2_ENABLED to false to force the legacy shell.",
    removeWhen: "Remove once the legacy UI fallback is deleted.",
  },
  transcribeUiEnabled: {
    key: "transcribeUiEnabled",
    envVar: "TRANSCRIBE_UI_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_TRANSCRIBE_UI_ENABLED",
    owner: "transcribe",
    stage: "beta",
    defaultValue: false,
    description: "Manual transcription workspace availability.",
    killSwitchBehavior: "Disable both env vars to hide the transcribe workspace while keeping APIs inaccessible from the UI.",
    removeWhen: "Remove after the transcribe workspace is promoted to GA and no longer needs launch gating.",
  },
  imagenEnabled: {
    key: "imagenEnabled",
    envVar: "IMAGEN_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_IMAGEN_ENABLED",
    owner: "media_ai",
    stage: "beta",
    defaultValue: false,
    description: "Google Imagen image-generation workspace availability.",
    killSwitchBehavior: "Disable both env vars to hide Imagen generation from the UI immediately.",
    removeWhen: "Remove after Imagen becomes a fully supported default surface or is retired.",
  },
  veoEnabled: {
    key: "veoEnabled",
    envVar: "VEO_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_VEO_ENABLED",
    owner: "media_ai",
    stage: "kill_switch",
    defaultValue: false,
    description: "Google Veo workspace availability, subject to a second FORCE_VEO_ENABLED safety gate.",
    killSwitchBehavior:
      "Set VEO_ENABLED or NEXT_PUBLIC_VEO_ENABLED to false, or omit FORCE_VEO_ENABLED=true, to block Veo access.",
    removeWhen: null,
  },
  soraEnabled: {
    key: "soraEnabled",
    envVar: "SORA_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_SORA_ENABLED",
    owner: "media_ai",
    stage: "experiment",
    defaultValue: false,
    description: "Sora integration placeholder flag.",
    killSwitchBehavior: "Keep disabled by default until the Sora workspace moves beyond placeholder status.",
    removeWhen: "Remove if Sora is not shipped or after its production rollout model is finalized.",
  },
  voicerEnabled: {
    key: "voicerEnabled",
    envVar: "VOICER_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_VOICER_ENABLED",
    owner: "media_ai",
    stage: "ga",
    defaultValue: false,
    description: "ElevenLabs-powered Voicer workspace availability.",
    killSwitchBehavior: "Disable both env vars to pull the workspace from navigation if provider health or cost requires a stop.",
    removeWhen: "Keep only if Voicer must remain an operational kill switch after full stabilization.",
  },
  snipRadarEnabled: {
    key: "snipRadarEnabled",
    envVar: "SNIPRADAR_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_SNIPRADAR_ENABLED",
    owner: "growth",
    stage: "kill_switch",
    defaultValue: false,
    description: "Top-level enablement for the SnipRadar ecosystem.",
    killSwitchBehavior: "Disable both env vars to remove SnipRadar from the workspace and block its main UI entrypoints.",
    removeWhen: null,
  },
  snipRadarOverviewV2Enabled: {
    key: "snipRadarOverviewV2Enabled",
    envVar: "SNIPRADAR_V2_OVERVIEW_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_SNIPRADAR_V2_OVERVIEW_ENABLED",
    owner: "growth",
    stage: "kill_switch",
    defaultValue: false,
    description: "Overview page v2 shell availability.",
    killSwitchBehavior: "Disable both env vars to route users away from the v2 overview experience.",
    removeWhen: "Remove once the legacy fallback is deleted or the page no longer needs per-surface kill-switch control.",
  },
  snipRadarAnalyticsV2Enabled: {
    key: "snipRadarAnalyticsV2Enabled",
    envVar: "SNIPRADAR_V2_ANALYTICS_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_SNIPRADAR_V2_ANALYTICS_ENABLED",
    owner: "growth",
    stage: "kill_switch",
    defaultValue: false,
    description: "Analytics page v2 shell availability.",
    killSwitchBehavior: "Disable both env vars to hide the analytics v2 surface if release or provider issues require rollback.",
    removeWhen: "Remove once analytics v2 is unconditional or replaced.",
  },
  snipRadarCreateV2Enabled: {
    key: "snipRadarCreateV2Enabled",
    envVar: "SNIPRADAR_V2_CREATE_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_SNIPRADAR_V2_CREATE_ENABLED",
    owner: "growth",
    stage: "kill_switch",
    defaultValue: false,
    description: "Create page v2 shell availability.",
    killSwitchBehavior: "Disable both env vars to withdraw the Create v2 surface without disabling all of SnipRadar.",
    removeWhen: "Remove once create v2 is the only maintained experience.",
  },
  snipRadarDiscoverV2Enabled: {
    key: "snipRadarDiscoverV2Enabled",
    envVar: "SNIPRADAR_V2_DISCOVER_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_SNIPRADAR_V2_DISCOVER_ENABLED",
    owner: "growth",
    stage: "kill_switch",
    defaultValue: false,
    description: "Discover page v2 shell availability.",
    killSwitchBehavior: "Disable both env vars to pull Discover v2 while preserving other SnipRadar surfaces.",
    removeWhen: "Remove once Discover v2 no longer requires independent rollback control.",
  },
  snipRadarPublishV2Enabled: {
    key: "snipRadarPublishV2Enabled",
    envVar: "SNIPRADAR_V2_PUBLISH_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_SNIPRADAR_V2_PUBLISH_ENABLED",
    owner: "growth",
    stage: "kill_switch",
    defaultValue: false,
    description: "Publish page v2 shell availability.",
    killSwitchBehavior: "Disable both env vars to pull the Publish v2 surface if scheduling or publish reliability regresses.",
    removeWhen: "Remove once Publish v2 is the only supported publish shell.",
  },
  snipRadarGrowthPlanV2Enabled: {
    key: "snipRadarGrowthPlanV2Enabled",
    envVar: "SNIPRADAR_V2_GROWTH_PLAN_ENABLED",
    publicEnvVar: "NEXT_PUBLIC_SNIPRADAR_V2_GROWTH_PLAN_ENABLED",
    owner: "growth",
    stage: "kill_switch",
    defaultValue: false,
    description: "Growth Planner v2 availability.",
    killSwitchBehavior: "Disable both env vars to hide Growth Planner v2 while keeping the rest of SnipRadar active.",
    removeWhen: "Remove once Growth Planner no longer needs separate release control.",
  },
  // Not-ready features — default false until launch-ready
  winnerLoopEnabled: {
    key: "winnerLoopEnabled",
    envVar: "WINNER_LOOP_ENABLED",
    owner: "growth",
    stage: "experiment",
    defaultValue: false,
    description: "WinnerLoop feature — detects top-performing posts and creates follow-up drafts.",
    killSwitchBehavior: "Keep false until WinnerLoop is launch-ready.",
    removeWhen: "Remove once WinnerLoop is GA.",
  },
  relationshipsCrmEnabled: {
    key: "relationshipsCrmEnabled",
    envVar: "RELATIONSHIPS_CRM_ENABLED",
    owner: "growth",
    stage: "experiment",
    defaultValue: false,
    description: "Relationships CRM — lead graph, follow-up tracking, and interaction history.",
    killSwitchBehavior: "Keep false until the Relationships CRM is launch-ready.",
    removeWhen: "Remove once Relationships CRM is GA.",
  },
  apiWebhooksEnabled: {
    key: "apiWebhooksEnabled",
    envVar: "API_WEBHOOKS_ENABLED",
    owner: "platform",
    stage: "experiment",
    defaultValue: false,
    description: "Public API and webhook subscriptions for SnipRadar.",
    killSwitchBehavior: "Keep false until API/Webhooks are launch-ready.",
    removeWhen: "Remove once API/Webhooks are GA.",
  },
  autoDmEnabled: {
    key: "autoDmEnabled",
    envVar: "AUTO_DM_ENABLED",
    owner: "growth",
    stage: "experiment",
    defaultValue: false,
    description: "Auto-DM automation for engagement nurturing.",
    killSwitchBehavior: "Keep false until Auto-DM is launch-ready.",
    removeWhen: "Remove once Auto-DM is GA.",
  },
  youtubeRepurposeOsEnabled: {
    key: "youtubeRepurposeOsEnabled",
    envVar: "YOUTUBE_REPURPOSE_OS_ENABLED",
    owner: "repurpose",
    stage: "experiment",
    defaultValue: true,
    description: "V1 Create Clip flow — upload long video, detect clips, edit captions, and export.",
    killSwitchBehavior: "Set NEXT_PUBLIC_V1_CORE_ENABLED=false only for emergency shutdown of the core workspace.",
    removeWhen: "Remove once the V1 launch-version gates are replaced by permanent product packaging.",
  },
  youtubeVoicerEnabled: {
    key: "youtubeVoicerEnabled",
    envVar: "YOUTUBE_VOICER_ENABLED",
    owner: "media_ai",
    stage: "experiment",
    defaultValue: false,
    description: "YouTube Voicer — voice translation workspace.",
    killSwitchBehavior: "Keep false until YouTube Voicer is launch-ready.",
    removeWhen: "Remove once YouTube Voicer is GA.",
  },
  youtubeThumbnailGeneratorEnabled: {
    key: "youtubeThumbnailGeneratorEnabled",
    envVar: "YOUTUBE_THUMBNAIL_GENERATOR_ENABLED",
    owner: "media_ai",
    stage: "experiment",
    defaultValue: false,
    description: "YouTube Thumbnail Generator workspace.",
    killSwitchBehavior: "Keep false until the Thumbnail Generator is launch-ready.",
    removeWhen: "Remove once the Thumbnail Generator is GA.",
  },
};

export const FEATURE_FLAG_DEFINITIONS = FEATURE_FLAG_KEYS.map((key) => FEATURE_FLAG_REGISTRY[key]);

export function getFeatureFlagDefinition(key: FeatureFlagKey) {
  return FEATURE_FLAG_REGISTRY[key];
}

export function getFeatureFlagDefinitions() {
  return FEATURE_FLAG_DEFINITIONS;
}
