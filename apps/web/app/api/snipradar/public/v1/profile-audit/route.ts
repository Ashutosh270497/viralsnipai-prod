export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  authenticateSnipRadarApiRequest,
  buildSnipRadarPlatformHeaders,
} from "@/lib/snipradar/public-api";
import {
  buildProfileAuditHistory,
  restoreProfileAuditFromSnapshot,
} from "@/lib/snipradar/profile-audit";

export async function GET(request: NextRequest) {
  const auth = await authenticateSnipRadarApiRequest(request, ["audit:read"]);
  if (!auth.ok) return auth.response;

  try {
    const snapshots = await prisma.xProfileAuditSnapshot.findMany({
      where: { userId: auth.context.userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        score: true,
        grade: true,
        confidence: true,
        headline: true,
        summary: true,
        quickWins: true,
        stats: true,
        pillars: true,
        ai: true,
        createdAt: true,
        xUsername: true,
      },
    });

    if (snapshots.length === 0) {
      return NextResponse.json(
        { audit: null, history: { points: [], snapshotCount: 0 } },
        { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
      );
    }

    const latest = snapshots[0];
    const audit = restoreProfileAuditFromSnapshot({
      score: latest.score,
      grade: latest.grade,
      confidence: latest.confidence,
      headline: latest.headline,
      summary: latest.summary,
      quickWins: latest.quickWins,
      stats: latest.stats,
      pillars: latest.pillars,
      ai: latest.ai,
    });
    const historyPoints = buildProfileAuditHistory(snapshots.slice().reverse());

    return NextResponse.json(
      {
        audit,
        history: {
          points: historyPoints,
          snapshotCount: historyPoints.length,
          latestDelta:
            historyPoints.length >= 2
              ? historyPoints[historyPoints.length - 1]?.deltaFromPrevious ?? null
              : null,
        },
        meta: {
          xUsername: latest.xUsername,
          generatedAt: latest.createdAt.toISOString(),
          snapshotId: latest.id,
          source: "db_snapshot",
        },
      },
      { headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] Profile audit error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load profile audit" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}
