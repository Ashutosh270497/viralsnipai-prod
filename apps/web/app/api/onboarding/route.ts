import { NextRequest, NextResponse } from "next/server";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeOnboardingSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    // Get current session
    const session = await getCurrentSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = completeOnboardingSchema.parse(body);

    // Convert subscriber count string to number (approximate)
    let subscriberCountNum = 0;
    switch (validatedData.subscriberCount) {
      case "0-1k":
        subscriberCountNum = 500;
        break;
      case "1k-10k":
        subscriberCountNum = 5000;
        break;
      case "10k-100k":
        subscriberCountNum = 50000;
        break;
      case "100k-1m":
        subscriberCountNum = 500000;
        break;
      case "1m+":
        subscriberCountNum = 1000000;
        break;
    }

    // Update user with onboarding data
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: validatedData.name,
        youtubeChannelUrl: validatedData.youtubeChannelUrl || null,
        subscriberCount: subscriberCountNum,
        goalSelection: validatedData.goalSelection,
        nicheInterests: validatedData.nicheInterests,
        onboardingCompleted: true
      }
    });

    await recordActivationCheckpointSafe({
      userId: updatedUser.id,
      checkpoint: "creator_onboarding_completed",
      metadata: {
        source: "creator_onboarding",
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        onboardingCompleted: updatedUser.onboardingCompleted
      }
    });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    // Handle other errors
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "An error occurred during onboarding" },
      { status: 500 }
    );
  }
}
