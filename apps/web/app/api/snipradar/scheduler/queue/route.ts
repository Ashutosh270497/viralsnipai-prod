export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ThreadQueueItem {
  type: "thread";
  groupId: string;
  status: string;
  scheduledFor: string | null;
  tweetCount: number;
  hookText: string;
  tweets: Array<{ id: string; text: string; threadOrder: number }>;
  createdAt: string;
}

export interface PostQueueItem {
  type: "post";
  id: string;
  text: string;
  hookType: string | null;
  status: string;
  scheduledFor: string | null;
  viralPrediction: number | null;
  createdAt: string;
}

export type QueueItem = ThreadQueueItem | PostQueueItem;

export interface SchedulerQueueResponse {
  scheduled: QueueItem[];
  ready: QueueItem[];
}

// ── GET /api/snipradar/scheduler/queue ────────────────────────────────────

export async function GET(): Promise<NextResponse<SchedulerQueueResponse | { error: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" } as any, { status: 401 });
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });

    if (!xAccount) {
      return NextResponse.json({ scheduled: [], ready: [] });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch all scheduled + draft items in one query
    const allDrafts = await prisma.tweetDraft.findMany({
      where: {
        userId: user.id,
        xAccountId: xAccount.id,
        status: { in: ["scheduled", "draft"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        text: true,
        hookType: true,
        format: true,
        status: true,
        threadGroupId: true,
        threadOrder: true,
        scheduledFor: true,
        viralPrediction: true,
        createdAt: true,
      },
    });

    // Separate thread vs single-post drafts
    const threadMap = new Map<string, typeof allDrafts>();
    const singlePosts: typeof allDrafts = [];

    for (const draft of allDrafts) {
      if (draft.threadGroupId) {
        if (!threadMap.has(draft.threadGroupId)) {
          threadMap.set(draft.threadGroupId, []);
        }
        threadMap.get(draft.threadGroupId)!.push(draft);
      } else {
        singlePosts.push(draft);
      }
    }

    // Build thread queue items
    const threadItems: ThreadQueueItem[] = [...threadMap.entries()].map(
      ([groupId, tweets]) => {
        const sorted = [...tweets].sort(
          (a, b) => (a.threadOrder ?? 0) - (b.threadOrder ?? 0)
        );
        const first = sorted[0];
        return {
          type: "thread",
          groupId,
          status: first?.status ?? "draft",
          scheduledFor: first?.scheduledFor?.toISOString() ?? null,
          tweetCount: sorted.length,
          hookText: first?.text ?? "",
          tweets: sorted.map((t) => ({
            id: t.id,
            text: t.text,
            threadOrder: t.threadOrder ?? 0,
          })),
          createdAt: first?.createdAt.toISOString() ?? new Date().toISOString(),
        };
      }
    );

    // Build single post queue items
    const postItems: PostQueueItem[] = singlePosts.map((d) => ({
      type: "post",
      id: d.id,
      text: d.text,
      hookType: d.hookType,
      status: d.status,
      scheduledFor: d.scheduledFor?.toISOString() ?? null,
      viralPrediction: d.viralPrediction,
      createdAt: d.createdAt.toISOString(),
    }));

    const allItems: QueueItem[] = [...threadItems, ...postItems];

    // Split into scheduled vs ready
    const scheduled = allItems
      .filter((item) => item.status === "scheduled")
      .sort((a, b) => {
        const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
        const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
        return ta - tb; // soonest first
      });

    const ready = allItems
      .filter((item) => item.status === "draft")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return NextResponse.json({ scheduled, ready });
  } catch (error) {
    console.error("[SnipRadar Scheduler Queue] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch scheduler queue" } as any, {
      status: 500,
    });
  }
}
