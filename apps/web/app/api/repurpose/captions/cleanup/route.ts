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

  const modeInstruction: Record<string, string> = {
    cleanup: "Clean punctuation, casing, and readability. Preserve meaning.",
    simplify: "Make each cue simpler and easier to read on short-form video.",
    add_emojis: "Add a small number of relevant emojis only where natural.",
    highlight_keywords: "Return important keywords for each cue and keep text readable.",
    remove_fillers: "Remove filler words such as um, uh, like, basically, actually, literally, you know, and I mean.",
  };

  const result = await openRouterJson({
    model: process.env.OPENROUTER_CAPTION_MODEL ?? "google/gemini-3.1-flash-lite-preview",
    schema: CaptionCueTextResponseSchema,
    jsonSchema: CaptionCueTextJsonSchema,
    system: [
      "You improve caption cue text only.",
      "Never create, change, remove, or infer timestamps.",
      "Return the same cue indexes. If removing a cue, mark hidden=true.",
      modeInstruction[parsed.data.mode],
    ].join("\n"),
    user: {
      mode: parsed.data.mode,
      cues: parsed.data.cues.map((cue) => ({ index: cue.index, text: cue.text })),
    },
    maxTokens: 3000,
  });

  return ApiResponseBuilder.success({
    cues: mergeTransformedCueText(parsed.data.cues, result.data.cues),
    warnings: result.data.warnings,
    model: result.model,
  });
});
