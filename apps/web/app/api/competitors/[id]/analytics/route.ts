export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateUploadFrequency,
  extractCommonKeywords,
} from "@/lib/integrations/youtube-channels";
import { enqueueCompetitorSync } from "@/lib/competitors/sync-queue";
import { syncCompetitorById } from "@/lib/competitors/sync";

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
 * GET /api/competitors/[id]/analytics
 * Detailed analytics for a single competitor
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Date boundary: last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // First fetch competitor to get channelId
    const competitorBase = await prisma.competitor.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      select: { id: true, updatedAt: true },
    });

    if (!competitorBase) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ---- Auto-refresh videos from YouTube ----
    // Re-fetch if data is older than 3 hours
    const REFRESH_INTERVAL = 3 * 60 * 60 * 1000;
    const lastRefresh = competitorBase.updatedAt?.getTime() ?? 0;
    const isStale = Date.now() - lastRefresh > REFRESH_INTERVAL;

    // Also check if we have very few videos (likely a bad initial fetch)
    const existingVideoCount = await prisma.competitorVideo.count({
      where: {
        competitorId: competitorBase.id,
        publishedAt: { gte: thirtyDaysAgo },
      },
    });
    // If fewer than 5 videos exist, always refresh — no matter how recently
    // the record was touched. This catches bad initial fetches and reactivations.
    const probablyIncomplete = existingVideoCount < 5;

    // Support force refresh via query param: ?refresh=true
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";

    if (forceRefresh) {
      await syncCompetitorById({
        competitorId: competitorBase.id,
        refreshVideos: true,
        reason: "manual_force",
      });
    } else if (isStale || probablyIncomplete) {
      await enqueueCompetitorSync(
        competitorBase.id,
        probablyIncomplete ? "analytics_incomplete" : "analytics_stale",
        true
      );
    }

    // ---- Now fetch the full competitor with fresh data ----
    const competitor = await prisma.competitor.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      include: {
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        videos: {
          where: {
            publishedAt: { gte: thirtyDaysAgo },
          },
          orderBy: { publishedAt: "desc" },
        },
      },
    });

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const videos = competitor.videos;
    const snapshots = competitor.snapshots;

    // Growth chart data (sorted chronologically)
    const growthChart = [...snapshots]
      .reverse()
      .map((s) => ({
        date: s.createdAt.toISOString(),
        subscribers: s.subscriberCount,
        views: s.viewCount,
      }));

    // Categorize videos: Shorts (<=120s / 2 min) vs Long-form (>120s)
    const SHORTS_THRESHOLD = 120; // seconds
    const shortsVideos = videos.filter((v) => (v.duration ?? 0) > 0 && (v.duration ?? 0) <= SHORTS_THRESHOLD);
    const longFormVideos = videos.filter((v) => (v.duration ?? 0) > SHORTS_THRESHOLD);

    const mapVideo = (v: typeof videos[0]) => ({
      videoId: v.videoId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt.toISOString(),
      duration: v.duration,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      isViral: v.isViral,
      category: (v.duration ?? 0) <= SHORTS_THRESHOLD ? "short" as const : "long" as const,
    });

    // Top 10 overall
    const topVideos = [...videos]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map(mapVideo);

    // Top 10 Shorts by views
    const topShorts = [...shortsVideos]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map(mapVideo);

    // Top 10 Long-form by views
    const topLongForm = [...longFormVideos]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map(mapVideo);

    // Per-category stats
    const calcCategoryStats = (vids: typeof videos) => {
      const count = vids.length || 1;
      const totalViews = vids.reduce((s, v) => s + v.views, 0);
      const totalLikes = vids.reduce((s, v) => s + (v.likes ?? 0), 0);
      const totalComments = vids.reduce((s, v) => s + (v.comments ?? 0), 0);
      const viralCount = vids.filter((v) => v.isViral).length;
      return {
        count: vids.length,
        avgViews: Math.round(totalViews / count),
        avgLikes: Math.round(totalLikes / count),
        avgComments: Math.round(totalComments / count),
        engagementRate: totalViews > 0
          ? Math.round(((totalLikes + totalComments) / totalViews) * 10000) / 100
          : 0,
        viralVideos: viralCount,
        totalViews,
      };
    };

    const shortsStats = calcCategoryStats(shortsVideos);
    const longFormStats = calcCategoryStats(longFormVideos);

    // Average stats
    const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
    const totalLikes = videos.reduce((sum, v) => sum + (v.likes ?? 0), 0);
    const totalComments = videos.reduce((sum, v) => sum + (v.comments ?? 0), 0);
    const videoCount = videos.length || 1;

    const avgViews = Math.round(totalViews / videoCount);
    const avgLikes = Math.round(totalLikes / videoCount);
    const avgComments = Math.round(totalComments / videoCount);
    const engagementRate =
      totalViews > 0
        ? Math.round(((totalLikes + totalComments) / totalViews) * 10000) / 100
        : 0;

    // Upload frequency (videos per week)
    const uploadFrequency = calculateUploadFrequency(
      videos.map((v) => ({ publishedAt: v.publishedAt.toISOString() }))
    );

    // Common keywords
    const commonKeywords = extractCommonKeywords(
      videos.map((v) => ({ title: v.title, tags: v.keywords }))
    ).slice(0, 30);

    // Duration distribution
    const durationDistribution = {
      short: 0, // <= 120s (Shorts)
      medium: 0, // 2-10 min
      long: 0, // 10-30 min
      veryLong: 0, // > 30 min
    };

    for (const video of videos) {
      const dur = video.duration ?? 0;
      if (dur <= SHORTS_THRESHOLD) durationDistribution.short++;
      else if (dur < 600) durationDistribution.medium++;
      else if (dur < 1800) durationDistribution.long++;
      else durationDistribution.veryLong++;
    }

    // Upload day distribution
    const uploadDayDistribution: Record<string, number> = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    };

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    for (const video of videos) {
      const day = dayNames[new Date(video.publishedAt).getDay()];
      uploadDayDistribution[day]++;
    }

    // Viral videos count
    const viralVideos = videos.filter((v) => v.isViral).length;

    const analytics = {
      competitor: {
        id: competitor.id,
        channelId: competitor.channelId,
        channelTitle: competitor.channelTitle,
        channelUrl: competitor.channelUrl,
        thumbnailUrl: competitor.thumbnailUrl,
        description: competitor.description,
        category: competitor.category,
        subscriberCount: competitor.subscriberCount,
        videoCount: competitor.videoCount,
        viewCount: competitor.viewCount,
      },
      growthChart,
      topVideos,
      // Category-specific top videos
      topShorts,
      topLongForm,
      // Category-specific stats
      shortsStats,
      longFormStats,
      stats: {
        avgViews,
        avgLikes,
        avgComments,
        engagementRate,
        uploadFrequency,
        viralVideos,
        totalVideosTracked: videos.length,
      },
      commonKeywords,
      durationDistribution,
      uploadDayDistribution,
    };

    return NextResponse.json(serializeBigInt(analytics), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Competitors API] Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
