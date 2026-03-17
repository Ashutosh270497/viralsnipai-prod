export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getCurrentDbUser } from "@/lib/auth";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import { prisma } from "@/lib/prisma";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import { postTweetWithAutoRefresh } from "@/lib/snipradar/x-auth";

const requestSchema = z.object({
  inboxItemId: z.string().min(1),
  text: z.string().trim().min(1).max(SNIPRADAR.TWEET_MAX_LENGTH),
  replyToTweetId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:extension:reply:post", user.id, [
      {
        name: "publish-burst",
        windowMs: SNIPRADAR.POST_RATE_LIMIT_WINDOW_MS,
        maxHits: SNIPRADAR.POST_RATE_LIMIT_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before posting another reply." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid reply payload" },
        { status: 400 }
      );
    }

    const [item, xAccount] = await Promise.all([
      prisma.xResearchInboxItem.findFirst({
        where: {
          id: parsed.data.inboxItemId,
          userId: user.id,
        },
      }),
      prisma.xAccount.findFirst({
        where: {
          userId: user.id,
          isActive: true,
        },
        select: {
          id: true,
          xUserId: true,
          xUsername: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiresAt: true,
        },
      }),
    ]);

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
    }

    if (!xAccount) {
      return NextResponse.json(
        { error: "Please connect your X account first." },
        { status: 400 }
      );
    }

    if (!xAccount.accessToken || xAccount.accessToken === "bearer-only") {
      return NextResponse.json(
        {
          error:
            "Posting replies requires OAuth authorization. Please reconnect your X account.",
          code: "OAUTH_REQUIRED",
        },
        { status: 403 }
      );
    }

    const postResult = await postTweetWithAutoRefresh({
      account: {
        id: xAccount.id,
        xUserId: xAccount.xUserId,
        xUsername: xAccount.xUsername,
        accessToken: xAccount.accessToken,
        refreshToken: xAccount.refreshToken,
        tokenExpiresAt: xAccount.tokenExpiresAt,
      },
      text: parsed.data.text,
      replyToTweetId: parsed.data.replyToTweetId,
    });

    if (postResult.reauthRequired) {
      return NextResponse.json(
        {
          error:
            postResult.authMessage ??
            "Your X account connection has expired. Please reconnect your account.",
          code: "REAUTH_REQUIRED",
          reauthRequired: true,
        },
        { status: 401 }
      );
    }

    if (!postResult.tweetId) {
      return NextResponse.json(
        {
          error: postResult.authMessage ?? "Failed to post reply to X.",
          code: "UPSTREAM_ERROR",
          retryable: true,
        },
        { status: postResult.status ?? 502 }
      );
    }

    const postedReplyUrl = `https://x.com/${xAccount.xUsername}/status/${postResult.tweetId}`;
    const updatedItem = await prisma.xResearchInboxItem.update({
      where: { id: item.id },
      data: {
        generatedReply: parsed.data.text,
        status: "replied",
        lastActionAt: new Date(),
        metadata: {
          ...((item.metadata as Record<string, unknown> | null) ?? {}),
          postedReplyTweetId: postResult.tweetId,
          postedReplyUrl,
          postedReplyAt: new Date().toISOString(),
          postedVia: "extension_direct_reply",
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      tweetId: postResult.tweetId,
      tweetUrl: postedReplyUrl,
      item: {
        id: updatedItem.id,
        status: updatedItem.status,
        generatedReply: updatedItem.generatedReply,
        lastActionAt: updatedItem.lastActionAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[SnipRadar Extension Reply Post] POST error:", error);
    return NextResponse.json({ error: "Failed to post reply" }, { status: 500 });
  }
}
