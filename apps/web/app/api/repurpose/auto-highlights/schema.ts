import { z } from "zod";

import { HIGHLIGHT_MODEL_VALUES } from "@/lib/constants/repurpose";
import { V1_CLIP_POLICY } from "@/lib/repurpose/clip-policy";

const HIGHLIGHT_MODELS = HIGHLIGHT_MODEL_VALUES;

export const autoHighlightsRequestSchema = z.object({
  assetId: z.string(),
  strategy: z.string().optional(),
  target: z.number().min(1).max(V1_CLIP_POLICY.maxTargetClips).optional(),
  clipLengthPreset: z.enum(["short", "balanced", "detailed"]).optional().default("balanced"),
  /**
   * How to reconcile new highlights with existing clips on the project:
   *   "merge" (default)   — keep existing clips; skip new ones that overlap existing within 5s
   *   "replace"           — delete ALL existing clips, then create new ones
   *   "append"            — keep existing clips; add ALL new clips alongside (may duplicate)
   * Callers must opt into "replace" explicitly when they want destructive regeneration.
   */
  mode: z.enum(["replace", "merge", "append"]).optional().default("merge"),
  model: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      const trimmed = val.trim();
      return trimmed;
    })
    .superRefine((val, ctx) => {
      if (val && !HIGHLIGHT_MODELS.includes(val as any)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid OpenRouter reasoning model "${val}".`,
        });
      }
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
