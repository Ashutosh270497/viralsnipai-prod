import type { ClipReviewStatus } from "@/lib/types";

export const REVIEW_STATUS_VALUES: ClipReviewStatus[] = [
  "needs_review",
  "approved",
  "rejected",
  "export_ready",
];

export type ReviewableClip = {
  id: string;
  reviewStatus?: ClipReviewStatus | null;
};

export function getReviewStatus(clip: ReviewableClip): ClipReviewStatus {
  return clip.reviewStatus ?? "needs_review";
}

export function filterClipsByReviewStatus<T extends ReviewableClip>(
  clips: T[],
  status: ClipReviewStatus | "all",
): T[] {
  if (status === "all") return clips;
  return clips.filter((clip) => getReviewStatus(clip) === status);
}

export function getExportEligibleClips<T extends ReviewableClip>(
  clips: T[],
  includeRejected = false,
): T[] {
  return clips.filter((clip) => {
    const status = getReviewStatus(clip);
    return (
      status === "approved" ||
      status === "export_ready" ||
      (includeRejected && status === "rejected")
    );
  });
}

export function getDefaultExportClipIds(clips: ReviewableClip[]): string[] {
  return clips.filter((clip) => getReviewStatus(clip) === "export_ready").map((clip) => clip.id);
}
