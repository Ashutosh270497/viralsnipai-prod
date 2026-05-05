import {
  filterClipsByReviewStatus,
  getDefaultExportClipIds,
  getExportEligibleClips,
  getReviewStatus,
} from "@/lib/repurpose/review-workflow";

const clips = [
  { id: "needs", reviewStatus: "needs_review" as const },
  { id: "approved", reviewStatus: "approved" as const },
  { id: "rejected", reviewStatus: "rejected" as const },
  { id: "ready", reviewStatus: "export_ready" as const },
  { id: "legacy" },
];

describe("review workflow helpers", () => {
  it("defaults legacy clips to needs_review", () => {
    expect(getReviewStatus({ id: "legacy" })).toBe("needs_review");
  });

  it("filters clips by review status", () => {
    expect(filterClipsByReviewStatus(clips, "approved").map((clip) => clip.id)).toEqual([
      "approved",
    ]);
    expect(filterClipsByReviewStatus(clips, "all")).toHaveLength(clips.length);
  });

  it("hides rejected clips from export by default", () => {
    expect(getExportEligibleClips(clips).map((clip) => clip.id)).toEqual(["approved", "ready"]);
  });

  it("can explicitly include rejected clips for export review", () => {
    expect(getExportEligibleClips(clips, true).map((clip) => clip.id)).toEqual([
      "approved",
      "rejected",
      "ready",
    ]);
  });

  it("selects export-ready clips by default", () => {
    expect(getDefaultExportClipIds(clips)).toEqual(["ready"]);
  });
});
