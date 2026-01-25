export type FeatureFlags = {
  uiV2Enabled: boolean;
  transcribeUiEnabled: boolean;
  imagenEnabled: boolean;
  veoEnabled: boolean;
  soraEnabled: boolean;
  voicerEnabled: boolean;
};

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
  const forceVeoEnabled = parseBooleanFlag(process.env.FORCE_VEO_ENABLED);
  return {
    uiV2Enabled: parseBooleanFlag(envValue),
    transcribeUiEnabled: parseBooleanFlag(transcribeValue),
    imagenEnabled: parseBooleanFlag(imagenValue),
    // Veo is temporarily paused unless FORCE_VEO_ENABLED=true is supplied.
    veoEnabled: forceVeoEnabled && parseBooleanFlag(veoValue),
    soraEnabled: parseBooleanFlag(soraValue),
    voicerEnabled: parseBooleanFlag(voicerValue)
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
