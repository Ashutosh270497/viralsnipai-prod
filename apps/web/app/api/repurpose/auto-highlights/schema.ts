import { z } from "zod";

import { CLIP_INTENT_VALUES, QUALITY_MODE_VALUES } from "@/lib/ai/model-routing-options";
import { V1_CLIP_POLICY } from "@/lib/repurpose/clip-policy";

export const autoHighlightsRequestSchema = z.object({
  assetId: z.string(),
  strategy: z.string().optional(),
  target: z.number().min(1).max(V1_CLIP_POLICY.maxTargetClips).optional(),
  clipLengthPreset: z.enum(["short", "balanced", "detailed"]).optional().default("balanced"),
  qualityMode: z.enum(QUALITY_MODE_VALUES).optional().default("balanced"),
  clipIntent: z.enum(CLIP_INTENT_VALUES).optional().default("auto"),
  targetPlatform: z
    .enum(["auto", "youtube_shorts", "instagram_reels", "tiktok", "x", "linkedin"])
    .optional()
    .default("auto"),
  /**
   * How to reconcile new highlights with existing clips on the project:
   *   "merge" (default)   — keep existing clips; skip new ones that overlap existing within 5s
   *   "replace"           — delete ALL existing clips, then create new ones
   *   "append"            — keep existing clips; add ALL new clips alongside (may duplicate)
   * Callers must opt into "replace" explicitly when they want destructive regeneration.
   */
  mode: z.enum(["replace", "merge", "append"]).optional().default("merge"),
  /**
   * Legacy raw model field. Production users are not allowed to set this. The
   * route maps it to debugModelOverride only in developer/admin contexts.
   */
  model: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      return val.trim();
    }),
  debugModelOverride: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      return val.trim();
    }),
  brief: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      return val.trim().slice(0, 600);
    }),
  audience: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      return val.trim().slice(0, 160);
    }),
  tone: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      return val.trim().slice(0, 160);
    }),
  callToAction: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      return val.trim().slice(0, 200);
    }),
});
