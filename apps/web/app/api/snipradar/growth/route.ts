export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateGrowthPlan } from "@/lib/ai/growth-planner";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import { SNIPRADAR } from "@/lib/constants/snipradar";

/**
 * POST /api/snipradar/growth
 * Generate a personalized 3-phase X growth plan for the current user.
 * Uses account state, niche, and 30-day content analytics as context.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit(
      "snipradar:growth:generate",
      user.id,
      [
        {
          name: "burst",
          windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
          maxHits: 3, // 3 plan generations per burst window
        },
      ]
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating another growth plan." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const plan = await generateGrowthPlan(user.id);

    if (!plan) {
      return NextResponse.json(
        {
          error:
            "Could not generate plan. Connect your X account to get started.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ plan });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err?.message?.startsWith("RATE_LIMIT:")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Try again in a few minutes." },
        { status: 429 }
      );
    }
    console.error("[SnipRadar Growth] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate growth plan" },
      { status: 500 }
    );
  }
}
