export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DayName = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

const DAY_NAMES: DayName[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });

    if (!xAccount) {
      return NextResponse.json({
        slots: [],
        heatmap: [],
        source: "missing_account",
        confidence: "none",
        sampleCount: 0,
        minRequired: 3,
        message: "Connect your X account to unlock best-time prediction.",
      });
    }

    const posts = await prisma.tweetDraft.findMany({
      where: {
        userId: user.id,
        xAccountId: xAccount.id,
        status: "posted",
        postedAt: { not: null },
      },
      select: {
        postedAt: true,
        actualLikes: true,
        actualRetweets: true,
        actualReplies: true,
        actualImpressions: true,
      },
      orderBy: { postedAt: "desc" },
      take: 400,
    });

    if (posts.length < 3) {
      return NextResponse.json({
        slots: [],
        heatmap: [],
        source: "insufficient_data",
        confidence: "none",
        sampleCount: posts.length,
        minRequired: 3,
        message: "Post at least 3 tweets with metrics to generate reliable best time slots.",
      });
    }

    const matrix = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ score: 0, samples: 0 }))
    );

    for (const post of posts) {
      if (!post.postedAt) continue;
      const date = new Date(post.postedAt);
      const day = date.getDay();
      const hour = date.getHours();

      const likes = post.actualLikes ?? 0;
      const retweets = post.actualRetweets ?? 0;
      const replies = post.actualReplies ?? 0;
      const impressions = Math.max(post.actualImpressions ?? 0, 1);
      const engagementRate = ((likes + retweets * 2 + replies * 2.5) / impressions) * 100;
      const score = Math.min(100, Math.max(1, Math.round(engagementRate * 20)));

      matrix[day][hour].score += score;
      matrix[day][hour].samples += 1;
    }

    const flatSlots: Array<{ day: DayName; hour: number; score: number; samples: number }> = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const bucket = matrix[day][hour];
        if (bucket.samples === 0) continue;

        flatSlots.push({
          day: DAY_NAMES[day],
          hour,
          score: Math.round(bucket.score / bucket.samples),
          samples: bucket.samples,
        });
      }
    }

    const top = flatSlots.sort((a, b) => b.score - a.score || b.samples - a.samples).slice(0, 8);

    const heatmap = DAY_NAMES.map((day, dayIdx) => ({
      day,
      hours: Array.from({ length: 24 }, (_, hour) => {
        const bucket = matrix[dayIdx][hour];
        return {
          hour,
          score: bucket.samples > 0 ? Math.round(bucket.score / bucket.samples) : 0,
          samples: bucket.samples,
        };
      }),
    }));

    const confidence = posts.length >= 30 ? "high" : posts.length >= 12 ? "medium" : "low";
    const message =
      confidence === "high"
        ? "Best-time model is using a strong posting history sample."
        : confidence === "medium"
          ? "Best-time model is learning. More posted tweets will improve confidence."
          : "Best-time model is low confidence. Keep posting to improve prediction quality.";

    return NextResponse.json({
      slots: top,
      heatmap,
      source: "posted_history",
      confidence,
      sampleCount: posts.length,
      minRequired: 3,
      message,
    });
  } catch (error) {
    console.error("[SnipRadar Scheduler] Best times error:", error);
    return NextResponse.json({ error: "Failed to calculate best times" }, { status: 500 });
  }
}
