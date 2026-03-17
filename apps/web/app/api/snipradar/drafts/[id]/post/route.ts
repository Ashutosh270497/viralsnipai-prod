export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postTweetWithAutoRefresh } from "@/lib/snipradar/x-auth";
import { snipradarErrorResponse } from "@/lib/snipradar/api-errors";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import { emitSnipRadarWebhookEvent } from "@/lib/snipradar/webhooks";

/**
 * POST /api/snipradar/drafts/[id]/post
 * Publish a draft to X.com
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return snipradarErrorResponse("Unauthorized", 401);
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:drafts:post", user.id, [
      {
        name: "publish-burst",
        windowMs: SNIPRADAR.POST_RATE_LIMIT_WINDOW_MS,
        maxHits: SNIPRADAR.POST_RATE_LIMIT_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Please wait before posting more drafts.", code: "RATE_LIMITED" },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const draft = await prisma.tweetDraft.findFirst({
      where: { id: params.id, userId: user.id },
      include: { xAccount: true },
    });

    if (!draft) {
      return snipradarErrorResponse("Draft not found", 404);
    }

    if (draft.status === "posted") {
      return snipradarErrorResponse("This draft has already been posted", 400);
    }

    if (draft.text.length > SNIPRADAR.TWEET_MAX_LENGTH) {
      return snipradarErrorResponse(
        `Tweet is ${draft.text.length} characters — exceeds the ${SNIPRADAR.TWEET_MAX_LENGTH}-character limit. Please edit it first.`,
        400
      );
    }

    // Manual-connect accounts cannot post — they only have app-level credentials
    if (!draft.xAccount.accessToken || draft.xAccount.accessToken === "bearer-only") {
      return snipradarErrorResponse(
        "Posting requires OAuth authorization. Please reconnect your X account using the OAuth flow.",
        403,
        { code: "OAUTH_REQUIRED" }
      );
    }

    const postResult = await postTweetWithAutoRefresh({
      account: {
        id: draft.xAccount.id,
        xUserId: draft.xAccount.xUserId,
        xUsername: draft.xAccount.xUsername,
        accessToken: draft.xAccount.accessToken,
        refreshToken: draft.xAccount.refreshToken,
        tokenExpiresAt: draft.xAccount.tokenExpiresAt,
      },
      text: draft.text,
    });

    if (postResult.reauthRequired) {
      await emitSnipRadarWebhookEvent({
        userId: user.id,
        eventType: "draft.publish_failed",
        resourceType: "tweet_draft",
        resourceId: draft.id,
        payload: {
          draftId: draft.id,
          text: draft.text,
          reason:
            postResult.authMessage ??
            "Your X account connection has expired. Please reconnect your account.",
          origin: "app_publish",
        },
      });
      return snipradarErrorResponse(
        postResult.authMessage ??
          "Your X account connection has expired. Please reconnect your account.",
        401,
        { code: "REAUTH_REQUIRED", reauthRequired: true }
      );
    }

    if (!postResult.tweetId) {
      await emitSnipRadarWebhookEvent({
        userId: user.id,
        eventType: "draft.publish_failed",
        resourceType: "tweet_draft",
        resourceId: draft.id,
        payload: {
          draftId: draft.id,
          text: draft.text,
          reason: postResult.authMessage ?? "Failed to post tweet to X.",
          origin: "app_publish",
        },
      });
      return snipradarErrorResponse(
        postResult.authMessage ?? "Failed to post tweet to X. Please try again.",
        502,
        { code: "UPSTREAM_ERROR", retryable: true }
      );
    }

    // Update draft status
    const updated = await prisma.tweetDraft.update({
      where: { id: params.id },
      data: {
        status: "posted",
        postedAt: new Date(),
        postedTweetId: postResult.tweetId,
      },
    });

    await emitSnipRadarWebhookEvent({
      userId: user.id,
      eventType: "draft.posted",
      resourceType: "tweet_draft",
      resourceId: updated.id,
      payload: {
        draftId: updated.id,
        tweetId: postResult.tweetId,
        tweetUrl: `https://x.com/${draft.xAccount.xUsername}/status/${postResult.tweetId}`,
        text: updated.text,
        postedAt: updated.postedAt?.toISOString() ?? new Date().toISOString(),
        origin: "app_publish",
      },
    });

    return NextResponse.json({
      success: true,
      tweetId: postResult.tweetId,
      tweetUrl: `https://x.com/${draft.xAccount.xUsername}/status/${postResult.tweetId}`,
      draft: {
        id: updated.id,
        text: updated.text,
        status: updated.status,
        postedAt: updated.postedAt?.toISOString(),
        postedTweetId: updated.postedTweetId,
      },
    });
  } catch (error) {
    console.error("[SnipRadar Post] POST error:", error);
    return snipradarErrorResponse("Failed to post tweet", 500);
  }
}
