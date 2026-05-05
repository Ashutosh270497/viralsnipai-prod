import { aggregateClipQualityAnalytics } from "@/lib/repurpose/quality-analytics";

describe("quality analytics", () => {
  it("aggregates feedback and clip quality signals", () => {
    const analytics = aggregateClipQualityAnalytics({
      clips: [
        {
          viralityScore: 80,
          previewPath: "/preview.mp4",
          viralityFactors: {
            metadata: {
              candidateType: "hook",
              transcriptPrecision: "word",
              boundaryConfidence: "high",
            },
          },
        },
        {
          viralityScore: 60,
          previewPath: null,
          viralityFactors: {
            metadata: {
              candidateType: "educational",
              transcriptPrecision: "segment",
              boundaryConfidence: "medium",
            },
          },
        },
      ],
      feedback: [
        { status: "accepted", manualTrimDeltaMs: 200 },
        { status: "rejected", reason: "Weak hook", manualTrimDeltaMs: 1200 },
        { status: "edited", manualTrimDeltaMs: 400 },
      ],
      exports: [{ status: "done" }, { status: "failed" }],
      socialPosts: [{ status: "published" }, { status: "failed" }],
    });

    expect(analytics.acceptanceRate).toBe(50);
    expect(analytics.averageViralityScore).toBe(70);
    expect(analytics.averageManualTrimDeltaMs).toBe(600);
    expect(analytics.previewFailureRate).toBe(50);
    expect(analytics.exportFailureRate).toBe(50);
    expect(analytics.publishFailureRate).toBe(50);
    expect(analytics.transcriptPrecisionDistribution).toEqual({ word: 1, segment: 1 });
    expect(analytics.boundaryConfidenceDistribution).toEqual({ high: 1, medium: 1 });
    expect(analytics.topRejectionReasons[0]).toEqual({ reason: "Weak hook", count: 1 });
  });
});
