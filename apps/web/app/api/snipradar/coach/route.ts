export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateGrowthReport } from "@/lib/ai/growth-coach";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

/**
 * GET /api/snipradar/coach
 * Generate an AI growth report for the current user
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:coach:generate", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating another growth report." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const report = await generateGrowthReport(user.id);

    if (!report) {
      return NextResponse.json(
        { error: "Could not generate report. Make sure you have an active X account and have posted tweets." },
        { status: 400 }
      );
    }

    return NextResponse.json({ report });
  } catch (error: any) {
    if (error?.message?.startsWith("RATE_LIMIT:")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Try again in a few minutes." },
        { status: 429 }
      );
    }
    console.error("[SnipRadar Coach] GET error:", error);
    return NextResponse.json(
      { error: "Failed to generate growth report" },
      { status: 500 }
    );
  }
}
