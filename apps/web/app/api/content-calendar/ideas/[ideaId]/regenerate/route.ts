export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * POST /api/content-calendar/ideas/[ideaId]/regenerate
 * Regenerate a specific content idea with new AI suggestions
 */
export async function POST(
  request: Request,
  { params }: { params: { ideaId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Verify ownership
    const idea = await prisma.contentIdea.findFirst({
      where: {
        id: params.ideaId,
        userId: user.id,
      },
    });

    if (!idea) {
      return NextResponse.json(
        { error: "Idea not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const niche = idea.niche || "general content";
    const videoType = idea.videoType || "long-form";

    // Generate new idea using AI
    let newIdeaData;

    if (openai) {
      try {
        const systemPrompt = `You are a YouTube content strategist. Generate ONE strategic video idea for the niche: ${niche}.

Video Type: ${videoType === "short" ? "Short-form (under 60 seconds)" : "Long-form (8-15 minutes)"}

Respond ONLY with valid JSON in this exact format:
{
  "title": "Engaging video title",
  "description": "Detailed description",
  "viralityScore": 75,
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "searchVolume": 50000,
  "competitionScore": 6,
  "estimatedViews": 25000,
  "contentCategory": "trending",
  "reasoning": "Why this idea will work",
  "hookSuggestions": ["Hook 1", "Hook 2", "Hook 3"],
  "thumbnailIdeas": ["Thumbnail concept 1", "Thumbnail concept 2"]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate the video idea." },
          ],
          temperature: 0.9,
          response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content generated");
        }

        newIdeaData = JSON.parse(content);
      } catch (error) {
        logger.error("[Content Calendar] OpenAI regeneration failed", { error });
        // Fall back to mock data
        newIdeaData = generateMockIdea(niche, videoType);
      }
    } else {
      // No API key, use mock data
      newIdeaData = generateMockIdea(niche, videoType);
    }

    // Update the idea
    const updatedIdea = await prisma.contentIdea.update({
      where: {
        id: params.ideaId,
      },
      data: {
        title: newIdeaData.title,
        description: newIdeaData.description,
        viralityScore: newIdeaData.viralityScore,
        keywords: newIdeaData.keywords,
        searchVolume: newIdeaData.searchVolume,
        competitionScore: newIdeaData.competitionScore,
        estimatedViews: newIdeaData.estimatedViews,
        contentCategory: newIdeaData.contentCategory,
        aiReasoning: newIdeaData.reasoning,
        hookSuggestions: newIdeaData.hookSuggestions,
        thumbnailIdeas: newIdeaData.thumbnailIdeas,
      },
    });

    logger.info("[Content Calendar] Idea regenerated", {
      ideaId: params.ideaId,
      userId: user.id,
    });

    return NextResponse.json(
      { idea: updatedIdea },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[Content Calendar] Failed to regenerate idea", { error: error instanceof Error ? error : { error } });
    return NextResponse.json(
      { error: "Failed to regenerate idea" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

function generateMockIdea(niche: string, videoType: string) {
  const mockTitles = [
    `${niche} Secrets Nobody Tells You`,
    `The Truth About ${niche} in 2024`,
    `How I Mastered ${niche} (Step by Step)`,
    `${niche} Mistakes to Avoid`,
    `${niche}: Beginner to Pro Guide`,
  ];

  const randomTitle = mockTitles[Math.floor(Math.random() * mockTitles.length)];

  return {
    title: randomTitle,
    description: `A comprehensive guide to ${niche} that covers everything you need to know. Perfect for ${videoType === "short" ? "quick consumption" : "deep learning"}.`,
    viralityScore: Math.floor(Math.random() * 40) + 60,
    keywords: [`${niche} tips`, `${niche} tutorial`, `${niche} guide`],
    searchVolume: Math.floor(Math.random() * 100000) + 10000,
    competitionScore: Math.floor(Math.random() * 7) + 3,
    estimatedViews: Math.floor(Math.random() * 50000) + 5000,
    contentCategory: ["trending", "evergreen", "experimental"][Math.floor(Math.random() * 3)],
    reasoning: `This idea leverages current interest in ${niche} while providing unique value through a fresh perspective. The topic has strong search demand and moderate competition, making it ideal for growth.`,
    hookSuggestions: [
      `Stop! If you're into ${niche}, you NEED to see this...`,
      `I wish someone told me this about ${niche} sooner...`,
      `The ${niche} industry doesn't want you to know this...`,
    ],
    thumbnailIdeas: [
      `Bold text overlay: "${niche} REVEALED" with shocked expression`,
      `Before/after split screen showing ${niche} transformation`,
    ],
  };
}
