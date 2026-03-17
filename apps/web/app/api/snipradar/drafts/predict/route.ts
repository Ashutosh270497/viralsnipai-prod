export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { predictVirality } from "@/lib/ai/snipradar-analyzer";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import { computeObjectiveScores } from "@/lib/snipradar/variant-lab";

/**
 * POST /api/snipradar/drafts/predict
 * Predict virality score for a tweet text
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:drafts:predict", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before requesting another prediction." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const text = body.text as string | undefined;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Tweet text is required" },
        { status: 400 }
      );
    }

    const prediction = await predictVirality({
      text: text.trim(),
      niche: body.niche,
      followerCount: body.followerCount,
    });

    if (!prediction) {
      return NextResponse.json(
        { error: "Could not generate prediction" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      prediction,
      objectiveScores: computeObjectiveScores(prediction, text.trim()),
    });
  } catch (error: any) {
    if (error?.message?.startsWith("RATE_LIMIT:")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Try again in a few minutes." },
        { status: 429 }
      );
    }
    console.error("[SnipRadar Predict] POST error:", error);
    return NextResponse.json(
      { error: "Failed to predict virality" },
      { status: 500 }
    );
  }
}
