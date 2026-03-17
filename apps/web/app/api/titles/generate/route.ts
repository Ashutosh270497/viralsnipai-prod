export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limiter";
import {
  formatPlanName,
  getCoreUsageLimit,
  getRuntimeCoreUsageLimit,
  resolvePlanTier,
  serializeCommercialLimit,
} from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateTitlesWithAI, generateABTestSuggestion } from "@/lib/ai/title-generator";
import { TitleGeneratorInput } from "@/types/title";

const generateTitlesSchema = z.object({
  contentIdeaId: z.string().optional(),
  videoTopic: z.string().min(3, "Video topic is required"),
  keywords: z.array(z.string()).min(1, "At least one keyword is required").max(10),
  targetAudience: z.string().min(3, "Target audience is required"),
  titleStyle: z.enum(['how-to', 'listicle', 'curiosity', 'question', 'authority', 'mixed']),
  maxLength: z.preprocess(
    (val) => {
      // Handle string or number input
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      if ([60, 70, 80].includes(num as number)) return num;
      return 70; // default
    },
    z.union([z.literal(60), z.literal(70), z.literal(80)])
  ),
});

/**
 * POST /api/titles/generate
 * Generate 5 title variations with AI
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rateLimitResult = checkRateLimit(user.id, RATE_LIMITS.titleGenerate);
    const rlHeaders = rateLimitHeaders(rateLimitResult, RATE_LIMITS.titleGenerate);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before generating more.", retryAfterSec: rateLimitResult.retryAfterSec },
        { status: 429, headers: rlHeaders }
      );
    }

    const body = await request.json();
    const result = generateTitlesSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Check usage limits
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, subscriptionTier: true },
    });

    // Count title generations this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const titleGenerationsThisMonth = await prisma.usageLog.count({
      where: {
        userId: user.id,
        feature: 'title',
        createdAt: { gte: startOfMonth },
      },
    });

    const tier = resolvePlanTier(dbUser?.subscriptionTier || dbUser?.plan || "free");
    const limit = getRuntimeCoreUsageLimit(tier, "titles");
    const jsonLimit = serializeCommercialLimit(getCoreUsageLimit(tier, "titles"));

    if (Number.isFinite(limit) && titleGenerationsThisMonth >= limit) {
      return NextResponse.json(
        {
          error: "Usage limit reached",
          message:
            tier === "free"
              ? `You've used all ${limit} title generations this month on the ${formatPlanName(tier)} plan. Upgrade to Starter for more monthly runs or Creator to remove title caps.`
              : `You've used all ${limit} title generations this month on the ${formatPlanName(tier)} plan. Upgrade to Creator to remove title caps.`,
          usage: { used: titleGenerationsThisMonth, limit: jsonLimit, tier },
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const input: TitleGeneratorInput = result.data;

    logger.info('[Title Generator] Generating titles', {
      userId: user.id,
      videoTopic: input.videoTopic,
      style: input.titleStyle,
    });

    // Generate titles with AI
    const titles = await generateTitlesWithAI(input);

    // Generate A/B test suggestion
    const abTestSuggestion = generateABTestSuggestion(titles);

    // Create batch ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save all titles to database
    const savedTitles = await Promise.all(
      titles.map((title, index) =>
        prisma.generatedTitle.create({
          data: {
            userId: user.id,
            contentIdeaId: input.contentIdeaId,
            generationBatchId: batchId,
            title: title.title,
            videoTopic: input.videoTopic,
            keywords: input.keywords,
            targetAudience: input.targetAudience,
            titleStyle: input.titleStyle,
            maxLength: input.maxLength,
            characterLength: title.characterLength,
            ctrScore: title.ctrScore,
            keywordOptimizationScore: title.keywordOptimizationScore,
            curiosityScore: title.curiosityScore,
            clarityScore: title.clarityScore,
            powerWordCount: title.powerWordCount,
            overallRank: title.overallRank,
            reasoning: title.reasoning,
            keywordOptimized: title.keywordOptimized,
            lengthOptimal: title.lengthOptimal,
            titleType: title.titleType,
            isFavorite: false,
            isPrimary: index === 0, // First title is primary by default
          },
        })
      )
    );

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        feature: 'title',
        creditsUsed: 1,
        metadata: {
          batchId,
          videoTopic: input.videoTopic,
          titleCount: titles.length,
          style: input.titleStyle,
        },
      },
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "creator_first_title_generated",
      metadata: {
        source: "title_generator",
        batchId,
      },
    });

    logger.info('[Title Generator] Titles generated successfully', {
      batchId,
      titleCount: titles.length,
    });

    return NextResponse.json(
      {
        batchId,
        titles: savedTitles,
        abTestSuggestion,
        input,
        usage: { used: titleGenerationsThisMonth + 1, limit: jsonLimit, tier },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error('[Title Generator] Generation error', { error });
    return NextResponse.json(
      { error: "Failed to generate titles" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
