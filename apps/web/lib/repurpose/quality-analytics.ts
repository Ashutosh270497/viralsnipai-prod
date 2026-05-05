export interface ClipQualityAnalyticsInput {
  clips: any[];
  feedback: any[];
  exports: any[];
  socialPosts: any[];
}

export function aggregateClipQualityAnalytics(input: ClipQualityAnalyticsInput) {
  const clips = input.clips ?? [];
  const feedback = input.feedback ?? [];
  const exports = input.exports ?? [];
  const socialPosts = input.socialPosts ?? [];

  const accepted = feedback.filter((entry) => entry.status === "accepted").length;
  const rejected = feedback.filter((entry) => entry.status === "rejected").length;
  const edited = feedback.filter((entry) => entry.status === "edited").length;
  const exported = feedback.filter((entry) => entry.status === "exported").length;
  const published = feedback.filter((entry) => entry.status === "published").length;
  const actionable = accepted + rejected;

  const trimDeltas = feedback
    .map((entry) => Math.abs(Number(entry.manualTrimDeltaMs ?? 0)))
    .filter((value) => Number.isFinite(value) && value > 0);

  const viralityScores = clips
    .map((clip) => Number(clip.viralityScore))
    .filter((value) => Number.isFinite(value));

  const metadata = clips.map((clip) => {
    const factors = clip.viralityFactors && typeof clip.viralityFactors === "object" ? clip.viralityFactors : {};
    return factors.metadata && typeof factors.metadata === "object" ? factors.metadata : {};
  });

  return {
    clipCount: clips.length,
    feedbackCount: feedback.length,
    acceptanceRate: actionable > 0 ? round((accepted / actionable) * 100) : null,
    statusCounts: { accepted, rejected, edited, exported, published },
    averageManualTrimDeltaMs: trimDeltas.length ? Math.round(avg(trimDeltas)) : 0,
    averageViralityScore: viralityScores.length ? round(avg(viralityScores)) : null,
    candidateTypePerformance: groupAverage(clips, (clip) => clip.viralityFactors?.metadata?.candidateType ?? "unknown", (clip) => clip.viralityScore),
    transcriptPrecisionDistribution: countValues(metadata.map((entry: any) => entry.transcriptPrecision ?? "unknown")),
    boundaryConfidenceDistribution: countValues(metadata.map((entry: any) => entry.boundaryConfidence ?? "unknown")),
    previewFailureRate: clips.length > 0 ? round((clips.filter((clip) => !clip.previewPath).length / clips.length) * 100) : 0,
    exportFailureRate: exports.length > 0 ? round((exports.filter((entry) => entry.status === "failed").length / exports.length) * 100) : 0,
    publishFailureRate: socialPosts.length > 0 ? round((socialPosts.filter((entry) => entry.status === "failed").length / socialPosts.length) * 100) : 0,
    topRejectionReasons: topCounts(feedback.filter((entry) => entry.status === "rejected").map((entry) => entry.reason ?? "No reason provided")),
    learningSignals: {
      acceptedPatternWeightDelta: accepted,
      rejectedPatternWeightDelta: -rejected,
      editedClips: edited,
      placeholder: "Future candidate scoring can use these aggregates per user/workspace.",
    },
  };
}

function avg(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function topCounts(values: string[]) {
  return Object.entries(countValues(values))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([reason, count]) => ({ reason, count }));
}

function groupAverage<T>(items: T[], keyFn: (item: T) => string, valueFn: (item: T) => unknown) {
  const grouped = new Map<string, number[]>();
  for (const item of items) {
    const value = Number(valueFn(item));
    if (!Number.isFinite(value)) continue;
    const key = keyFn(item);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return Object.fromEntries(
    [...grouped.entries()].map(([key, values]) => [
      key,
      { count: values.length, averageViralityScore: round(avg(values)) },
    ]),
  );
}
