export const dynamic = "force-dynamic";
export const revalidate = 0;
// Note: maxDuration requires Vercel Pro plan. Remove if not on Pro.
// export const maxDuration = 60;

import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limiter";
import { formatPlanName, getRuntimeCoreUsageLimit, resolvePlanTier } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateThumbnailVariations } from "@/lib/ai/thumbnail-generator";
import { uploadImageFromUrl } from "@/lib/storage/supabase-storage";
import { ThumbnailGeneratorInput } from "@/types/thumbnail";

const thumbnailInputSchema = z.object({
  contentIdeaId: z.string().optional(),
  videoTitle: z.string().min(5, "Video title is required"),
  niche: z.string().min(2, "Niche is required"),
  thumbnailStyle: z.enum(['bold', 'minimal', 'dramatic', 'informative', 'meme']),
  mainSubject: z.enum(['person', 'product', 'text', 'abstract', 'split-screen']),
  colorScheme: z.enum(['vibrant', 'dark', 'bright', 'professional', 'auto']),
  includeText: z.boolean(),
  textOverlay: z.string().max(30).optional(),
  faceExpression: z.enum(['excited', 'shocked', 'serious', 'happy', 'focused']).optional(),
  additionalElements: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rateLimitResult = checkRateLimit(user.id, RATE_LIMITS.thumbnailGenerate);
    const rlHeaders = rateLimitHeaders(rateLimitResult, RATE_LIMITS.thumbnailGenerate);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before generating more.", retryAfterSec: rateLimitResult.retryAfterSec },
        { status: 429, headers: rlHeaders }
      );
    }

    // Parse and validate input
    const body = await request.json();
    const result = thumbnailInputSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const input: ThumbnailGeneratorInput = result.data;

    // Check usage limits - fetch subscription tier from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionTier: true },
    });
    const tier = resolvePlanTier(dbUser?.subscriptionTier || "free");
    const limit = getRuntimeCoreUsageLimit(tier, "thumbnails");

    if (Number.isFinite(limit)) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const usageCount = await prisma.usageLog.count({
        where: {
          userId: user.id,
          feature: 'thumbnail',
          createdAt: { gte: startOfMonth },
        },
      });

      if (usageCount >= limit) {
        return NextResponse.json(
          {
            error: `Monthly limit reached. You can generate ${limit} thumbnails per month on the ${formatPlanName(tier)} plan.`,
            limit,
            used: usageCount,
          },
          { status: 429, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Generate 3 thumbnail variations
    logger.info('[Thumbnail API] Generating thumbnails', { userId: user.id, videoTitle: input.videoTitle });

    const variations = await generateThumbnailVariations(input, 3);

    // Create batch ID for grouping
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Save thumbnails to database with permanent storage
    const savedThumbnails = await Promise.all(
      variations.map(async (variation, index) => {
        // Upload image to Supabase Storage for permanent storage
        const storagePath = `${user.id}/${batchId}/${index}.png`;
        logger.info('[Thumbnail API] Uploading image to Supabase', { storagePath });

        let permanentImageUrl: string;
        try {
          const { publicUrl } = await uploadImageFromUrl(
            variation.imageUrl, // Temporary DALL-E URL
            storagePath,
            'thumbnails'
          );
          permanentImageUrl = publicUrl;
          logger.info('[Thumbnail API] Image uploaded successfully', { publicUrl });
        } catch (uploadError: any) {
          logger.error('[Thumbnail API] Supabase upload failed, using temporary URL', {
            error: uploadError.message
          });
          // Fallback to temporary URL if upload fails
          permanentImageUrl = variation.imageUrl;
        }

        return prisma.thumbnail.create({
          data: {
            userId: user.id,
            contentIdeaId: input.contentIdeaId,
            generationBatchId: batchId,
            videoTitle: input.videoTitle,
            niche: input.niche,
            thumbnailStyle: input.thumbnailStyle,
            mainSubject: input.mainSubject,
            colorScheme: input.colorScheme,
            includeText: input.includeText,
            textOverlay: input.textOverlay,
            faceExpression: input.faceExpression,
            additionalElements: input.additionalElements || [],
            imageUrl: permanentImageUrl, // Use permanent Supabase URL
            storagePath: storagePath,
            thumbnailPrompt: variation.revisedPrompt,
            aiModel: 'dall-e-3',
            ctrScore: variation.analysis.ctrScore,
            contrastScore: variation.analysis.contrastScore,
            mobileReadability: variation.analysis.mobileReadability,
            emotionalImpact: variation.analysis.emotionalImpact,
            nicheAlignment: variation.analysis.nicheAlignment,
            overallRank: index + 1,
            improvements: variation.analysis.improvements,
            reasoning: variation.analysis.reasoning,
            isPrimary: index === 0, // First one is primary by default
          },
        });
      })
    );

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        feature: 'thumbnail',
        creditsUsed: 1,
        metadata: {
          batchId,
          videoTitle: input.videoTitle,
          thumbnailCount: variations.length,
        },
      },
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "creator_first_thumbnail_generated",
      metadata: {
        source: "thumbnail_generator",
        batchId,
      },
    });

    logger.info('[Thumbnail API] Thumbnails generated successfully', {
      userId: user.id,
      batchId,
      count: savedThumbnails.length,
    });

    return NextResponse.json(
      {
        thumbnails: savedThumbnails,
        batchId,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    logger.error('[Thumbnail API] Generation failed', { error: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to generate thumbnails" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
