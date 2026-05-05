import { z } from "zod";

export const CLIP_REVIEW_STATUS_VALUES = [
  "needs_review",
  "approved",
  "rejected",
  "export_ready",
] as const;

export const clipReviewStatusRequestSchema = z.object({
  reviewStatus: z.enum(CLIP_REVIEW_STATUS_VALUES),
});
