export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachServerTiming, logSnipRadarApiTelemetry } from "@/lib/snipradar/api-telemetry";
import { syncLeadFromOpportunity } from "@/lib/snipradar/relationship-graph";

const updateSchema = z.object({
  status: z.enum(["new", "saved", "replied", "ignored"]),
});

/**
 * PATCH /api/snipradar/engagement/opportunities/[id]
 * Update opportunity status
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestStartedAt = Date.now();
  const user = await getCurrentUser();
  const respond = (
    body: unknown,
    status = 200,
    meta?: Record<string, unknown>
  ) => {
    const response = NextResponse.json(body, { status });
    attachServerTiming(response, "snipradar_engagement_status", requestStartedAt);
    logSnipRadarApiTelemetry({
      route: "/api/snipradar/engagement/opportunities/[id]",
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return respond({ error: "Invalid status" }, 400);
  }

  const existing = await prisma.xEngagementOpportunity.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!existing) {
    return respond({ error: "Opportunity not found" }, 404);
  }

  await prisma.xEngagementOpportunity.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      lastSeenAt: new Date(),
    },
  });

  if (existing.status !== parsed.data.status && (parsed.data.status === "saved" || parsed.data.status === "replied")) {
    await syncLeadFromOpportunity({
      userId: user.id,
      opportunity: {
        id: existing.id,
        tweetId: existing.tweetId,
        authorXUserId: existing.authorXUserId,
        authorUsername: existing.authorUsername,
        authorName: existing.authorName,
        authorAvatar: existing.authorAvatar,
        status: parsed.data.status,
        score: existing.score,
        text: existing.text,
      },
    });
  }

  return respond({ success: true });
}
