export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentDbUser } from "@/lib/auth";
import { lookupUser } from "@/lib/integrations/x-api";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import { prisma } from "@/lib/prisma";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import { syncLeadFromTrackedAccount } from "@/lib/snipradar/relationship-graph";

const requestSchema = z.object({
  inboxItemId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:extension:track", user.id, [
      {
        name: "lookup-burst",
        windowMs: SNIPRADAR.LOOKUP_RATE_LIMIT_WINDOW_MS,
        maxHits: SNIPRADAR.LOOKUP_RATE_LIMIT_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before tracking another author." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid track request" },
        { status: 400 }
      );
    }

    const [item, xAccount] = await Promise.all([
      prisma.xResearchInboxItem.findFirst({
        where: { id: parsed.data.inboxItemId, userId: user.id },
      }),
      prisma.xAccount.findFirst({
        where: { userId: user.id, isActive: true },
      }),
    ]);

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
    }
    if (!item.authorUsername) {
      return NextResponse.json({ error: "This inbox item does not have an author handle to track." }, { status: 400 });
    }
    if (!xAccount) {
      return NextResponse.json({ error: "Connect your X account before tracking authors." }, { status: 400 });
    }

    const xUser = await lookupUser(item.authorUsername);
    if (!xUser) {
      return NextResponse.json({ error: "Could not find that X account." }, { status: 404 });
    }

    const existing = await prisma.xTrackedAccount.findUnique({
      where: {
        userId_trackedXUserId: {
          userId: user.id,
          trackedXUserId: xUser.id,
        },
      },
    });

    const trackedAccount = existing
      ? await prisma.xTrackedAccount.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            trackedUsername: xUser.username,
            trackedDisplayName: xUser.name,
            profileImageUrl: xUser.profile_image_url ?? null,
            followerCount: xUser.public_metrics?.followers_count ?? existing.followerCount,
            niche: existing.niche ?? user.selectedNiche ?? null,
          },
        })
      : await prisma.xTrackedAccount.create({
          data: {
            userId: user.id,
            xAccountId: xAccount.id,
            trackedXUserId: xUser.id,
            trackedUsername: xUser.username,
            trackedDisplayName: xUser.name,
            profileImageUrl: xUser.profile_image_url ?? null,
            followerCount: xUser.public_metrics?.followers_count ?? 0,
            niche: user.selectedNiche ?? null,
          },
        });

    await prisma.xResearchInboxItem.update({
      where: { id: item.id },
      data: {
        trackedAccountId: trackedAccount.id,
        status: "tracked",
        lastActionAt: new Date(),
      },
    });

    await syncLeadFromTrackedAccount({
      userId: user.id,
      trackedAccount: {
        id: trackedAccount.id,
        trackedXUserId: trackedAccount.trackedXUserId,
        trackedUsername: trackedAccount.trackedUsername,
        trackedDisplayName: trackedAccount.trackedDisplayName,
        profileImageUrl: trackedAccount.profileImageUrl ?? null,
        followerCount: trackedAccount.followerCount,
        niche: trackedAccount.niche ?? null,
      },
      inboxItemId: item.id,
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "snipradar_first_tracked_account_added",
      metadata: {
        source: "extension_track",
        trackedUsername: trackedAccount.trackedUsername,
        existed: Boolean(existing),
      },
    });

    return NextResponse.json({
      trackedAccount: {
        id: trackedAccount.id,
        trackedUsername: trackedAccount.trackedUsername,
        trackedDisplayName: trackedAccount.trackedDisplayName,
        followerCount: trackedAccount.followerCount,
        niche: trackedAccount.niche,
      },
      existed: Boolean(existing),
    });
  } catch (error) {
    console.error("[SnipRadar Extension] Track error:", error);
    return NextResponse.json({ error: "Failed to track author", code: "INTERNAL_ERROR", retryable: true }, { status: 500 });
  }
}
