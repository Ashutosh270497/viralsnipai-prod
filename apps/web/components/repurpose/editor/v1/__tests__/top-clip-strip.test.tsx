import { fireEvent, render, screen } from "@testing-library/react";

import {
  TopClipStrip,
  sortV1ClipsForStrip,
  type V1ClipSortMode,
} from "@/components/repurpose/editor/v1/top-clip-strip";
import type { ClipReviewStatus } from "@/lib/types";

const clips = [
  {
    id: "clip-1",
    title: "First generated clip with a long title",
    thumbnail: null,
    startMs: 0,
    endMs: 32_000,
    viralityScore: 71,
    createdAt: "2026-05-01T00:00:00.000Z",
    reviewStatus: "needs_review" as ClipReviewStatus,
  },
  {
    id: "clip-2",
    title: "Second generated clip",
    thumbnail: null,
    startMs: 40_000,
    endMs: 82_000,
    viralityScore: 88,
    createdAt: "2026-05-02T00:00:00.000Z",
    reviewStatus: "export_ready" as ClipReviewStatus,
  },
];

const getReviewStatus = (clip: { reviewStatus?: ClipReviewStatus | null }) =>
  clip.reviewStatus ?? "needs_review";

describe("TopClipStrip", () => {
  it("renders generated clips as a horizontal selectable strip", () => {
    const onSelectClip = jest.fn();
    render(
      <TopClipStrip
        clips={clips}
        activeClipId="clip-2"
        selectedClipIds={["clip-2"]}
        sortMode="score"
        onSortModeChange={jest.fn()}
        getReviewStatus={getReviewStatus}
        onSelectClip={onSelectClip}
      />,
    );

    expect(screen.queryByText("Generated clips")).not.toBeNull();
    expect(screen.queryByText("Second generated clip")).not.toBeNull();
    expect(screen.queryByText("Selected")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /select first generated clip/i }));
    expect(onSelectClip).toHaveBeenCalledWith("clip-1");
  });

  it("sorts clips for strip navigation using the selected mode", () => {
    expect(sortV1ClipsForStrip(clips, "score", getReviewStatus).map((clip) => clip.id)).toEqual([
      "clip-2",
      "clip-1",
    ]);
    expect(sortV1ClipsForStrip(clips, "newest", getReviewStatus).map((clip) => clip.id)).toEqual([
      "clip-2",
      "clip-1",
    ]);
    expect(
      sortV1ClipsForStrip(clips, "exportReady", getReviewStatus).map((clip) => clip.id),
    ).toEqual(["clip-2", "clip-1"]);
  });

  it("emits sort changes from the top strip control", () => {
    const onSortModeChange = jest.fn();
    render(
      <TopClipStrip
        clips={clips}
        activeClipId="clip-1"
        selectedClipIds={[]}
        sortMode="score"
        onSortModeChange={onSortModeChange}
        getReviewStatus={getReviewStatus}
        onSelectClip={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Sort generated clips"), {
      target: { value: "newest" satisfies V1ClipSortMode },
    });
    expect(onSortModeChange).toHaveBeenCalledWith("newest");
  });
});
