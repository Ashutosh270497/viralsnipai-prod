export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { openRouterClient, OPENROUTER_MODELS } from "@/lib/openrouter-client";
import { addDays, format } from "date-fns";

import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limiter";
import { formatPlanName, getRuntimeSecondaryUsageLimit, resolvePlanTier } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type {
  GenerateCalendarRequest,
  GenerateCalendarResponse,
  VideoIdea,
  ContentCategory,
  VideoType,
} from "@/lib/types/content-calendar";

const client = openRouterClient;

// Request validation schema
const generateCalendarSchema = z.object({
  niche: z.string().min(1, "Niche is required"),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid start date"),
  durationDays: z.number().int().min(7).max(30),
  nicheData: z.object({
    targetAudience: z.string().optional(),
    competitionLevel: z.string().optional(),
    monetizationPotential: z.number().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
  userSkillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

/**
 * Generate mock video ideas for development/fallback
 */
function generateMockIdeas(
  niche: string,
  startDate: Date,
  durationDays: number
): Partial<VideoIdea>[] {
  const ideas: Partial<VideoIdea>[] = [];
  const categories: ContentCategory[] = ['trending', 'evergreen', 'experimental'];
  const videoTypes: VideoType[] = ['short', 'long-form'];

  for (let i = 0; i < durationDays; i++) {
    const date = addDays(startDate, i);
    const category = categories[i % 3] as ContentCategory;
    const videoType = i % 5 < 3 ? 'long-form' : 'short';

    ideas.push({
      title: `${niche} Video Idea ${i + 1}: ${category === 'trending' ? 'Trending Topic' : category === 'evergreen' ? 'Ultimate Guide' : 'Unique Angle'}`,
      description: `A ${videoType} video exploring ${niche} content. This ${category} content is designed to attract viewers interested in ${niche}.`,
      videoType,
      viralityScore: Math.floor(Math.random() * 40) + 60, // 60-100
      keywords: [`${niche}`, `${category}`, 'YouTube', 'tutorial', 'guide'],
      searchVolume: Math.floor(Math.random() * 50000) + 10000,
      competitionScore: Math.floor(Math.random() * 5) + 3,
      estimatedViews: Math.floor(Math.random() * 100000) + 10000,
      contentCategory: category,
      reasoning: `This ${category} ${videoType} video leverages ${niche} trends and has strong SEO potential.`,
      scheduledDate: date,
      hookSuggestions: [
        `Did you know this about ${niche}?`,
        `The ${niche} secret nobody talks about`,
        `How I ${niche === 'gaming' ? 'leveled up' : 'mastered'} ${niche} in 30 days`,
      ],
      thumbnailIdeas: [
        `Bold text overlay with ${niche} imagery`,
        `Before/after split screen`,
        `Close-up with shocked expression`,
      ],
      status: 'idea',
      niche,
    });
  }

  return ideas;
}

/**
 * Calculate virality score based on multiple factors
 */
function calculateViralityScore(factors: {
  searchVolume: number;
  competition: number;
  trendScore: number;
  engagement: number;
}): number {
  // Normalize values to 0-1 range
  const searchScore = Math.min(factors.searchVolume / 100000, 1);
  const competitionScore = 1 - (factors.competition / 10); // Lower competition = higher score
  const trendScore = factors.trendScore / 100;
  const engagementScore = factors.engagement / 100;

  // Weighted average
  const score =
    searchScore * 0.3 +
    competitionScore * 0.2 +
    trendScore * 0.2 +
    engagementScore * 0.2 +
    0.1; // Algorithm alignment baseline

  return Math.round(score * 100);
}

/**
 * Generate content calendar using OpenAI
 */
async function generateWithAI(
  request: GenerateCalendarRequest
): Promise<Partial<VideoIdea>[]> {
  if (!client) {
    logger.warn('[Content Calendar] No OpenAI API key, using mock data');
    return generateMockIdeas(request.niche, request.startDate, request.durationDays);
  }

  const { niche, startDate, durationDays, nicheData, userSkillLevel = 'intermediate' } = request;

  // Calculate content mix (trending/evergreen/experimental)
  const trendingCount = Math.ceil(durationDays * 0.3);
  const evergreenCount = Math.ceil(durationDays * 0.5);
  const experimentalCount = durationDays - trendingCount - evergreenCount;

  // Calculate format mix (long-form vs shorts)
  const longFormCount = Math.ceil(durationDays * 0.6);
  const shortFormCount = durationDays - longFormCount;

  const systemPrompt = `You are a YouTube content strategist specializing in ${niche}.

Generate ${durationDays} strategic video ideas optimized for maximum growth and engagement.

CONTENT MIX REQUIREMENTS:
- ${trendingCount} trending topics (30% - capitalize on current interest)
- ${evergreenCount} evergreen content (50% - long-term value)
- ${experimentalCount} experimental/unique angles (20% - stand out content)

FORMAT MIX:
- ${longFormCount} long-form videos (60% - 8-15 minutes)
- ${shortFormCount} shorts (40% - under 60 seconds)

RULES:
1. Each idea must have realistic viral potential (no clickbait)
2. Consider 2024-2025 YouTube algorithm preferences (satisfaction > watch time)
3. Include SEO-optimized keywords
4. Provide strategic reasoning for each idea
5. Mix difficulty levels appropriate for ${userSkillLevel} creators
6. Ensure variety - avoid repetitive topics

TARGET AUDIENCE: ${nicheData?.targetAudience || 'General YouTube viewers interested in ' + niche}
COMPETITION LEVEL: ${nicheData?.competitionLevel || 'Medium'}
SKILL LEVEL: ${userSkillLevel}

For EACH video idea, provide:
- title: Catchy, keyword-rich (60 chars or less)
- description: Detailed description of video content (2-3 sentences)
- videoType: "short" or "long-form"
- viralityScore: Realistic score 1-100 based on potential
- keywords: Array of 5-10 SEO keywords
- searchVolume: Estimated monthly searches (realistic number)
- competitionScore: 1-10 (1=low, 10=high competition)
- estimatedViews: Realistic view estimate for first 30 days
- contentCategory: "trending" | "evergreen" | "experimental"
- reasoning: 2-3 sentences explaining why this will work
- hookSuggestions: Array of 3-5 hook ideas for first 15 seconds
- thumbnailIdeas: Array of 2-3 thumbnail concepts

IMPORTANT: Return ONLY a valid JSON array of ${durationDays} video ideas. No markdown, no explanation.`;

  const userPrompt = `Generate ${durationDays} video ideas for the "${niche}" niche starting from ${format(startDate, 'yyyy-MM-dd')}.

${nicheData?.keywords && nicheData.keywords.length > 0 ? `
Related keywords to consider: ${nicheData.keywords.join(', ')}
` : ''}

Ensure the ideas follow the content mix (${trendingCount} trending, ${evergreenCount} evergreen, ${experimentalCount} experimental) and format mix (${longFormCount} long-form, ${shortFormCount} shorts).

Return JSON array only.`;

  try {
    const response = await client.chat.completions.create({
      model: OPENROUTER_MODELS.contentCalendar,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 6000,
    });

    let text = response.choices?.[0]?.message?.content?.trim() ?? "[]";

    // Clean up response if wrapped in markdown
    if (text.startsWith("```json")) {
      text = text.slice(7);
    }
    if (text.startsWith("```")) {
      text = text.slice(3);
    }
    if (text.endsWith("```")) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Map AI response to our VideoIdea structure
        return parsed.map((item: any, index: number) => ({
          title: item.title || `${niche} Video Idea ${index + 1}`,
          description: item.description || "",
          videoType: (item.videoType === 'short' || item.videoType === 'long-form') ? item.videoType : 'long-form',
          viralityScore: Math.min(100, Math.max(1, Number(item.viralityScore) || 70)),
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          searchVolume: Number(item.searchVolume) || 10000,
          competitionScore: Math.min(10, Math.max(1, Number(item.competitionScore) || 5)),
          estimatedViews: Number(item.estimatedViews) || 10000,
          contentCategory: (['trending', 'evergreen', 'experimental'].includes(item.contentCategory) ? item.contentCategory : 'evergreen') as ContentCategory,
          reasoning: item.reasoning || "",
          scheduledDate: addDays(startDate, index),
          hookSuggestions: Array.isArray(item.hookSuggestions) ? item.hookSuggestions : [],
          thumbnailIdeas: Array.isArray(item.thumbnailIdeas) ? item.thumbnailIdeas : [],
          status: 'idea' as const,
          niche,
        }));
      } else {
        logger.error('[Content Calendar] Invalid AI response format');
        return generateMockIdeas(niche, startDate, durationDays);
      }
    } catch (parseError) {
      logger.error('[Content Calendar] Failed to parse AI response', { error: parseError });
      return generateMockIdeas(niche, startDate, durationDays);
    }
  } catch (error) {
    logger.error('[Content Calendar] AI generation failed', { error });
    return generateMockIdeas(niche, startDate, durationDays);
  }
}

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rateLimitResult = checkRateLimit(user.id, RATE_LIMITS.contentCalendar);
    const rlHeaders = rateLimitHeaders(rateLimitResult, RATE_LIMITS.contentCalendar);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before generating more.", retryAfterSec: rateLimitResult.retryAfterSec },
        { status: 429, headers: rlHeaders }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const result = generateCalendarSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { niche, startDate: startDateStr, durationDays, nicheData, userSkillLevel } = result.data;
    const startDate = new Date(startDateStr);
    const endDate = addDays(startDate, durationDays - 1);

    // Fetch full user to check plan
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, subscriptionTier: true },
    });

    // Check usage limits
    const existingCalendars = await prisma.contentCalendar.count({
      where: {
        userId: user.id,
      },
    });

    const tier = resolvePlanTier(dbUser?.subscriptionTier || dbUser?.plan || "free");
    const limit = getRuntimeSecondaryUsageLimit(tier, "contentCalendarGenerations");
    if (Number.isFinite(limit) && existingCalendars >= limit) {
      return NextResponse.json(
        {
          error: "Usage limit reached",
          message: `You've used all ${limit} content calendar generations on the ${formatPlanName(tier)} plan. Upgrade to generate more.`,
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    logger.info('[Content Calendar] Generating calendar', {
      userId: user.id,
      niche,
      durationDays,
    });

    // Create calendar record
    const calendar = await prisma.contentCalendar.create({
      data: {
        userId: user.id,
        niche,
        startDate,
        endDate,
        durationDays,
        generationStatus: 'generating',
        metadata: {
          userSkillLevel,
          ...nicheData,
        },
      },
    });

    // Generate video ideas with AI
    const generatedIdeas = await generateWithAI({
      userId: user.id,
      niche,
      startDate,
      durationDays,
      nicheData,
      userSkillLevel,
    });

    // Save ideas to database
    const savedIdeas = await Promise.all(
      generatedIdeas.map((idea) =>
        prisma.contentIdea.create({
          data: {
            userId: user.id,
            calendarId: calendar.id,
            title: idea.title!,
            description: idea.description,
            niche: idea.niche,
            videoType: idea.videoType,
            viralityScore: idea.viralityScore,
            keywords: idea.keywords,
            searchVolume: idea.searchVolume,
            competitionScore: idea.competitionScore,
            estimatedViews: idea.estimatedViews,
            scheduledDate: idea.scheduledDate,
            status: idea.status!,
            aiReasoning: idea.reasoning,
            contentCategory: idea.contentCategory,
            hookSuggestions: idea.hookSuggestions,
            thumbnailIdeas: idea.thumbnailIdeas,
          },
        })
      )
    );

    // Update calendar status
    await prisma.contentCalendar.update({
      where: { id: calendar.id },
      data: { generationStatus: 'completed' },
    });

    // Calculate stats
    const stats = {
      totalIdeas: savedIdeas.length,
      trendingCount: savedIdeas.filter((i) => (i.contentCategory as any) === 'trending').length,
      evergreenCount: savedIdeas.filter((i) => (i.contentCategory as any) === 'evergreen').length,
      experimentalCount: savedIdeas.filter((i) => (i.contentCategory as any) === 'experimental').length,
      shortFormCount: savedIdeas.filter((i) => i.videoType === 'short').length,
      longFormCount: savedIdeas.filter((i) => i.videoType === 'long-form').length,
      averageViralityScore: Math.round(
        savedIdeas.reduce((sum, i) => sum + (i.viralityScore || 0), 0) / savedIdeas.length
      ),
    };

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        feature: 'content_calendar_generation',
        creditsUsed: 1,
        metadata: {
          calendarId: calendar.id,
          niche,
          durationDays,
          ideasGenerated: savedIdeas.length,
        },
      },
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "creator_first_content_idea_created",
      metadata: {
        source: "content_calendar_generation",
        calendarId: calendar.id,
        ideasGenerated: savedIdeas.length,
      },
    });

    logger.info('[Content Calendar] Calendar generated successfully', {
      calendarId: calendar.id,
      ideasCount: savedIdeas.length,
    });

    const response: GenerateCalendarResponse = {
      calendarId: calendar.id,
      ideas: savedIdeas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        description: idea.description || '',
        videoType: (idea.videoType as VideoType) || 'long-form',
        viralityScore: idea.viralityScore || 70,
        keywords: (idea.keywords as string[]) || [],
        searchVolume: idea.searchVolume || 0,
        competitionScore: idea.competitionScore || 5,
        estimatedViews: idea.estimatedViews || 0,
        contentCategory: (idea.contentCategory as ContentCategory) || 'evergreen',
        reasoning: idea.aiReasoning || '',
        scheduledDate: idea.scheduledDate!,
        hookSuggestions: (idea.hookSuggestions as string[]) || [],
        thumbnailIdeas: (idea.thumbnailIdeas as string[]) || [],
        status: (idea.status as any) || 'idea',
        niche: idea.niche || undefined,
        calendarId: idea.calendarId || undefined,
        userId: idea.userId,
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt,
      })),
      stats,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logger.error('[Content Calendar] Generation error', { error });
    return NextResponse.json(
      { error: "Failed to generate content calendar" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
