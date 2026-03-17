export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lookupUser } from "@/lib/integrations/x-api";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import { requireSnipRadarTrackedAccountCapacity } from "@/lib/snipradar/billing-gates-server";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

const addAccountSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(15, "X usernames are at most 15 characters")
    .regex(/^@?[a-zA-Z0-9_]+$/, "Invalid X username format"),
  niche: z.string().optional(),
});

/**
 * GET /api/snipradar/accounts
 * List tracked accounts
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!xAccount) {
      return NextResponse.json({ accounts: [] });
    }

    const accounts = await prisma.xTrackedAccount.findMany({
      where: { userId: user.id, xAccountId: xAccount.id, isActive: true },
      include: {
        _count: { select: { viralTweets: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        trackedUsername: a.trackedUsername,
        trackedDisplayName: a.trackedDisplayName,
        profileImageUrl: a.profileImageUrl,
        followerCount: a.followerCount,
        niche: a.niche,
        viralTweetCount: a._count.viralTweets,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[SnipRadar Accounts] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracked accounts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/snipradar/accounts
 * Add a tracked account
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:accounts:add", user.id, [
      {
        name: "lookup-burst",
        windowMs: SNIPRADAR.LOOKUP_RATE_LIMIT_WINDOW_MS,
        maxHits: SNIPRADAR.LOOKUP_RATE_LIMIT_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before adding more tracked accounts." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const parsed = addAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!xAccount) {
      return NextResponse.json(
        { error: "Please connect your X account first." },
        { status: 400 }
      );
    }

    // Lookup user on X
    const xUser = await lookupUser(parsed.data.username);
    if (!xUser) {
      return NextResponse.json(
        { error: "Could not find that X account. Check the username and try again." },
        { status: 404 }
      );
    }

    // Check if already tracking
    const existing = await prisma.xTrackedAccount.findUnique({
      where: {
        userId_trackedXUserId: {
          userId: user.id,
          trackedXUserId: xUser.id,
        },
      },
    });

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json(
          { error: "You are already tracking this account." },
          { status: 409 }
        );
      }
      const trackedAccountGate = await requireSnipRadarTrackedAccountCapacity(
        user.id,
        "You have reached the tracked account limit for your current plan."
      );
      if (!trackedAccountGate.ok) {
        return trackedAccountGate.response;
      }
      // Reactivate
      const reactivated = await prisma.xTrackedAccount.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          niche: parsed.data.niche ?? existing.niche,
          trackedUsername: xUser.username,
          trackedDisplayName: xUser.name,
          profileImageUrl: xUser.profile_image_url ?? null,
          followerCount: xUser.public_metrics?.followers_count ?? 0,
        },
      });
      await recordActivationCheckpointSafe({
        userId: user.id,
        checkpoint: "snipradar_first_tracked_account_added",
        metadata: {
          source: "tracked_accounts_route",
          trackedUsername: reactivated.trackedUsername,
          reactivated: true,
        },
      });
      return NextResponse.json({ account: reactivated, reactivated: true });
    }

    const trackedAccountGate = await requireSnipRadarTrackedAccountCapacity(
      user.id,
      "You have reached the tracked account limit for your current plan."
    );
    if (!trackedAccountGate.ok) {
      return trackedAccountGate.response;
    }

    // Create new tracked account
    const tracked = await prisma.xTrackedAccount.create({
      data: {
        userId: user.id,
        xAccountId: xAccount.id,
        trackedXUserId: xUser.id,
        trackedUsername: xUser.username,
        trackedDisplayName: xUser.name,
        profileImageUrl: xUser.profile_image_url ?? null,
        followerCount: xUser.public_metrics?.followers_count ?? 0,
        niche: parsed.data.niche ?? null,
      },
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "snipradar_first_tracked_account_added",
      metadata: {
        source: "tracked_accounts_route",
        trackedUsername: tracked.trackedUsername,
      },
    });

    return NextResponse.json({ account: tracked }, { status: 201 });
  } catch (error) {
    console.error("[SnipRadar Accounts] POST error:", error);
    return NextResponse.json(
      { error: "Failed to add tracked account" },
      { status: 500 }
    );
  }
}
