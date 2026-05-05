import { z } from "zod";

export const CLIP_EDIT_OPERATION_TYPES = [
  "trim_start",
  "trim_end",
  "remove_range",
  "add_range",
  "caption_text_edit",
] as const;

export const clipEditOperationSchema = z
  .object({
    type: z.enum(CLIP_EDIT_OPERATION_TYPES),
    startMs: z.number().int().min(0).nullable().optional(),
    endMs: z.number().int().min(0).nullable().optional(),
    payload: z.record(z.any()).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startMs == null || data.endMs == null) {
        return true;
      }
      return data.endMs > data.startMs;
    },
    { message: "endMs must be greater than startMs", path: ["endMs"] },
  );
