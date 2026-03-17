export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });

    if (!xAccount) {
      return NextResponse.json({ threads: [], singlePosts: [] });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // All drafts (threads + singles) in the last 30 days
    const allDrafts = await prisma.tweetDraft.findMany({
      where: {
        userId: user.id,
        xAccountId: xAccount.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        text: true,
        format: true,
        hookType: true,
        status: true,
        threadGroupId: true,
        threadOrder: true,
        scheduledFor: true,
        postedAt: true,
        postedTweetId: true,
        viralPrediction: true,
        createdAt: true,
      },
    });

    // Group thread tweets by threadGroupId
    const threadMap = new Map<
      string,
      {
        groupId: string;
        status: string;
        scheduledFor: string | null;
        tweets: typeof allDrafts;
        createdAt: string;
      }
    >();

    const singlePosts: typeof allDrafts = [];

    for (const draft of allDrafts) {
      if (draft.threadGroupId) {
        if (!threadMap.has(draft.threadGroupId)) {
          threadMap.set(draft.threadGroupId, {
            groupId: draft.threadGroupId,
            status: draft.status,
            scheduledFor: draft.scheduledFor?.toISOString() ?? null,
            tweets: [],
            createdAt: draft.createdAt.toISOString(),
          });
        }
        threadMap.get(draft.threadGroupId)!.tweets.push(draft);
      } else {
        singlePosts.push(draft);
      }
    }

    // Sort thread tweets by threadOrder
    const threads = [...threadMap.values()].map((group) => ({
      ...group,
      tweets: [...group.tweets].sort(
        (a, b) => (a.threadOrder ?? 0) - (b.threadOrder ?? 0)
      ),
    }));

    return NextResponse.json({
      threads,
      singlePosts: singlePosts.map((d) => ({
        id: d.id,
        text: d.text,
        format: d.format,
        hookType: d.hookType,
        status: d.status,
        scheduledFor: d.scheduledFor?.toISOString() ?? null,
        postedAt: d.postedAt?.toISOString() ?? null,
        postedTweetId: d.postedTweetId ?? null,
        viralPrediction: d.viralPrediction ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[SnipRadar Contents] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch contents" }, { status: 500 });
  }
}
