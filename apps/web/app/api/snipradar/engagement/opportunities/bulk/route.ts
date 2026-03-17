export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import { syncLeadFromOpportunity } from "@/lib/snipradar/relationship-graph";

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(["new", "saved", "replied", "ignored"]),
});

/**
 * PATCH /api/snipradar/engagement/opportunities/bulk
 * Bulk update opportunity status for current user
 */
export async function PATCH(request: Request) {
  const requestStartedAt = Date.now();
  const user = await getCurrentUser();
  const respond = (
    body: unknown,
    status = 200,
    meta?: Record<string, unknown>
  ) => {
    const response = NextResponse.json(body, { status });
    attachServerTiming(response, "snipradar_engagement_bulk", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/engagement/opportunities/bulk",
      method: "PATCH",
      status,
      durationMs: Date.now() - requestStartedAt,
      userId: user?.id,
      meta,
    });
    return response;
  };
  if (!user) {
    return respond({ error: "Unauthorized" }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return respond({ error: "Invalid bulk payload" }, 400);
  }

  const existing = await prisma.xEngagementOpportunity.findMany({
    where: {
      userId: user.id,
      id: { in: parsed.data.ids },
    },
  });

  const result = await prisma.xEngagementOpportunity.updateMany({
    where: {
      userId: user.id,
      id: { in: parsed.data.ids },
    },
    data: {
      status: parsed.data.status,
      lastSeenAt: new Date(),
    },
  });

  if (parsed.data.status === "saved" || parsed.data.status === "replied") {
    const changed = existing.filter((item) => item.status !== parsed.data.status);
    await Promise.allSettled(
      changed.map((item) =>
        syncLeadFromOpportunity({
          userId: user.id,
          opportunity: {
            id: item.id,
            tweetId: item.tweetId,
            authorXUserId: item.authorXUserId,
            authorUsername: item.authorUsername,
            authorName: item.authorName,
            authorAvatar: item.authorAvatar,
            status: parsed.data.status,
            score: item.score,
            text: item.text,
          },
        })
      )
    );
  }

  return respond({ success: true, updated: result.count });
}
