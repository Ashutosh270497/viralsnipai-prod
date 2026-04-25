export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { promptGeneratorService } from "@/lib/services/prompt-generator.service";
import { logger } from "@/lib/logger";
import {
  getOpenRouterFailureSummary,
  getSafeOpenRouterErrorMessage,
  OpenRouterUpstreamError,
} from "@/lib/openrouter-client";

const schema = z.object({
  transcript: z.string().min(20).max(15000),
  videoTitle: z.string().max(300).optional(),
  platform: z.enum(["YouTube Shorts", "TikTok", "Instagram Reels", "All Platforms"]).optional(),
  customInstructions: z.string().max(500).optional(),
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

  const { data } = parsed;

  try {
    logger.info('Generating transcript-based prompts', {
      userId: user.id,
      transcriptLength: data.transcript.length,
      videoTitle: data.videoTitle,
      platform: data.platform,
    });

    const prompts = await promptGeneratorService.generateFromTranscript({
      transcript: data.transcript,
      videoTitle: data.videoTitle,
      platform: data.platform,
      customInstructions: data.customInstructions,
    });

    logger.info('Transcript-based prompts generated', {
      briefLength: prompts.brief.length,
      audienceLength: prompts.audience.length,
    });

    return ok({ prompts });
  } catch (error) {
    logger.error('Failed to generate prompts', error instanceof Error ? error : { error });
    if (error instanceof OpenRouterUpstreamError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AI_PROVIDER_UNAVAILABLE',
            message: getSafeOpenRouterErrorMessage(error),
            failures: getOpenRouterFailureSummary(error),
          },
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return fail(500, 'Failed to generate prompts');
  }
}
