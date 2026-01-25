export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { promptGeneratorService } from "@/lib/services/prompt-generator.service";
import { logger } from "@/lib/logger";

const schema = z.object({
  context: z.string().min(10).max(2000),
  contentType: z.string().optional(),
  platform: z.enum(["YouTube Shorts", "TikTok", "Instagram Reels", "All Platforms"]).optional(),
  targetLength: z.number().min(15).max(90).optional(),
  customInstructions: z.string().max(500).optional(),
  useTemplate: z.boolean().optional()
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
    logger.info('Generating AI prompts', {
      userId: user.id,
      contextLength: data.context.length,
      contentType: data.contentType,
      platform: data.platform,
      useTemplate: data.useTemplate
    });

    let prompts;

    // If user wants template-based generation (faster)
    if (data.useTemplate && data.contentType) {
      prompts = promptGeneratorService.getTemplatePrompts(
        data.contentType,
        data.platform || 'YouTube Shorts'
      );

      logger.info('Template prompts generated', {
        contentType: data.contentType,
        platform: data.platform
      });
    } else {
      // AI-powered generation (more customized)
      prompts = await promptGeneratorService.generatePrompts({
        context: data.context,
        contentType: data.contentType,
        platform: data.platform,
        targetLength: data.targetLength,
        customInstructions: data.customInstructions
      });

      logger.info('AI prompts generated successfully', {
        briefLength: prompts.brief.length,
        audienceLength: prompts.audience.length
      });
    }

    return ok({ prompts });

  } catch (error) {
    logger.error('Failed to generate prompts', error);
    return fail(500, error instanceof Error ? error.message : 'Failed to generate prompts');
  }
}
