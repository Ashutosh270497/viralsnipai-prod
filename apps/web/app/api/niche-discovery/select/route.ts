export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNicheById, NICHE_DATABASE } from "@/lib/niche-data";

const selectSchema = z.object({
  nicheId: z.string().min(1, "Niche ID is required"),
  nicheName: z.string().min(1, "Niche name is required"),
});

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

    // Parse and validate request body
    const body = await request.json();
    const result = selectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { nicheId, nicheName } = result.data;

    // Look up niche details from our database
    const nicheData = getNicheById(nicheId);

    // Update user profile with selected niche
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        selectedNiche: nicheId,
        nicheData: nicheData
          ? {
              id: nicheData.id,
              name: nicheData.name,
              category: nicheData.category,
              competitionLevel: nicheData.competitionLevel,
              monetizationPotential: nicheData.monetizationPotential,
              contentTypes: nicheData.contentTypes,
              keywords: nicheData.keywords,
            }
          : {
              id: nicheId,
              name: nicheName,
              isCustom: true,
            },
        onboardingCompleted: true,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        selectedNiche: true,
        nicheData: true,
        onboardingCompleted: true,
      },
    });

    // Log the selection
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        feature: "niche_selection",
        creditsUsed: 0,
        metadata: {
          nicheId,
          nicheName,
          isFromDatabase: !!nicheData,
        },
      },
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "creator_onboarding_completed",
      metadata: {
        source: "niche_selection",
        nicheId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Niche selected successfully",
        user: {
          id: updatedUser.id,
          selectedNiche: updatedUser.selectedNiche,
          nicheData: updatedUser.nicheData,
          onboardingCompleted: updatedUser.onboardingCompleted,
        },
        redirectTo: "/dashboard",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Niche Selection] Error:", error);
    return NextResponse.json(
      { error: "An error occurred while selecting niche" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// GET - Get current user's selected niche
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        selectedNiche: true,
        nicheData: true,
      },
    });

    if (!userData?.selectedNiche) {
      return NextResponse.json(
        { hasSelectedNiche: false, niche: null },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Get full niche details if it's from our database
    const nicheDetails = getNicheById(userData.selectedNiche);

    return NextResponse.json(
      {
        hasSelectedNiche: true,
        niche: nicheDetails || userData.nicheData,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Get Selected Niche] Error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching selected niche" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
