export function serializePublicProject(project: any) {
  return {
    id: project.id,
    title: project.title,
    topic: project.topic ?? null,
    sourceUrl: project.sourceUrl ?? null,
    targetPlatform: project.targetPlatform ?? null,
    contentGoal: project.contentGoal ?? null,
    status: project.status,
    workspaceId: project.workspaceId ?? null,
    createdAt: project.createdAt?.toISOString?.() ?? project.createdAt,
    updatedAt: project.updatedAt?.toISOString?.() ?? project.updatedAt,
    assets: project.assets?.map(serializePublicAsset) ?? undefined,
    clips: project.clips?.map(serializePublicClip) ?? undefined,
    exports: project.exports?.map(serializePublicExport) ?? undefined,
  };
}

export function serializePublicAsset(asset: any) {
  return {
    id: asset.id,
    projectId: asset.projectId,
    type: asset.type,
    path: asset.path,
    storagePath: asset.storagePath,
    durationSec: asset.durationSec ?? null,
    sourceWidth: asset.sourceWidth ?? null,
    sourceHeight: asset.sourceHeight ?? null,
    sourceLanguage: asset.sourceLanguage ?? "en",
    hasTranscript: Boolean(asset.transcript),
    createdAt: asset.createdAt?.toISOString?.() ?? asset.createdAt,
  };
}

export function serializePublicClip(clip: any) {
  return {
    id: clip.id,
    projectId: clip.projectId,
    assetId: clip.assetId ?? null,
    startMs: clip.startMs,
    endMs: clip.endMs,
    title: clip.title ?? null,
    summary: clip.summary ?? null,
    callToAction: clip.callToAction ?? null,
    previewPath: clip.previewPath ?? null,
    thumbnail: clip.thumbnail ?? null,
    viralityScore: clip.viralityScore ?? null,
    reviewStatus: clip.reviewStatus ?? "needs_review",
    version: clip.version ?? 1,
    createdAt: clip.createdAt?.toISOString?.() ?? clip.createdAt,
    updatedAt: clip.updatedAt?.toISOString?.() ?? clip.updatedAt,
  };
}

export function serializePublicExport(exportJob: any) {
  return {
    id: exportJob.id,
    projectId: exportJob.projectId,
    clipIds: exportJob.clipIds,
    preset: exportJob.preset,
    platformPreset: exportJob.platformPreset ?? null,
    aspectRatio: exportJob.aspectRatio ?? null,
    outputFormat: exportJob.outputFormat,
    outputPath: exportJob.outputPath,
    status: exportJob.status,
    progress: exportJob.progress ?? 0,
    phase: exportJob.phase ?? null,
    error: exportJob.error ?? null,
    createdAt: exportJob.createdAt?.toISOString?.() ?? exportJob.createdAt,
    updatedAt: exportJob.updatedAt?.toISOString?.() ?? exportJob.updatedAt,
    completedAt: exportJob.completedAt?.toISOString?.() ?? exportJob.completedAt ?? null,
  };
}
