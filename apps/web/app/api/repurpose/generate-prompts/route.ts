export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { promptGeneratorService } from "@/lib/services/prompt-generator.service";
import { logger } from "@/lib/logger";
import { canUseModelDebug } from "@/lib/ai/model-policy";
import { CLIP_INTENT_VALUES, QUALITY_MODE_VALUES } from "@/lib/ai/model-routing-options";
import { prisma } from "@/lib/prisma";
import { assertSameOriginRequest } from "@/lib/security/origin";
import { consumeV1RateLimit, rateLimitResponse, V1_RATE_LIMITS } from "@/lib/security/rate-limit";
import { sanitizeForLog } from "@/lib/logger/redact";

const MAX_PROMPT_TRANSCRIPT_CHARS = 1_500_000;

const schema = z.object({
  transcript: z
    .string()
    .min(20, "Transcript must be at least 20 characters.")
    .max(
      MAX_PROMPT_TRANSCRIPT_CHARS,
      "Transcript is too large for the prompt helper. You can still fill in goals manually and generate clips.",
    ),
  videoTitle: z.string().max(300).optional(),
  platform: z.enum(["YouTube Shorts", "TikTok", "Instagram Reels", "All Platforms"]).optional(),
  customInstructions: z.string().max(500).optional(),
  qualityMode: z.enum(QUALITY_MODE_VALUES).optional().default("balanced"),
  clipIntent: z.enum(CLIP_INTENT_VALUES).optional().default("auto"),
  transcriptPrecision: z
    .enum(["word", "segment", "diarized_segment", "approximate", "none"])
    .nullable()
    .transform((value) => value ?? undefined)
    .optional(),
  videoDurationSec: z
    .number()
    .positive()
    .max(24 * 60 * 60)
    .nullable()
    .transform((value) => value ?? undefined)
    .optional(),
  debugModelOverride: z.string().trim().min(1).optional(),
});

export async function POST(request: Request) {
  const originError = assertSameOriginRequest(request);
  if (originError) return originError;

  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const rateLimit = await consumeV1RateLimit({
    request,
    userId: user.id,
    routeKey: "generate-prompts",
    rules: V1_RATE_LIMITS.GENERATE_PROMPTS,
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit, "Prompt helper is being used too quickly. Please wait and try again.");
  }

  const parsed = await parseJson(request, schema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { data } = parsed;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, subscriptionTier: true, email: true },
  });
  const debugAllowed = canUseModelDebug({
    userEmail: dbUser?.email ?? user.email ?? null,
    isDev: process.env.NODE_ENV !== "production",
  });

  if (data.debugModelOverride && !debugAllowed) {
    return fail(400, "Raw model overrides are not available for this account.");
  }

  try {
    logger.info('Generating transcript-based prompts', {
      userId: user.id,
      transcriptLength: data.transcript.length,
      videoTitle: data.videoTitle,
      platform: data.platform,
      qualityMode: data.qualityMode,
      clipIntent: data.clipIntent,
    });

    const result = await promptGeneratorService.generateFromTranscript({
      transcript: data.transcript,
      videoTitle: data.videoTitle,
      platform: data.platform,
      customInstructions: data.customInstructions,
      qualityMode: data.qualityMode,
      clipIntent: data.clipIntent,
      userPlan: dbUser?.subscriptionTier ?? dbUser?.plan ?? "free",
      videoDurationSec: data.videoDurationSec,
      transcriptPrecision: data.transcriptPrecision,
      requestedOverrideModel: debugAllowed ? data.debugModelOverride : undefined,
      isAdmin: debugAllowed,
      isDev: process.env.NODE_ENV !== "production",
    });

    logger.info('Transcript-based prompts generated', {
      briefLength: result.prompts.brief.length,
      audienceLength: result.prompts.audience.length,
      source: result.source,
      model: result.model,
    });

    return ok(result);
  } catch (error) {
    logger.error('Failed to generate prompts', sanitizeForLog(error) as Record<string, unknown>);
    if (error instanceof Error && /transcript is empty/i.test(error.message)) {
      return fail(400, "Transcript is empty.");
    }
    return fail(500, 'Failed to generate prompts');
  }
}
