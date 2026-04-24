import { NextRequest, NextResponse } from "next/server";

import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v1CompleteOnboardingSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = v1CompleteOnboardingSchema.parse(body);

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.name,
        creatorType: parsed.creatorType,
        primaryPlatform: parsed.primaryPlatform,
        selectedNiche: parsed.contentNiche,
        contentGoal: parsed.contentGoal,
        onboardingCompleted: true,
      },
    });

    await recordActivationCheckpointSafe({
      userId: updatedUser.id,
      checkpoint: "creator_onboarding_completed",
      metadata: {
        source: "v1_onboarding",
        creatorType: parsed.creatorType,
        primaryPlatform: parsed.primaryPlatform,
        contentGoal: parsed.contentGoal,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        onboardingCompleted: updatedUser.onboardingCompleted,
      },
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "An error occurred during onboarding" },
      { status: 500 },
    );
  }
}
