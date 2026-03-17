export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/keywords/history
 * Get keyword search history with stats
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userId = session.user.id;

    // Check if the model exists
    try {
      if (!(prisma as any).keywordResearch) {
        return NextResponse.json(
          {
            data: [],
            stats: {
              totalSearches: 0,
              avgSearchVolume: 0,
              avgCompetition: 0,
              avgViews: 0,
              difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
            },
            message: "Keyword research feature not yet available",
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    } catch {
      return NextResponse.json(
        {
          data: [],
          stats: {
            totalSearches: 0,
            avgSearchVolume: 0,
            avgCompetition: 0,
            avgViews: 0,
            difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
          },
          message: "Keyword research feature not yet available",
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Fetch user's keyword research records
    const records = await prisma.keywordResearch.findMany({
      where: { userId },
      orderBy: { lastUpdated: "desc" },
    });

    // Calculate stats
    const totalSearches = records.length;

    const avgSearchVolume =
      totalSearches > 0
        ? Math.round(
            records.reduce((sum, r) => sum + r.searchVolume, 0) /
              totalSearches
          )
        : 0;

    const avgCompetition =
      totalSearches > 0
        ? Math.round(
            records.reduce((sum, r) => sum + r.competition, 0) /
              totalSearches
          )
        : 0;

    const avgViews =
      totalSearches > 0
        ? Math.round(
            records.reduce((sum, r) => sum + (r.avgViews || 0), 0) /
              totalSearches
          )
        : 0;

    // Difficulty distribution
    const difficultyDistribution = {
      easy: records.filter((r) => r.difficulty === "easy").length,
      medium: records.filter((r) => r.difficulty === "medium").length,
      hard: records.filter((r) => r.difficulty === "hard").length,
    };

    // Format records for response
    const data = records.map((record) => ({
      id: record.id,
      keyword: record.keyword,
      searchVolume: record.searchVolume,
      competition: record.competition,
      difficulty: record.difficulty,
      trendDirection: record.trendDirection,
      avgViews: record.avgViews,
      avgLikes: record.avgLikes,
      avgComments: record.avgComments,
      estimatedCPM: record.estimatedCPM,
      searchIntent: record.searchIntent,
      isSaved: record.isSaved,
      tags: record.tags,
      relatedKeywords: record.relatedKeywords,
      topVideos: record.topVideos,
      lastUpdated: record.lastUpdated,
      createdAt: record.createdAt,
    }));

    return NextResponse.json(
      {
        data,
        stats: {
          totalSearches,
          avgSearchVolume,
          avgCompetition,
          avgViews,
          difficultyDistribution,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Keywords] History error:", error);
    return NextResponse.json(
      { error: "Failed to get keyword history" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
