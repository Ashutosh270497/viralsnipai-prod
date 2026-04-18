"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { readEnvFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";

type FeatureFlagContextValue = {
  flags: FeatureFlags;
  setOverrides: (overrides: Partial<FeatureFlags>) => void;
};

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = "clippers:feature-flags";

function loadOverridesFromStorage(): Partial<FeatureFlags> | null {
  if (typeof window === "undefined") {
    return null;
  }
  const payload = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as Partial<FeatureFlags>;
    return parsed;
  } catch {
    return null;
  }
}

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const envFlags = useMemo(() => readEnvFeatureFlags(), []);
  const [overrides, setOverrides] = useState<Partial<FeatureFlags>>({});
  const hasLoadedOverrides = useRef(false);

  useEffect(() => {
    if (hasLoadedOverrides.current) {
      return;
    }
    const stored = loadOverridesFromStorage();
    if (stored) {
      setOverrides(stored);
    }
    hasLoadedOverrides.current = true;
  }, []);

  const value = useMemo<FeatureFlagContextValue>(() => {
    const flags: FeatureFlags = {
      uiV2Enabled: overrides.uiV2Enabled ?? envFlags.uiV2Enabled,
      transcribeUiEnabled: overrides.transcribeUiEnabled ?? envFlags.transcribeUiEnabled,
      imagenEnabled: overrides.imagenEnabled ?? envFlags.imagenEnabled,
      // Veo remains controlled by the environment toggle only.
      veoEnabled: envFlags.veoEnabled,
      soraEnabled: overrides.soraEnabled ?? envFlags.soraEnabled,
      voicerEnabled: overrides.voicerEnabled ?? envFlags.voicerEnabled,
      snipRadarEnabled: overrides.snipRadarEnabled ?? envFlags.snipRadarEnabled,
      snipRadarOverviewV2Enabled:
        overrides.snipRadarOverviewV2Enabled ?? envFlags.snipRadarOverviewV2Enabled,
      snipRadarAnalyticsV2Enabled:
        overrides.snipRadarAnalyticsV2Enabled ?? envFlags.snipRadarAnalyticsV2Enabled,
      snipRadarCreateV2Enabled:
        overrides.snipRadarCreateV2Enabled ?? envFlags.snipRadarCreateV2Enabled,
      snipRadarDiscoverV2Enabled:
        overrides.snipRadarDiscoverV2Enabled ?? envFlags.snipRadarDiscoverV2Enabled,
      snipRadarPublishV2Enabled:
        overrides.snipRadarPublishV2Enabled ?? envFlags.snipRadarPublishV2Enabled,
      snipRadarGrowthPlanV2Enabled:
        overrides.snipRadarGrowthPlanV2Enabled ?? envFlags.snipRadarGrowthPlanV2Enabled,
      // Not-ready features (default false — env-controlled only, not overridable from UI)
      winnerLoopEnabled: envFlags.winnerLoopEnabled,
      relationshipsCrmEnabled: envFlags.relationshipsCrmEnabled,
      apiWebhooksEnabled: envFlags.apiWebhooksEnabled,
      autoDmEnabled: envFlags.autoDmEnabled,
      youtubeRepurposeOsEnabled: envFlags.youtubeRepurposeOsEnabled,
      youtubeVoicerEnabled: envFlags.youtubeVoicerEnabled,
      youtubeThumbnailGeneratorEnabled: envFlags.youtubeThumbnailGeneratorEnabled,
    };
    return {
      flags,
      setOverrides: (next) => {
        setOverrides((current) => {
          const merged = { ...current, ...next };
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
          }
          return merged;
        });
      }
    };
  }, [envFlags, overrides]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (value.flags.uiV2Enabled) {
      root.setAttribute("data-ui-v2", "true");
    } else {
      root.removeAttribute("data-ui-v2");
    }
  }, [value.flags.uiV2Enabled]);

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagProvider");
  }
  return context.flags;
}

export function useSetFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error("useSetFeatureFlags must be used within a FeatureFlagProvider");
  }
  return context.setOverrides;
}
