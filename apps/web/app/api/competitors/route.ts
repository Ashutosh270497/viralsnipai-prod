export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import { formatPlanName, getRuntimeSecondaryUsageLimit, resolvePlanTier } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { resolveChannelId, fetchChannelData } from "@/lib/integrations/youtube-channels";
import { enqueueCompetitorSync, enqueueCompetitorSyncBatch } from "@/lib/competitors/sync-queue";

const addCompetitorSchema = z.object({
  channelUrl: z.string().trim().min(1, "Channel URL is required"),
  category: z
    .string()
    .trim()
    .max(50, "Category must be 50 characters or less")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

/**
 * Serialize BigInt values to strings for JSON response
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}

/**
 * GET /api/competitors
 * Fetch user's active competitors with growth data
 */
export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Step 1: Enqueue stale competitors in background (non-blocking for page response).
    const SNAPSHOT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    const staleThreshold = new Date(Date.now() - SNAPSHOT_INTERVAL);
    const competitorsToRefresh = await prisma.competitor.findMany({
      where: {
        userId: user.id,
        isActive: true,
        lastChecked: { lt: staleThreshold },
        syncStatus: { notIn: ["queued", "syncing"] },
      },
      select: { id: true },
      orderBy: { lastChecked: "asc" },
      take: 3,
    });

    if (competitorsToRefresh.length > 0) {
      void enqueueCompetitorSyncBatch(
        competitorsToRefresh.map((comp) => ({
          competitorId: comp.id,
          reason: "stale_list",
          refreshVideos: true,
        })),
        { fallbackToInlineSync: false },
      ).catch((err) => {
        console.error("[Competitors API] stale enqueue failed:", err);
      });
    }

    // Step 2: Fetch full competitor data (with fresh snapshots)
    const competitors = await prisma.competitor.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        snapshots: {
          select: {
            id: true,
            subscriberCount: true,
            videoCount: true,
            viewCount: true,
            subsGrowth: true,
            viewsGrowth: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 2,
        },
        videos: {
          select: {
            id: true,
            title: true,
            views: true,
            publishedAt: true,
            isViral: true,
          },
          orderBy: { publishedAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Step 3: Calculate growth metrics for each competitor
    const competitorsWithGrowth = competitors.map((competitor) => {
      const [latest, previous] = competitor.snapshots;

      let subsGrowth = 0;
      let subsGrowthPercent = 0;
      let viewsGrowth = BigInt(0);
      let avgViews = 0;

      if (latest && previous) {
        subsGrowth = latest.subscriberCount - previous.subscriberCount;
        subsGrowthPercent =
          previous.subscriberCount > 0
            ? Math.round((subsGrowth / previous.subscriberCount) * 10000) / 100
            : 0;
        viewsGrowth = latest.viewCount - previous.viewCount;
      }

      if (competitor.videos.length > 0) {
        const totalViews = competitor.videos.reduce((sum, v) => sum + v.views, 0);
        avgViews = Math.round(totalViews / competitor.videos.length);
      }

      return {
        ...competitor,
        subsGrowth,
        subsGrowthPercent,
        viewsGrowth,
        avgViews,
        isNewlyTracked: competitor.snapshots.length < 2,
      };
    });

    return NextResponse.json(
      { competitors: serializeBigInt(competitorsWithGrowth) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Competitors API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitors" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/**
 * POST /api/competitors
 * Add a new competitor to track
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const body = await request.json();
    const parsed = addCompetitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { channelUrl, category } = parsed.data;

    // Check tier limits
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { subscriptionTier: true },
    });

    const tier = resolvePlanTier(dbUser?.subscriptionTier ?? "free");
    const limit = getRuntimeSecondaryUsageLimit(tier, "trackedCompetitors");

    const activeCount = await prisma.competitor.count({
      where: { userId: user.id, isActive: true },
    });

    if (Number.isFinite(limit) && activeCount >= limit) {
      return NextResponse.json(
        {
          error: `You've reached the maximum of ${limit} active competitors for the ${formatPlanName(tier)} plan. Upgrade to track more.`,
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Resolve channel ID from URL/handle
    const channelId = await resolveChannelId(channelUrl);
    if (!channelId) {
      return NextResponse.json(
        { error: "Could not find a YouTube channel for that URL or handle." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Check if already tracking (reactivate if archived)
    const existing = await prisma.competitor.findUnique({
      where: {
        userId_channelId: {
          userId: user.id,
          channelId,
        },
      },
    });

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json(
          { error: "You are already tracking this channel." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }

      // Reactivate archived competitor
      await prisma.competitor.update({
        where: { id: existing.id },
        data: { isActive: true, category: category ?? existing.category },
      });
      await enqueueCompetitorSync(existing.id, "reactivated", true);

      // Return full competitor with videos
      const fullReactivated = await prisma.competitor.findUnique({
        where: { id: existing.id },
        include: {
          snapshots: {
            select: {
              id: true,
              subscriberCount: true,
              videoCount: true,
              viewCount: true,
              subsGrowth: true,
              viewsGrowth: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          videos: {
            select: {
              id: true,
              title: true,
              views: true,
              publishedAt: true,
              isViral: true,
            },
            orderBy: { publishedAt: "desc" },
            take: 10,
          },
        },
      });

      return NextResponse.json(
        { competitor: serializeBigInt(fullReactivated), reactivated: true },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Fetch channel data from YouTube
    const channelData = await fetchChannelData(channelId);
    if (!channelData) {
      return NextResponse.json(
        { error: "Failed to fetch channel data from YouTube." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Create competitor + initial snapshot in transaction
    const competitor = await prisma.competitor.create({
      data: {
        userId: user.id,
        channelId,
        channelTitle: channelData.title,
        channelUrl: channelData.customUrl
          ? `https://youtube.com/${channelData.customUrl}`
          : `https://youtube.com/channel/${channelId}`,
        thumbnailUrl: channelData.thumbnailUrl,
        description: channelData.description,
        category: category ?? null,
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        viewCount: channelData.viewCount,
        snapshots: {
          create: {
            subscriberCount: channelData.subscriberCount,
            videoCount: channelData.videoCount,
            viewCount: channelData.viewCount,
            subsGrowth: 0,
            viewsGrowth: BigInt(0),
          },
        },
      },
    });

    // Queue async sync for videos + snapshot enrichment
    await enqueueCompetitorSync(competitor.id, "added", true);

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        feature: "competitor_tracking",
        creditsUsed: 0,
        metadata: { action: "add_competitor", channelId, channelTitle: channelData.title },
      },
    });

    // Fetch the complete record
    const fullCompetitor = await prisma.competitor.findUnique({
      where: { id: competitor.id },
      include: {
        snapshots: {
          select: {
            id: true,
            subscriberCount: true,
            videoCount: true,
            viewCount: true,
            subsGrowth: true,
            viewsGrowth: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        videos: {
          select: {
            id: true,
            title: true,
            views: true,
            publishedAt: true,
            isViral: true,
          },
          orderBy: { publishedAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json(
      { competitor: serializeBigInt(fullCompetitor) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Competitors API] POST error:", error);
    return NextResponse.json(
      { error: "Failed to add competitor" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
