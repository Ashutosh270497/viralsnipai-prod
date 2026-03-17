export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSnipRadarStarterNiche } from "@/lib/snipradar/starter-accounts";

const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(100).optional().or(z.literal("")),
  goalSelection: z.enum([
    "build_audience",
    "drive_leads",
    "ship_consistently",
    "sell_products",
  ]),
  selectedNiche: z.string().trim().min(2).max(60),
});

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid onboarding payload" },
        { status: 400 },
      );
    }

    const starterNiche = getSnipRadarStarterNiche(parsed.data.selectedNiche);
    const trimmedName = parsed.data.name?.trim() || null;

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(trimmedName ? { name: trimmedName } : {}),
        goalSelection: parsed.data.goalSelection,
        selectedNiche: starterNiche.label,
        nicheInterests: [starterNiche.label],
        nicheData: {
          ecosystem: "snipradar",
          id: starterNiche.id,
          label: starterNiche.label,
          description: starterNiche.description,
          starterHandles: starterNiche.handles,
        },
        onboardingCompleted: true,
      },
      select: {
        id: true,
        name: true,
        selectedNiche: true,
        onboardingCompleted: true,
      },
    });

    return NextResponse.json({
      success: true,
      redirectTo: "/snipradar/discover?welcome=1",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[SnipRadar Onboarding] POST error:", error);
    return NextResponse.json({ error: "Failed to complete SnipRadar onboarding" }, { status: 500 });
  }
}
