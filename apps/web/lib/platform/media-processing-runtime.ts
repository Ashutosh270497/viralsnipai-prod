export type MediaExecutionMode = "in_process_web_runtime" | "dedicated_worker_target";

export type MediaJobType =
  | "export_render"
  | "youtube_ingest"
  | "voice_translation"
  | "transcription_prep"
  | "thumbnail_generation";

export interface MediaRuntimeProfile {
  currentMode: MediaExecutionMode;
  targetMode: "dedicated_worker_target";
  queueDriver: "@clippers/jobs";
  ffmpegBinarySource: "ffmpeg-static_or_env";
  currentEntrypoints: string[];
  persistentStorageRequired: boolean;
  knownRisks: string[];
  productionRequirement: string;
}

export const MEDIA_RUNTIME_PROFILE: MediaRuntimeProfile = {
  currentMode: "in_process_web_runtime",
  targetMode: "dedicated_worker_target",
  queueDriver: "@clippers/jobs",
  ffmpegBinarySource: "ffmpeg-static_or_env",
  currentEntrypoints: [
    "apps/web/lib/render-queue.ts",
    "apps/web/lib/youtube-ingest-queue.ts",
    "apps/web/lib/voice-translation-queue.ts",
  ],
  persistentStorageRequired: true,
  knownRisks: [
    "The web runtime currently boots queue workers for FFmpeg-backed jobs, which is acceptable for local development and transitional deployment but not ideal for sustained media throughput.",
    "Heavy render, ingest, and translation workloads contend with application runtime resources when worker execution remains colocated with the web process.",
    "Missing FFmpeg binaries, unavailable source assets, output-path failures, or stalled queue workers can block jobs if the execution environment is not validated upfront.",
  ],
  productionRequirement:
    "Treat a dedicated worker or media-processing runtime with persistent storage access, explicit retries, and isolated resource limits as the production target before claiming the FFmpeg pipeline is production ready at scale.",
};

export function getMediaRuntimeProfile() {
  return MEDIA_RUNTIME_PROFILE;
}

export function getMediaRuntimeRiskSummary() {
  return MEDIA_RUNTIME_PROFILE.knownRisks.join(" ");
}
