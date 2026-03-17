import { prisma } from "@/lib/prisma";
import {
  fetchChannelData,
  fetchChannelVideos,
  isVideoViral,
} from "@/lib/integrations/youtube-channels";

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function syncCompetitorById(params: {
  competitorId: string;
  refreshVideos?: boolean;
  reason?: string;
}) {
  const { competitorId, refreshVideos = true } = params;

  const competitor = await prisma.competitor.findUnique({
    where: { id: competitorId },
    include: {
      snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!competitor || !competitor.isActive) {
    return { synced: false, reason: "not_found_or_inactive" as const };
  }

  const channelData = await fetchChannelData(competitor.channelId);
  if (!channelData) {
    return { synced: false, reason: "channel_fetch_failed" as const };
  }

  const latestSnapshot = competitor.snapshots[0];

  await prisma.$transaction(async (tx) => {
    await tx.competitorSnapshot.create({
      data: {
        competitorId: competitor.id,
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        viewCount: channelData.viewCount,
        subsGrowth: latestSnapshot
          ? channelData.subscriberCount - latestSnapshot.subscriberCount
          : 0,
        viewsGrowth: latestSnapshot ? channelData.viewCount - latestSnapshot.viewCount : BigInt(0),
      },
    });

    await tx.competitor.update({
      where: { id: competitor.id },
      data: {
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        viewCount: channelData.viewCount,
        lastChecked: new Date(),
      },
    });
  });

  if (refreshVideos) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const freshVideos = await fetchChannelVideos(competitor.channelId, 100, thirtyDaysAgo);

    if (freshVideos.length > 0) {
      const avgViews = freshVideos.reduce((sum, v) => sum + v.views, 0) / freshVideos.length;
      const writePayload = freshVideos.map((video) => {
        const publishedAt = new Date(video.publishedAt);
        const isViral = isVideoViral(video.views, avgViews);
        return {
          where: {
            competitorId_videoId: {
              competitorId: competitor.id,
              videoId: video.videoId,
            },
          },
          update: {
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt,
            duration: video.duration,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            keywords: video.tags,
            isViral,
          },
          create: {
            competitorId: competitor.id,
            videoId: video.videoId,
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt,
            duration: video.duration,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            keywords: video.tags,
            isViral,
          },
        };
      });

      // Execute writes in bounded batches to avoid exhausting session-mode DB clients.
      for (const batch of chunkArray(writePayload, 25)) {
        await prisma.$transaction(batch.map((item) => prisma.competitorVideo.upsert(item)));
      }
    }
  }

  return { synced: true, reason: "ok" as const };
}
