export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  authenticateSnipRadarApiRequest,
  buildSnipRadarPlatformHeaders,
} from "@/lib/snipradar/public-api";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import { emitSnipRadarWebhookEvent } from "@/lib/snipradar/webhooks";
import { postTweetWithAutoRefresh } from "@/lib/snipradar/x-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateSnipRadarApiRequest(request, ["publish:write"]);
  if (!auth.ok) return auth.response;

  try {
    const publishLimit = consumeSnipRadarRateLimit("snipradar:public-api:publish", auth.context.userId, [
      { name: "publish-burst", windowMs: 60_000, maxHits: 6 },
    ]);
    const responseHeaders = buildSnipRadarPlatformHeaders({
      ...auth.context.headers,
      ...buildSnipRadarRateLimitHeaders(publishLimit),
    });

    if (!publishLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Please wait before publishing more drafts." },
        { status: 429, headers: responseHeaders }
      );
    }

    const draft = await prisma.tweetDraft.findFirst({
      where: {
        id: params.id,
        userId: auth.context.userId,
      },
      include: {
        xAccount: true,
      },
    });

    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    if (draft.status === "posted") {
      return NextResponse.json(
        { success: false, error: "This draft has already been posted." },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!draft.xAccount.accessToken || draft.xAccount.accessToken === "bearer-only") {
      return NextResponse.json(
        { success: false, error: "Publishing requires an OAuth-connected X account." },
        { status: 403, headers: responseHeaders }
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

    if (postResult.reauthRequired || !postResult.tweetId) {
      await emitSnipRadarWebhookEvent({
        userId: auth.context.userId,
        eventType: "draft.publish_failed",
        resourceType: "tweet_draft",
        resourceId: draft.id,
        payload: {
          draftId: draft.id,
          text: draft.text,
          reason: postResult.authMessage ?? "X publish failed",
          apiKeyId: auth.context.apiKeyId,
          apiKeyName: auth.context.apiKeyName,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: postResult.authMessage ?? "Failed to publish draft to X.",
        },
        { status: postResult.reauthRequired ? 401 : 502, headers: responseHeaders }
      );
    }

    const updated = await prisma.tweetDraft.update({
      where: { id: draft.id },
      data: {
        status: "posted",
        postedAt: new Date(),
        postedTweetId: postResult.tweetId,
        scheduledFor: null,
      },
    });

    const tweetUrl = `https://x.com/${draft.xAccount.xUsername}/status/${postResult.tweetId}`;

    await emitSnipRadarWebhookEvent({
      userId: auth.context.userId,
      eventType: "draft.posted",
      resourceType: "tweet_draft",
      resourceId: draft.id,
      payload: {
        draftId: updated.id,
        tweetId: postResult.tweetId,
        tweetUrl,
        text: updated.text,
        postedAt: updated.postedAt?.toISOString() ?? new Date().toISOString(),
        apiKeyId: auth.context.apiKeyId,
        apiKeyName: auth.context.apiKeyName,
      },
    });

    return NextResponse.json(
      {
        success: true,
        tweetId: postResult.tweetId,
        tweetUrl,
        draft: {
          id: updated.id,
          text: updated.text,
          status: updated.status,
          postedAt: updated.postedAt?.toISOString() ?? null,
          postedTweetId: updated.postedTweetId,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error("[SnipRadar Public API] Publish draft error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to publish draft" },
      { status: 500, headers: buildSnipRadarPlatformHeaders(auth.context.headers) }
    );
  }
}
