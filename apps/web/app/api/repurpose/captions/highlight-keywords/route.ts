export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { openRouterJson } from "@/lib/ai/providers/openrouter-reasoning-provider";
import { withErrorHandling } from "@/lib/utils/error-handler";
import {
  CaptionCueTextJsonSchema,
  CaptionCueTextResponseSchema,
  captionAssistRequestSchema,
  mergeTransformedCueText,
} from "../assist";

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const parsed = captionAssistRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid request body", { errors: parsed.error.flatten() });
  }

  const result = await openRouterJson({
    model: process.env.OPENROUTER_CAPTION_MODEL ?? "google/gemini-3.1-flash-lite-preview",
    schema: CaptionCueTextResponseSchema,
    jsonSchema: CaptionCueTextJsonSchema,
    system: [
      "Select caption keywords for visual emphasis.",
      "You may lightly clean text, but cue timestamps are not provided and must not be invented.",
      "Return the same cue indexes with keywords arrays.",
    ].join("\n"),
    user: {
      cues: parsed.data.cues.map((cue) => ({ index: cue.index, text: cue.text })),
    },
    maxTokens: 2400,
  });

  return ApiResponseBuilder.success({
    cues: mergeTransformedCueText(parsed.data.cues, result.data.cues),
    warnings: result.data.warnings,
    model: result.model,
  });
});
