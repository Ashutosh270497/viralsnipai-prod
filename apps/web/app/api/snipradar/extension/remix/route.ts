export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { getCurrentDbUser } from "@/lib/auth";
import {
  analyzeSnipRadarExtensionSource,
  generateSnipRadarExtensionRemix,
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

    const rateLimit = consumeSnipRadarRateLimit("snipradar:extension:remix", user.id, [
      {
        name: "burst",
        windowMs: SNIPRADAR.AI_RATE_LIMIT_BURST_WINDOW_MS,
        maxHits: SNIPRADAR.AI_RATE_LIMIT_BURST_MAX_REQUESTS,
      },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Please wait before generating another remix." },
        { status: 429, headers: buildSnipRadarRateLimitHeaders(rateLimit) }
      );
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid extension remix request" },
        { status: 400 }
      );
    }

    const [item, styleProfileRecord] = await Promise.all([
      prisma.xResearchInboxItem.findFirst({
        where: { id: parsed.data.inboxItemId, userId: user.id },
      }),
      prisma.xStyleProfile.findUnique({
        where: { userId: user.id },
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

    const remix = await generateSnipRadarExtensionRemix({
      item,
      selectedNiche: user.selectedNiche,
      styleProfile: toStyleProfile(styleProfileRecord),
      sourceAnalysis,
    });

    const updated = await prisma.xResearchInboxItem.update({
      where: { id: item.id },
      data: {
        generatedRemix: remix,
        lastActionAt: new Date(),
        metadata: {
          ...((item.metadata as Record<string, unknown> | null) ?? {}),
          extensionSourceAnalysis: sourceAnalysis,
          extensionSourceAnalysisVersion: SNIPRADAR_EXTENSION_SOURCE_ANALYSIS_VERSION,
          extensionSourceAnalysisUpdatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    const modelConfig = getSnipRadarExtensionModelConfig();

    return NextResponse.json({
      remix,
      item: {
        id: updated.id,
        generatedRemix: updated.generatedRemix,
        lastActionAt: updated.lastActionAt?.toISOString() ?? null,
      },
      meta: {
        provider: modelConfig.remix.provider,
        model: modelConfig.remix.model,
        sourceAnalysisSource: sourceAnalysis.source,
      },
    });
  } catch (error) {
    console.error("[SnipRadar Extension] Remix error:", error);
    return NextResponse.json({ error: "Failed to generate remix", code: "INTERNAL_ERROR", retryable: true }, { status: 500 });
  }
}
