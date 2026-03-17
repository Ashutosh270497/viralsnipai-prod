export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postTweetWithAutoRefresh } from "@/lib/snipradar/x-auth";
import { snipradarErrorResponse } from "@/lib/snipradar/api-errors";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

const bodySchema = z
  .object({
    threadGroupId: z.string().min(3).optional(),
    draftIds: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((value) => value.threadGroupId || (value.draftIds && value.draftIds.length > 0), {
    message: "threadGroupId or draftIds is required",
  });

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:threads:post", user.id, [
      {
        name: "publish-burst",
        windowMs: SNIPRADAR.POST_RATE_LIMIT_WINDOW_MS,
        maxHits: SNIPRADAR.POST_RATE_LIMIT_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Please wait before posting another thread.", code: "RATE_LIMITED" },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const payload = bodySchema.safeParse(await request.json());
    if (!payload.success) {
      return snipradarErrorResponse(
        payload.error.errors[0]?.message ?? "Invalid input",
        400
      );
    }

    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, isActive: true },
      select: {
        id: true,
        xUserId: true,
        xUsername: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true,
      },
    });

    if (!xAccount || !xAccount.accessToken || xAccount.accessToken === "bearer-only") {
      return snipradarErrorResponse(
        "Posting requires OAuth authorization. Please reconnect your X account.",
        403,
        { code: "OAUTH_REQUIRED" }
      );
    }

    const where = payload.data.threadGroupId
      ? {
          userId: user.id,
          xAccountId: xAccount.id,
          threadGroupId: payload.data.threadGroupId,
          status: { in: ["draft", "scheduled"] as string[] },
        }
      : {
          userId: user.id,
          xAccountId: xAccount.id,
          id: { in: payload.data.draftIds ?? [] },
          status: { in: ["draft", "scheduled"] as string[] },
        };

    const drafts = await prisma.tweetDraft.findMany({
      where,
      orderBy: [
        { threadOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    if (drafts.length < 2) {
      return snipradarErrorResponse(
        "At least 2 drafts are required to post a thread",
        400
      );
    }

    let previousTweetId: string | undefined;
    let rootTweetId: string | undefined;
    let posted = 0;
    let currentAccessToken = xAccount.accessToken;

    for (const draft of drafts) {
      const result = await postTweetWithAutoRefresh({
        account: {
          id: xAccount.id,
          xUserId: xAccount.xUserId,
          xUsername: xAccount.xUsername,
          accessToken: currentAccessToken,
          refreshToken: xAccount.refreshToken,
          tokenExpiresAt: xAccount.tokenExpiresAt,
        },
        text: draft.text,
        replyToTweetId: previousTweetId,
      });

      if (result.reauthRequired) {
        return snipradarErrorResponse(
          result.authMessage ?? "Reconnect X account to continue posting threads.",
          401,
          {
            code: "REAUTH_REQUIRED",
            reauthRequired: true,
            details: { posted },
          }
        );
      }

      if (!result.tweetId) {
        return snipradarErrorResponse(
          result.authMessage ?? `Failed while posting thread tweet #${posted + 1}`,
          502,
          {
            code: "UPSTREAM_ERROR",
            retryable: true,
            details: { posted },
          }
        );
      }

      previousTweetId = result.tweetId;
      if (!rootTweetId) {
        rootTweetId = result.tweetId;
      }
      if (result.accessToken) currentAccessToken = result.accessToken;
      posted += 1;

      await prisma.tweetDraft.update({
        where: { id: draft.id },
        data: {
          status: "posted",
          postedAt: new Date(),
          postedTweetId: result.tweetId,
          scheduledFor: null,
        },
      });
    }

    return NextResponse.json({ success: true, posted, rootTweetId: rootTweetId ?? null });
  } catch (error) {
    console.error("[SnipRadar Threads] Post error:", error);
    return snipradarErrorResponse("Failed to post thread", 500);
  }
}
