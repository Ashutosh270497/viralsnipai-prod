export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { generateVeoVideo } from "@/lib/google-veo";
import { fail, ok, parseJson } from "@/lib/api";

const aspectRatioEnum = z.enum(["16:9", "9:16", "1:1", "4:5"]);

const schema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters."),
  aspectRatio: aspectRatioEnum.optional(),
  durationSeconds: z.number().int().min(4).max(60).optional(),
  stylePreset: z.string().max(120).optional(),
  negativePrompt: z.string().max(400).optional(),
  sampleCount: z.number().int().min(1).max(8).optional(),
  addWatermark: z.boolean().optional(),
  includeRaiReason: z.boolean().optional(),
  generateAudio: z.boolean().optional(),
  personGeneration: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z_]+$/, "personGeneration must be lowercase snake_case")
    .optional(),
  resolution: z
    .string()
    .min(3)
    .max(16)
    .regex(/^[0-9]{3,4}p$/i, "resolution must be like 720p or 1080p")
    .optional()
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const parsed = await parseJson(request, schema);
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const video = await generateVeoVideo(parsed.data);
    return ok({ video });
  } catch (error) {
    console.error("Veo generation failed", error);
    return fail(
      502,
      error instanceof Error ? error.message : "Veo generation failed"
    );
  }
}
