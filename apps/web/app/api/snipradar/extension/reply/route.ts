export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { getCurrentDbUser } from "@/lib/auth";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import {
  analyzeSnipRadarExtensionSource,
  generateSnipRadarExtensionReply,
  generateSnipRadarExtensionReplyVariants,
  getSnipRadarExtensionModelConfig,
  SNIPRADAR_EXTENSION_SOURCE_ANALYSIS_VERSION,
  type SnipRadarExtensionSourceAnalysis,
} from "@/lib/ai/snipradar-extension";
import { SNIPRADAR } from "@/lib/constants/snipradar";
import { prisma } from "@/lib/prisma";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";
import { syncLeadFromInboxReply } from "@/lib/snipradar/relationship-graph";
import { toStyleProfile } from "@/lib/snipradar/style-profile";

const requestSchema = z.object({
  inboxItemId: z.string().min(1),
});

function getCachedSourceAnalysis(metadata: unknown): SnipRadarExtensionSourceAnalysis | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  if (record.extensionSourceAnalysisVersion !== SNIPRADAR_EXTENSION_SOURCE_ANALYSIS_VERSION) {
    return null;
  }
  const value = record.extensionSourceAnalysis;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const analysis = value as SnipRadarExtensionSourceAnalysis;
  return analysis.source === "ai" ? analysis : null;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = consumeSnipRadarRateLimit("snipradar:extension:reply", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating another reply assist." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid extension reply request" },
        { status: 400 }
      );
    }

    const [item, styleProfileRecord, referencePosts] = await Promise.all([
      prisma.xResearchInboxItem.findFirst({
        where: { id: parsed.data.inboxItemId, userId: user.id },
      }),
      prisma.xStyleProfile.findUnique({
        where: { userId: user.id },
      }),
      prisma.tweetDraft.findMany({
        where: {
          userId: user.id,
          status: "posted",
          actualImpressions: { gt: 0 },
        },
        orderBy: [{ actualImpressions: "desc" }, { postedAt: "desc" }],
        take: 5,
        select: {
          text: true,
          actualImpressions: true,
          actualLikes: true,
          actualReplies: true,
        },
      }),
    ]);

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
    }

    const sourceAnalysis =
      getCachedSourceAnalysis(item.metadata) ??
      (await analyzeSnipRadarExtensionSource({
        item,
        selectedNiche: user.selectedNiche,
      }));

    const variants = await generateSnipRadarExtensionReplyVariants({
      item,
      selectedNiche: user.selectedNiche,
      styleProfile: toStyleProfile(styleProfileRecord),
      sourceAnalysis,
      referencePosts,
    });
    const variantText = variants[0]?.text;
    const reply = variantText || (await generateSnipRadarExtensionReply({
      item,
      selectedNiche: user.selectedNiche,
      styleProfile: toStyleProfile(styleProfileRecord),
      sourceAnalysis,
      referencePosts,
    }));

    if (!reply) {
      return NextResponse.json(
        { error: "Unable to generate a reply for this item. Please try again.", code: "REPLY_GENERATION_FAILED", retryable: true },
        { status: 500 }
      );
    }

    const updated = await prisma.xResearchInboxItem.update({
      where: { id: item.id },
      data: {
        generatedReply: reply,
        lastActionAt: new Date(),
        metadata: {
          ...((item.metadata as Record<string, unknown> | null) ?? {}),
          extensionSourceAnalysis: sourceAnalysis,
          extensionSourceAnalysisVersion: SNIPRADAR_EXTENSION_SOURCE_ANALYSIS_VERSION,
          extensionSourceAnalysisUpdatedAt: new Date().toISOString(),
          generatedReplyVariants: variants,
        } as Prisma.InputJsonValue,
      },
    });

    await syncLeadFromInboxReply({
      userId: user.id,
      item: {
        id: updated.id,
        authorUsername: updated.authorUsername,
        authorDisplayName: updated.authorDisplayName,
        authorAvatarUrl: updated.authorAvatarUrl,
        trackedAccountId: updated.trackedAccountId,
        text: updated.text,
        generatedReply: updated.generatedReply,
      },
    });

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "snipradar_first_reply_assist_used",
      metadata: {
        source: "extension_reply",
        inboxItemId: item.id,
      },
    });

    const modelConfig = getSnipRadarExtensionModelConfig();

    return NextResponse.json({
      reply,
      variants,
      item: {
        id: updated.id,
        generatedReply: updated.generatedReply,
        lastActionAt: updated.lastActionAt?.toISOString() ?? null,
      },
      meta: {
        provider: modelConfig.reply.provider,
        model: modelConfig.reply.model,
        sourceAnalysisSource: sourceAnalysis.source,
      },
    });
  } catch (error) {
    console.error("[SnipRadar Extension] Reply error:", error);
    return NextResponse.json({ error: "Failed to generate reply assist", code: "INTERNAL_ERROR", retryable: true }, { status: 500 });
  }
}
