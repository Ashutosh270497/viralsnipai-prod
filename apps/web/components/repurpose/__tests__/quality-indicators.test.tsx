import { render, screen } from "@testing-library/react";

import {
  BoundaryConfidenceBadge,
  ClipTypeBadge,
  PlatformFitChips,
  ReviewStatusBadge,
  ViralityScoreBadge,
  getClipMetadata,
} from "@/components/repurpose/quality-indicators";
import type { ProjectClip } from "@/components/repurpose/types";

describe("repurpose quality indicators", () => {
  it("renders clip card quality badges", () => {
    render(
      <div>
        <ViralityScoreBadge score={87} />
        <BoundaryConfidenceBadge confidence="high" />
        <ClipTypeBadge type="problem_solution" />
        <ReviewStatusBadge status="export_ready" />
        <PlatformFitChips platformFit={{ youtubeShorts: 92, instagramReels: 80 }} />
      </div>,
    );

    expect(screen.getByText("87/100")).toBeInTheDocument();
    expect(screen.getByText(/high boundary/i)).toBeInTheDocument();
    expect(screen.getByText(/problem solution/i)).toBeInTheDocument();
    expect(screen.getByText(/export ready/i)).toBeInTheDocument();
    expect(screen.getByText(/shorts 92/i)).toBeInTheDocument();
  });

  it("extracts stored quality metadata for review panels", () => {
    const clip = {
      id: "clip_1",
      startMs: 0,
      endMs: 30_000,
      version: 1,
      viralityFactors: {
        hookStrength: 90,
        emotionalPeak: 80,
        storyArc: 70,
        pacing: 85,
        transcriptQuality: 88,
        metadata: {
          boundaryConfidence: "high",
          boundaryReasons: ["Snapped to word end"],
          candidateReasons: ["Strong opening hook"],
          editingNotes: ["Add caption emphasis"],
          deterministicScore: 82,
          llmScore: 91,
          candidateType: "hook",
        },
      },
    } as ProjectClip;

    expect(getClipMetadata(clip)).toMatchObject({
      boundaryConfidence: "high",
      candidateType: "hook",
      boundaryReasons: ["Snapped to word end"],
      candidateReasons: ["Strong opening hook"],
      editingNotes: ["Add caption emphasis"],
      deterministicScore: 82,
      llmScore: 91,
    });
  });
});
