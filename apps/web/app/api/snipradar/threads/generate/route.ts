export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateThreadTweets } from "@/lib/ai/snipradar-phase2";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

const bodySchema = z.object({
  topic: z.string().min(3).max(180),
  tweetCount: z.number().int().min(4).max(12).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:threads:generate", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: Math.max(3, Math.floor(SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS / 2)),
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating another thread." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const payload = bodySchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: payload.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });

    if (!xAccount) {
      return NextResponse.json({ error: "Please connect your X account first." }, { status: 400 });
    }

    const [style, viralPatterns] = await Promise.all([
      prisma.xStyleProfile.findUnique({ where: { userId: user.id }, select: { tone: true } }),
      prisma.viralTweet.findMany({
        where: {
          trackedAccount: { userId: user.id, xAccountId: xAccount.id },
          isAnalyzed: true,
        },
        orderBy: { viralScore: "desc" },
        take: 8,
        select: { text: true, whyItWorked: true },
      }),
    ]);

    const tweets = await generateThreadTweets({
      topic: payload.data.topic,
      niche: user.selectedNiche ?? "general",
      styleTone: style?.tone ?? null,
      viralPatterns,
      tweetCount: payload.data.tweetCount,
    });

    if (tweets.length < 2) {
      return NextResponse.json(
        { error: "AI did not return enough tweets. Try a more specific topic or retry." },
        { status: 500 }
      );
    }

    const threadGroupId = `thr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const drafts = await prisma.$transaction(
      tweets.map((text, idx) =>
        prisma.tweetDraft.create({
          data: {
            userId: user.id,
            xAccountId: xAccount.id,
            text,
            format: "thread",
            hookType: idx === 0 ? "story" : "list",
            threadGroupId,
            threadOrder: idx + 1,
            status: "draft",
          },
        })
      )
    );

    return NextResponse.json({
      threadGroupId,
      drafts: drafts.map((draft) => ({
        id: draft.id,
        text: draft.text,
        threadGroupId: draft.threadGroupId,
        threadOrder: draft.threadOrder,
        status: draft.status,
        createdAt: draft.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[SnipRadar Threads] Generate error:", error);
    return NextResponse.json({ error: "Failed to generate thread" }, { status: 500 });
  }
}
