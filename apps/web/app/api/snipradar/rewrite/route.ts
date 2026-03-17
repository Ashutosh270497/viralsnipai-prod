export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyStyle, type StyleProfile } from "@/lib/ai/style-trainer";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

/**
 * POST /api/snipradar/rewrite
 * Rewrite text in the user's trained style
 * Body: { text: string, tone?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:rewrite", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating another rewrite." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const body = await req.json();
    const text = body.text?.trim();
    const toneOverride = typeof body.tone === "string" ? body.tone.trim() : null;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Fetch style profile (optional — works without one using general optimization)
    const profileRecord = await prisma.xStyleProfile.findUnique({
      where: { userId: user.id },
    });

    const styleProfile: StyleProfile = profileRecord?.tone
      ? {
          tone: toneOverride || profileRecord.tone,
          vocabulary: (profileRecord.vocabulary as string[]) ?? [],
          avgLength: profileRecord.avgLength ?? 200,
          emojiUsage: (profileRecord.emojiUsage as StyleProfile["emojiUsage"]) ?? "light",
          hashtagStyle: (profileRecord.hashtagStyle as StyleProfile["hashtagStyle"]) ?? "none",
          sentencePattern: (profileRecord.sentencePattern as StyleProfile["sentencePattern"]) ?? "mixed",
        }
      : {
          tone: toneOverride || "engaging, clear, and conversational",
          vocabulary: [],
          avgLength: 200,
          emojiUsage: "light",
          hashtagStyle: "none",
          sentencePattern: "mixed",
        };

    const rewritten = await applyStyle(text, styleProfile);
    if (!rewritten) {
      return NextResponse.json(
        { error: "Failed to rewrite. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rewritten,
      hasStyleProfile: Boolean(profileRecord?.tone),
    });
  } catch (error: any) {
    if (error?.message?.startsWith("RATE_LIMIT:")) {
      return NextResponse.json(
        { error: "AI rate limit reached. Try again in a few minutes." },
        { status: 429 }
      );
    }
    console.error("[SnipRadar Rewrite] POST error:", error);
    return NextResponse.json({ error: "Failed to rewrite" }, { status: 500 });
  }
}
