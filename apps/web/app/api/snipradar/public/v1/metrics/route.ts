export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  authenticateSnipRadarApiRequest,
  buildSnipRadarPlatformHeaders,
  serializePublicDraft,
} from "@/lib/snipradar/public-api";

function parsePeriodDays(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(7, Math.min(30, Math.round(parsed)));
}

export async function GET(request: NextRequest) {
  const auth = await authenticateSnipRadarApiRequest(request, ["metrics:read"]);
  if (!auth.ok) return auth.response;

  try {
    const periodDays = parsePeriodDays(request.nextUrl.searchParams.get("periodDays"));
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [xAccount, postedDrafts, draftCounts] = await Promise.all([
      prisma.xAccount.findFirst({
        where: { userId: auth.context.userId, isActive: true },
        select: {
          id: true,
          xUsername: true,
          xDisplayName: true,
          followerCount: true,
          followingCount: true,
        },
      }),
      prisma.tweetDraft.findMany({
        where: {
          userId: auth.context.userId,
          status: "posted",
          postedAt: { gte: periodStart },
        },
        orderBy: [{ actualImpressions: "desc" }, { postedAt: "desc" }],
        take: 10,
      }),
      prisma.tweetDraft.groupBy({
        by: ["status"],
        where: { userId: auth.context.userId },
        _count: { _all: true },
      }),
    ]);

    const totalImpressions = postedDrafts.reduce((sum, draft) => sum + (draft.actualImpressions ?? 0), 0);
    const totalEngagement = postedDrafts.reduce(
      (sum, draft) =>
        sum + (draft.actualLikes ?? 0) + (draft.actualRetweets ?? 0) + (draft.actualReplies ?? 0),
      0
    );
    const avgEngagementRate =
      totalImpressions > 0 ? Number(((totalEngagement / totalImpressions) * 100).toFixed(2)) : 0;

    const counts = draftCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});

    return NextResponse.json(
      {
        periodDays,
        source: "db_posted_drafts",
        account: xAccount
          ? {
              xUsername: xAccount.xUsername,
              xDisplayName: xAccount.xDisplayName,
              followerCount: xAccount.followerCount,
              followingCount: xAccount.followingCount,
            }
          : null,
        summary: {
          totalPostedDrafts: postedDrafts.length,
          totalImpressions,
          totalEngagement,
          avgEngagementRate,
          totalDraftCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
          draftCount: counts.draft ?? 0,
          scheduledCount: counts.scheduled ?? 0,
          postedCount: counts.posted ?? 0,
          rejectedCount: counts.rejected ?? 0,
        },
        topPosts: postedDrafts.map(serializePublicDraft),
      },
      { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] Metrics error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load metrics" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}
