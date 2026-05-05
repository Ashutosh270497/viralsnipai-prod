export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/utils/error-handler";
import { suggestBrollMoments } from "@/lib/ai/providers/openrouter-reasoning-provider";
import { clampEnhancementToClip } from "@/lib/repurpose/creative-enhancements";
import { srtUtils } from "@/lib/srt-utils";

const requestSchema = z.object({
  platform: z.string().max(80).nullable().optional(),
  tone: z.string().max(120).nullable().optional(),
  audience: z.string().max(160).nullable().optional(),
  model: z.string().max(160).optional(),
});

export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

    const json = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return ApiResponseBuilder.badRequest("Invalid request body", {
        errors: parsed.error.flatten(),
      });
    }

    const clip = await prisma.clip.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        startMs: true,
        endMs: true,
        title: true,
        summary: true,
        captionSrt: true,
        viralityFactors: true,
        project: { select: { userId: true } },
      },
    });

    if (!clip) return ApiResponseBuilder.notFound("Clip not found");
    if (clip.project.userId !== user.id) return ApiResponseBuilder.forbidden("Access denied");

    const clipDurationMs = clip.endMs - clip.startMs;
    const metadata = (clip.viralityFactors as any)?.metadata ?? {};
    const transcript =
      clip.captionSrt && !clip.captionSrt.includes("[Transcript unavailable]")
        ? srtUtils.parseSRT(clip.captionSrt).map((entry) => entry.text).join(" ")
        : [clip.title, clip.summary].filter(Boolean).join(" ");

    if (!transcript.trim()) {
      return ApiResponseBuilder.badRequest("Clip transcript is required for B-roll suggestions");
    }

    const result = await suggestBrollMoments({
      clipTranscript: transcript,
      clipDurationMs,
      candidateType: typeof metadata.candidateType === "string" ? metadata.candidateType : null,
      platform: parsed.data.platform,
      tone: parsed.data.tone,
      audience: parsed.data.audience,
      model: parsed.data.model,
    });

    const suggestions = result.suggestions
      .map((suggestion) => clampEnhancementToClip(suggestion, clipDurationMs))
      .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion));

    return ApiResponseBuilder.success({
      suggestions,
      warnings: result.warnings,
      model: result.model,
    });
  },
);
