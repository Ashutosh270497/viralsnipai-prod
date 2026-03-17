// Niche data is static in-memory — responses are user-specific (auth-gated)
// but the filtered data never changes at runtime. Keep dynamic for auth
// but allow the data cache to reuse filtered results within a request.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { NICHE_DATABASE, getNicheById } from "@/lib/niche-data";
import type { NicheCategory, CompetitionLevel, GrowthTrend, NicheData } from "@/lib/types/niche";

// Query params schema
const filterSchema = z.object({
  category: z.string().optional(),
  competition: z.enum(["low", "medium", "high"]).optional(),
  monetizationMin: z.coerce.number().min(1).max(10).optional(),
  growthTrend: z.enum(["rising", "stable", "declining"]).optional(),
  faceless: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
});

// GET /api/niche-discovery/niches - Get all niches with optional filters
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = {
      category: searchParams.get("category") || undefined,
      competition: searchParams.get("competition") || undefined,
      monetizationMin: searchParams.get("monetizationMin") || undefined,
      growthTrend: searchParams.get("growthTrend") || undefined,
      faceless: searchParams.get("faceless") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "20",
    };

    const result = filterSchema.safeParse(params);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { category, competition, monetizationMin, growthTrend, faceless, search, page, pageSize } = result.data;

    // Apply filters
    let filteredNiches = [...NICHE_DATABASE];

    if (category) {
      filteredNiches = filteredNiches.filter(
        (niche) => niche.category === category
      );
    }

    if (competition) {
      filteredNiches = filteredNiches.filter(
        (niche) => niche.competitionLevel === competition
      );
    }

    if (monetizationMin) {
      filteredNiches = filteredNiches.filter(
        (niche) => niche.monetizationPotential >= monetizationMin
      );
    }

    if (growthTrend) {
      filteredNiches = filteredNiches.filter(
        (niche) => niche.growthTrend === growthTrend
      );
    }

    if (faceless === true) {
      filteredNiches = filteredNiches.filter(
        (niche) => !niche.requiresFace
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredNiches = filteredNiches.filter(
        (niche) =>
          niche.name.toLowerCase().includes(searchLower) ||
          niche.description.toLowerCase().includes(searchLower) ||
          niche.keywords.some((kw) => kw.toLowerCase().includes(searchLower)) ||
          niche.category.toLowerCase().includes(searchLower)
      );
    }

    // Sort by monetization potential (highest first)
    filteredNiches.sort((a, b) => b.monetizationPotential - a.monetizationPotential);

    // Pagination
    const totalCount = filteredNiches.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;
    const paginatedNiches = filteredNiches.slice(offset, offset + pageSize);

    // Transform to response format
    const niches = paginatedNiches.map((niche) => ({
      id: niche.id,
      name: niche.name,
      category: niche.category,
      description: niche.description,
      competitionLevel: niche.competitionLevel,
      monetizationPotential: niche.monetizationPotential,
      averageCPM: niche.averageCPM,
      growthTrend: niche.growthTrend,
      exampleChannels: niche.exampleChannels.slice(0, 3),
      contentTypes: niche.contentTypes,
      targetAudience: niche.targetAudience,
      keywords: niche.keywords.slice(0, 5),
      requiresFace: niche.requiresFace,
      minHoursPerWeek: niche.minHoursPerWeek,
      bestForSkillLevel: niche.bestForSkillLevel,
    }));

    return NextResponse.json(
      {
        niches,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasMore: page < totalPages,
        },
        filters: {
          category,
          competition,
          monetizationMin,
          growthTrend,
          faceless,
          search,
        },
      },
      {
        headers: {
          // Private (per-user auth), but the niche data itself is static — cache in browser for 5 min
          "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[Niche Browser] Error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching niches" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
