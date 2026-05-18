export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { openRouterJson } from "@/lib/ai/providers/openrouter-reasoning-provider";
import { prisma } from "@/lib/prisma";
import { srtUtils } from "@/lib/srt-utils";
import { buildWebVTT } from "@/lib/captions/webvtt";
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
  if (!parsed.success || !parsed.data.language) {
    return ApiResponseBuilder.badRequest("Invalid request body", {
      errors: parsed.success ? { language: ["language is required"] } : parsed.error.flatten(),
    });
  }

  if (parsed.data.clipId) {
    const clip = await prisma.clip.findUnique({
      where: { id: parsed.data.clipId },
      select: { id: true, project: { select: { userId: true } } },
    });
    if (!clip) return ApiResponseBuilder.notFound("Clip not found");
    if (clip.project.userId !== user.id) return ApiResponseBuilder.forbidden("Access denied");
  }

  const result = await openRouterJson({
    model: process.env.OPENROUTER_CAPTION_MODEL ?? "google/gemini-3.1-flash-lite-preview",
    schema: CaptionCueTextResponseSchema,
    jsonSchema: CaptionCueTextJsonSchema,
    system: [
      `Translate caption cue text to ${parsed.data.language}.`,
      "Preserve cue meaning and short-form readability.",
      "Never create, change, remove, or infer timestamps.",
      "Return the same cue indexes.",
    ].join("\n"),
    user: {
      language: parsed.data.language,
      cues: parsed.data.cues.map((cue) => ({ index: cue.index, text: cue.text })),
    },
    maxTokens: 3600,
  });

  const cues = mergeTransformedCueText(parsed.data.cues, result.data.cues);
  const srt = srtUtils.buildSRT(cues);
  const vtt = buildWebVTT(cues);
  let track: unknown = null;

  if (parsed.data.clipId) {
    track = await prisma.captionTranslation.upsert({
      where: {
        clipId_language: {
          clipId: parsed.data.clipId,
          language: parsed.data.language,
        },
      },
      create: {
        clipId: parsed.data.clipId,
        language: parsed.data.language,
        label: languageLabel(parsed.data.language),
        captionSrt: srt,
        captionVtt: vtt,
        source: "translated",
      },
      update: {
        label: languageLabel(parsed.data.language),
        captionSrt: srt,
        captionVtt: vtt,
        source: "translated",
      },
    });
  }

  return ApiResponseBuilder.success({
    cues,
    srt,
    vtt,
    track,
    warnings: result.data.warnings,
    model: result.model,
  });
});

function languageLabel(language: string) {
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    return displayNames.of(language) ?? language;
  } catch {
    return language;
  }
}
