import { z } from "zod";

export const captionCueSchema = z
  .object({
    index: z.number().int().positive(),
    startMs: z.number().int().min(0),
    endMs: z.number().int().positive(),
    text: z.string(),
  })
  .refine((cue) => cue.endMs > cue.startMs, {
    message: "endMs must be greater than startMs",
    path: ["endMs"],
  });

export const captionAssistRequestSchema = z.object({
  clipId: z.string().optional(),
  cues: z.array(captionCueSchema).min(1).max(200),
  mode: z
    .enum(["cleanup", "simplify", "add_emojis", "highlight_keywords", "remove_fillers"])
    .default("cleanup"),
  language: z.string().min(2).max(32).optional(),
});

export const CaptionCueTextResponseSchema = z.object({
  cues: z.array(
    z.object({
      index: z.number().int().positive(),
      text: z.string(),
      hidden: z.boolean().optional(),
      keywords: z.array(z.string()).optional(),
    }),
  ),
  warnings: z.array(z.string()).default([]),
});

export const CaptionCueTextJsonSchema = {
  name: "caption_cue_text_transform",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["cues", "warnings"],
    properties: {
      cues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "text"],
          properties: {
            index: { type: "integer", minimum: 1 },
            text: { type: "string" },
            hidden: { type: "boolean" },
            keywords: { type: "array", items: { type: "string" } },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
} as const;

export function mergeTransformedCueText(
  original: Array<{ index: number; startMs: number; endMs: number; text: string }>,
  transformed: Array<{ index: number; text: string; hidden?: boolean; keywords?: string[] }>,
) {
  const byIndex = new Map(transformed.map((cue) => [cue.index, cue]));
  return original
    .map((cue) => {
      const next = byIndex.get(cue.index);
      return {
        ...cue,
        text: next?.text?.replace(/\s+/g, " ").trim() || cue.text,
        hidden: next?.hidden === true,
        keywords: next?.keywords ?? [],
      };
    })
    .filter((cue) => !cue.hidden)
    .map((cue, index) => ({
      index: index + 1,
      startMs: cue.startMs,
      endMs: cue.endMs,
      text: cue.text,
      keywords: cue.keywords,
    }));
}
