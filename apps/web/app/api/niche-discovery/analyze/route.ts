export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { openRouterClient, OPENROUTER_MODELS } from "@/lib/openrouter-client";

import { getCurrentUser } from "@/lib/auth";
import { formatPlanName, getRuntimeSecondaryUsageLimit, resolvePlanTier } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import {
  consumeSnipRadarRateLimit,
  buildSnipRadarRateLimitHeaders,
} from "@/lib/snipradar/request-guards";
import { prisma } from "@/lib/prisma";
import { NICHE_DATABASE } from "@/lib/niche-data";
import type { NicheRecommendation, SkillLevel, ContentGoal, ShowFacePreference } from "@/lib/types/niche";

const client = openRouterClient;

// Request validation schema
const analyzeSchema = z.object({
  interests: z.array(z.string()).min(1, "Select at least one interest").max(10),
  availableTime: z.number().min(2).max(40),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
  goal: z.enum(["education", "entertainment", "reviews", "tutorials", "vlogs", "news"]),
  showFace: z.enum(["yes", "no", "maybe"]),
});

// Mock response for when OpenAI is not available
function generateMockRecommendations(
  interests: string[],
  skillLevel: SkillLevel,
  showFace: ShowFacePreference
): NicheRecommendation[] {
  // Filter niches based on basic criteria
  let filteredNiches = NICHE_DATABASE.filter(niche => {
    // Filter by face preference
    if (showFace === "no" && niche.requiresFace) return false;

    // Filter by skill level
    if (!niche.bestForSkillLevel.includes(skillLevel)) return false;

    return true;
  });

  // Sort by monetization potential
  filteredNiches.sort((a, b) => b.monetizationPotential - a.monetizationPotential);

  // Take top 6 and transform to recommendations
  return filteredNiches.slice(0, 6).map((niche, index) => ({
    id: niche.id,
    name: niche.name,
    category: niche.category,
    description: niche.description,
    matchScore: 95 - (index * 8),
    competitionLevel: niche.competitionLevel,
    monetizationPotential: niche.monetizationPotential,
    averageCPM: niche.averageCPM,
    growthTrend: niche.growthTrend,
    exampleChannels: niche.exampleChannels,
    contentTypes: niche.contentTypes,
    targetAudience: niche.targetAudience,
    trendingTopics: niche.keywords.slice(0, 5),
    reasoning: `Based on your interests and ${skillLevel} skill level, ${niche.name} is a great fit. ${niche.description}`,
  }));
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

    // Rate limit: 10 niche analyses per hour per user
    const rateLimit = consumeSnipRadarRateLimit("niche:analyze", user.id, [
      { name: "hourly", windowMs: 60 * 60 * 1000, maxHits: 10 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many analysis requests. Please wait before trying again." },
        { status: 429, headers: { "Cache-Control": "no-store", ...buildSnipRadarRateLimitHeaders(rateLimit) } }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const result = analyzeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { interests, availableTime, skillLevel, goal, showFace } = result.data;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, subscriptionTier: true },
    });

    // Check usage limits
    const existingUsage = await prisma.usageLog.count({
      where: {
        userId: user.id,
        feature: "niche_discovery",
      },
    });

    const tier = resolvePlanTier(dbUser?.subscriptionTier || dbUser?.plan || "free");
    const limit = getRuntimeSecondaryUsageLimit(tier, "nicheDiscoveryAnalyses");
    if (Number.isFinite(limit) && existingUsage >= limit) {
      return NextResponse.json(
        {
          error: "Usage limit reached",
          message: `You've used all ${limit} niche discovery analyses on the ${formatPlanName(tier)} plan. Upgrade to continue.`,
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    let recommendations: NicheRecommendation[];

    if (!client) {
      // Use mock data if no OpenAI API key
      logger.debug("[Niche Discovery] No OpenAI API key, using mock data");
      recommendations = generateMockRecommendations(interests, skillLevel, showFace);
    } else {
      // Use OpenAI for analysis
      logger.debug("[Niche Discovery] Using OpenRouter model", { model: OPENROUTER_MODELS.nicheAnalysis });

      const userProfile = {
        interests,
        availableHoursPerWeek: availableTime,
        skillLevel,
        primaryGoal: goal,
        showFace,
      };

      const systemPrompt = `You are a YouTube niche expert with deep knowledge of the platform's algorithm, monetization strategies, and growth trends for 2025-2026.

Analyze the user's profile and recommend 6-8 YouTube niches that match their interests, available time, and monetization goals.

Available niches database for reference (use these exact IDs and names when relevant):
${JSON.stringify(NICHE_DATABASE.map(n => ({ id: n.id, name: n.name, category: n.category, requiresFace: n.requiresFace, minHoursPerWeek: n.minHoursPerWeek, bestForSkillLevel: n.bestForSkillLevel })), null, 2)}

For each recommended niche, provide:
1. id: Must match an existing niche ID from the database above, or create a custom ID in format "custom-{category}-{name}"
2. name: Niche name
3. category: One of: technology, gaming, education, lifestyle, finance, health, entertainment, business, creative, science, sports, food, travel, parenting, pets, automotive, music, fashion, diy, news
4. description: 2-3 sentences about the niche
5. matchScore: 0-100 based on how well it matches their profile
6. competitionLevel: "low", "medium", or "high"
7. monetizationPotential: 1-10 score
8. averageCPM: Estimated CPM in dollars
9. growthTrend: "rising", "stable", or "declining"
10. exampleChannels: Array of 3 channels with {name, url, subscribers}
11. contentTypes: Array of content types that work (Tutorial, Review, Vlog, etc.)
12. targetAudience: Description of target audience
13. trendingTopics: Array of 5 trending topics in this niche
14. reasoning: 2-3 sentences explaining why this niche fits the user

IMPORTANT RULES:
- Niches with lower competition are better for beginners
- Users with less available time should get niches requiring fewer hours (check minHoursPerWeek)
- If showFace is "no", ONLY recommend niches where requiresFace is false
- If showFace is "maybe", prefer but don't require faceless niches
- Consider current YouTube trends and algorithm preferences for 2025-2026
- Match niches to the user's stated interests as closely as possible
- Higher matchScore = better fit for ALL criteria combined

Return ONLY a valid JSON array of niche recommendations. No markdown, no explanation, just the JSON array.`;

      const response = await client.chat.completions.create({
        model: OPENROUTER_MODELS.nicheAnalysis,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `User Profile:\n${JSON.stringify(userProfile, null, 2)}` },
        ],
        temperature: 0.7,
        max_tokens: 4000,
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
          recommendations = parsed.map((item: any) => ({
            id: item.id || `custom-${item.category}-${item.name?.toLowerCase().replace(/\s+/g, '-')}`,
            name: item.name || "Unknown Niche",
            category: item.category || "entertainment",
            description: item.description || "",
            matchScore: Math.min(100, Math.max(0, Number(item.matchScore) || 70)),
            competitionLevel: item.competitionLevel || "medium",
            monetizationPotential: Math.min(10, Math.max(1, Number(item.monetizationPotential) || 5)),
            averageCPM: Number(item.averageCPM) || 10,
            growthTrend: item.growthTrend || "stable",
            exampleChannels: Array.isArray(item.exampleChannels) ? item.exampleChannels : [],
            contentTypes: Array.isArray(item.contentTypes) ? item.contentTypes : [],
            targetAudience: item.targetAudience || "",
            trendingTopics: Array.isArray(item.trendingTopics) ? item.trendingTopics : [],
            reasoning: item.reasoning || "",
          }));
        } else {
          console.error("[Niche Discovery] Invalid AI response format, using mock");
          recommendations = generateMockRecommendations(interests, skillLevel, showFace);
        }
      } catch (parseError) {
        console.error("[Niche Discovery] Failed to parse AI response:", parseError);
        recommendations = generateMockRecommendations(interests, skillLevel, showFace);
      }
    }

    // Sort by match score
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        feature: "niche_discovery",
        creditsUsed: 1,
        metadata: {
          interests,
          skillLevel,
          goal,
          showFace,
          recommendationsCount: recommendations.length,
        },
      },
    });

    return NextResponse.json(
      {
        recommendations,
        meta: {
          totalRecommendations: recommendations.length,
          analysisTimestamp: new Date().toISOString(),
          remainingAnalyses: Number.isFinite(limit) ? Math.max(0, limit - existingUsage - 1) : null,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Niche Discovery] Error:", error);
    return NextResponse.json(
      { error: "An error occurred during niche analysis" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
