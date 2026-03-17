export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { incrementUsage } from "@/lib/billing";
import { generateHookIdeas } from "@/lib/ai/snipradar-phase2";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import { requireSnipRadarUsage } from "@/lib/snipradar/billing-gates-server";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

const bodySchema = z.object({
  topic: z.string().min(3).max(180),
  niche: z.string().max(80).optional(),
  count: z.number().int().min(5).max(20).optional(),
});

const fallbackHooks = (topic: string) => [
  `Most people are doing ${topic} backwards. Here is the fix.`,
  `I tested 3 approaches to ${topic}. One clearly wins.`,
  `If you're stuck with ${topic}, start with this 10-minute move.`,
  `The hard truth about ${topic}: effort is not the bottleneck.`,
  `A simple ${topic} system I wish I used earlier.`,
  `Stop optimizing everything in ${topic}. Optimize this one lever.`,
  `The ${topic} mistake that quietly kills momentum.`,
  `I was wrong about ${topic}. Here is what changed my mind.`,
];

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hookGate = await requireSnipRadarUsage(user.id, "hook_gen", {
      feature: "hookGenerations",
      message: "You have used all hook generations included in your current plan this month.",
    });
    if (!hookGate.ok) {
      return hookGate.response;
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:hooks:generate", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating more hooks." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const payload = bodySchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: payload.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const hooks = await generateHookIdeas({
      topic: payload.data.topic,
      niche: payload.data.niche ?? user.selectedNiche ?? "general",
      count: payload.data.count,
    });

    const result = hooks.length > 0 ? hooks : fallbackHooks(payload.data.topic);

    await incrementUsage(user.id, "hook_gen", 1);

    return NextResponse.json({
      topic: payload.data.topic,
      hooks: result,
      source: hooks.length > 0 ? "ai" : "fallback",
    });
  } catch (error) {
    console.error("[SnipRadar Hooks] POST error:", error);
    return NextResponse.json({ error: "Failed to generate hooks" }, { status: 500 });
  }
}
