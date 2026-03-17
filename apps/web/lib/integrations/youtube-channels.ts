import { google, youtube_v3 } from "googleapis";

// Initialize YouTube API client
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOW_MOCK_DATA = process.env.ALLOW_YOUTUBE_MOCK_DATA === "true";

function canUseMockData(): boolean {
  return !IS_PRODUCTION || ALLOW_MOCK_DATA;
}

const youtube: youtube_v3.Youtube | null = YOUTUBE_API_KEY
  ? google.youtube({ version: "v3", auth: YOUTUBE_API_KEY })
  : null;

// ============================================
// Interfaces
// ============================================

export interface ChannelData {
  channelId: string;
  title: string;
  description: string;
  customUrl: string;
  thumbnailUrl: string;
  bannerUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: bigint;
  country: string;
  publishedAt: string;
}

export interface ChannelVideoData {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: number; // seconds
  views: number;
  likes: number;
  comments: number;
  tags: string[];
}

// ============================================
// Channel ID Resolution
// ============================================

async function resolveHandleToChannelId(handle: string): Promise<string | null> {
  if (!youtube) return null;

  try {
    // Try forHandle param first
    const response = await youtube.channels.list({
      part: ["id"],
      forHandle: handle,
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].id ?? null;
    }

    // Fallback: search for channel
    const searchResponse = await youtube.search.list({
      part: ["snippet"],
      q: handle,
      type: ["channel"],
      maxResults: 1,
    });

    if (searchResponse.data.items && searchResponse.data.items.length > 0) {
      return searchResponse.data.items[0].snippet?.channelId ?? null;
    }

    return null;
  } catch (error) {
    console.error("[YouTube] Failed to resolve handle:", handle, error);
    return null;
  }
}

/**
 * Resolve various YouTube URL formats to a channel ID.
 * Supports: @handle, /channel/ID, /c/name, /user/name, direct ID (UC...)
 */
export async function resolveChannelId(input: string): Promise<string | null> {
  if (!input) return null;

  const trimmed = input.trim();

  // Direct channel ID (starts with UC)
  if (trimmed.startsWith("UC") && trimmed.length === 24) {
    return trimmed;
  }

  // Try parsing as URL
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const pathname = url.pathname;

    // /channel/UC... format
    const channelMatch = pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
    if (channelMatch) {
      return channelMatch[1];
    }

    // /@handle format
    const handleMatch = pathname.match(/\/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) {
      return resolveHandleToChannelId(handleMatch[1]);
    }

    // /c/customName format
    const customMatch = pathname.match(/\/c\/([a-zA-Z0-9_.-]+)/);
    if (customMatch) {
      return resolveHandleToChannelId(customMatch[1]);
    }

    // /user/username format
    const userMatch = pathname.match(/\/user\/([a-zA-Z0-9_.-]+)/);
    if (userMatch) {
      return resolveHandleToChannelId(userMatch[1]);
    }
  } catch {
    // Not a URL — treat as handle or search query
  }

  // Treat as handle if starts with @
  if (trimmed.startsWith("@")) {
    return resolveHandleToChannelId(trimmed.slice(1));
  }

  // Last resort: treat as search query / handle
  return resolveHandleToChannelId(trimmed);
}

// ============================================
// Channel Data Fetching
// ============================================

export async function fetchChannelData(channelId: string): Promise<ChannelData | null> {
  if (!youtube) {
    if (canUseMockData()) {
      console.warn("[YouTube] No API key configured, returning mock data");
      return generateMockChannelData(channelId);
    }
    console.error("[YouTube] No API key configured in production mode");
    return null;
  }

  try {
    const response = await youtube.channels.list({
      part: ["snippet", "statistics", "brandingSettings"],
      id: [channelId],
    });

    const channel = response.data.items?.[0];
    if (!channel) return null;

    const snippet = channel.snippet;
    const stats = channel.statistics;
    const branding = channel.brandingSettings;

    return {
      channelId,
      title: snippet?.title ?? "Unknown Channel",
      description: snippet?.description ?? "",
      customUrl: snippet?.customUrl ?? "",
      thumbnailUrl: snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.default?.url ?? "",
      bannerUrl: branding?.image?.bannerExternalUrl ?? "",
      subscriberCount: parseInt(stats?.subscriberCount ?? "0", 10),
      videoCount: parseInt(stats?.videoCount ?? "0", 10),
      viewCount: BigInt(stats?.viewCount ?? "0"),
      country: snippet?.country ?? "",
      publishedAt: snippet?.publishedAt ?? new Date().toISOString(),
    };
  } catch (error: any) {
    if (error?.code === 403) {
      if (canUseMockData()) {
        console.warn("[YouTube] API quota exceeded or forbidden, returning mock data");
        return generateMockChannelData(channelId);
      }
      console.error("[YouTube] API quota exceeded or forbidden in production mode");
      return null;
    }
    console.error("[YouTube] Failed to fetch channel data:", error);
    return null;
  }
}

/**
 * Get the uploads playlist ID for a channel.
 * Every YouTube channel has an uploads playlist: replace "UC" prefix with "UU".
 * Falls back to the channels API if the ID format is unexpected.
 */
async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  // Fast path: derive from channel ID (UC... -> UU...)
  if (channelId.startsWith("UC")) {
    return "UU" + channelId.slice(2);
  }

  // Fallback: ask the API
  if (!youtube) return null;

  try {
    const response = await youtube.channels.list({
      part: ["contentDetails"],
      id: [channelId],
    });
    return response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
  } catch {
    return null;
  }
}

export async function fetchChannelVideos(
  channelId: string,
  maxResults: number = 50,
  publishedAfter?: string
): Promise<ChannelVideoData[]> {
  if (!youtube) {
    if (canUseMockData()) {
      console.warn("[YouTube] No API key configured, returning mock videos");
      return generateMockChannelVideos(channelId, maxResults);
    }
    console.error("[YouTube] No API key configured in production mode");
    return [];
  }

  try {
    // ---- Step 1: Get the uploads playlist ID ----
    const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
    if (!uploadsPlaylistId) {
      console.error("[YouTube] Could not determine uploads playlist for", channelId);
      return [];
    }

    const publishedAfterDate = publishedAfter ? new Date(publishedAfter) : null;

    // ---- Step 2: Paginate through the uploads playlist ----
    const allVideoIds: string[] = [];
    let nextPageToken: string | undefined;
    let reachedOlderVideos = false;

    while (!reachedOlderVideos) {
      const pageSize = Math.min(50, maxResults - allVideoIds.length);
      if (pageSize <= 0) break;

      const playlistResponse = await youtube.playlistItems.list({
        part: ["contentDetails", "snippet"],
        playlistId: uploadsPlaylistId,
        maxResults: pageSize,
        ...(nextPageToken ? { pageToken: nextPageToken } : {}),
      });

      const items = playlistResponse.data.items ?? [];

      for (const item of items) {
        const videoId = item.contentDetails?.videoId;
        const publishedAt = item.snippet?.publishedAt ?? item.contentDetails?.videoPublishedAt;

        if (!videoId) continue;

        // playlist is sorted newest-first; once we hit a video older than
        // our date boundary we can stop paginating entirely
        if (publishedAfterDate && publishedAt) {
          if (new Date(publishedAt) < publishedAfterDate) {
            reachedOlderVideos = true;
            break;
          }
        }

        allVideoIds.push(videoId);
      }

      // No more pages
      nextPageToken = playlistResponse.data.nextPageToken ?? undefined;
      if (!nextPageToken || items.length < pageSize) break;

      // Safety cap: don't paginate forever
      if (allVideoIds.length >= maxResults) break;
    }

    console.log(`[YouTube] Found ${allVideoIds.length} video IDs from uploads playlist for ${channelId}`);

    if (allVideoIds.length === 0) return [];

    // ---- Step 3: Get video details in batches of 50 ----
    const allVideos: ChannelVideoData[] = [];

    for (let i = 0; i < allVideoIds.length; i += 50) {
      const chunk = allVideoIds.slice(i, i + 50);

      const statsResponse = await youtube.videos.list({
        part: ["statistics", "contentDetails", "snippet"],
        id: chunk,
      });

      const videoStats = statsResponse.data.items ?? [];

      for (const video of videoStats) {
        allVideos.push({
          videoId: video.id ?? "",
          title: video.snippet?.title ?? "",
          description: video.snippet?.description ?? "",
          thumbnailUrl:
            video.snippet?.thumbnails?.high?.url ??
            video.snippet?.thumbnails?.default?.url ??
            "",
          publishedAt: video.snippet?.publishedAt ?? new Date().toISOString(),
          duration: parseDuration(video.contentDetails?.duration ?? "PT0S"),
          views: parseInt(video.statistics?.viewCount ?? "0", 10),
          likes: parseInt(video.statistics?.likeCount ?? "0", 10),
          comments: parseInt(video.statistics?.commentCount ?? "0", 10),
          tags: video.snippet?.tags ?? [],
        });
      }
    }

    console.log(`[YouTube] Fetched full details for ${allVideos.length} videos`);
    return allVideos;
  } catch (error: any) {
    if (error?.code === 403) {
      if (canUseMockData()) {
        console.warn("[YouTube] API quota exceeded, returning mock videos");
        return generateMockChannelVideos(channelId, maxResults);
      }
      console.error("[YouTube] API quota exceeded in production mode");
      return [];
    }
    console.error("[YouTube] Failed to fetch channel videos:", error);
    return [];
  }
}

export async function searchChannels(
  query: string,
  maxResults: number = 5
): Promise<ChannelData[]> {
  if (!youtube) {
    console.warn("[YouTube] No API key configured, returning empty results");
    return [];
  }

  try {
    const searchResponse = await youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["channel"],
      maxResults,
    });

    const channelIds = (searchResponse.data.items ?? [])
      .map((item) => item.snippet?.channelId)
      .filter((id): id is string => !!id);

    if (channelIds.length === 0) return [];

    // Fetch full channel data for each result
    const response = await youtube.channels.list({
      part: ["snippet", "statistics", "brandingSettings"],
      id: channelIds,
    });

    return (response.data.items ?? []).map((channel) => ({
      channelId: channel.id ?? "",
      title: channel.snippet?.title ?? "",
      description: channel.snippet?.description ?? "",
      customUrl: channel.snippet?.customUrl ?? "",
      thumbnailUrl:
        channel.snippet?.thumbnails?.high?.url ??
        channel.snippet?.thumbnails?.default?.url ??
        "",
      bannerUrl: channel.brandingSettings?.image?.bannerExternalUrl ?? "",
      subscriberCount: parseInt(channel.statistics?.subscriberCount ?? "0", 10),
      videoCount: parseInt(channel.statistics?.videoCount ?? "0", 10),
      viewCount: BigInt(channel.statistics?.viewCount ?? "0"),
      country: channel.snippet?.country ?? "",
      publishedAt: channel.snippet?.publishedAt ?? new Date().toISOString(),
    }));
  } catch (error) {
    console.error("[YouTube] Failed to search channels:", error);
    return [];
  }
}

// ============================================
// Analytics Helpers
// ============================================

/**
 * Calculate average uploads per week from a list of videos.
 */
export function calculateUploadFrequency(videos: { publishedAt: string }[]): number {
  if (videos.length < 2) return 0;

  const dates = videos
    .map((v) => new Date(v.publishedAt).getTime())
    .sort((a, b) => a - b);

  const spanMs = dates[dates.length - 1] - dates[0];
  const spanWeeks = spanMs / (1000 * 60 * 60 * 24 * 7);

  if (spanWeeks === 0) return videos.length;

  return Math.round((videos.length / spanWeeks) * 100) / 100;
}

/**
 * Extract commonly used keywords from video titles and tags.
 * Returns sorted by frequency, descending.
 */
export function extractCommonKeywords(
  videos: { title: string; tags: string[] }[]
): { keyword: string; count: number }[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "this", "that", "was", "are",
    "be", "has", "had", "have", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "not", "no", "so", "up", "out", "if",
    "about", "which", "when", "make", "like", "just", "over", "such", "how",
    "its", "than", "them", "then", "these", "some", "her", "him", "my", "your",
    "i", "me", "we", "you", "he", "she", "they", "what", "who", "all", "been",
    "get", "got", "one", "new", "also", "into", "more", "very",
    "|", "-", "–", "—", "#", "&",
  ]);

  const counts = new Map<string, number>();

  for (const video of videos) {
    // Extract words from title
    const titleWords = video.title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    for (const word of titleWords) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }

    // Count tags
    for (const tag of video.tags) {
      const lower = tag.toLowerCase().trim();
      if (lower.length > 1 && !stopWords.has(lower)) {
        counts.set(lower, (counts.get(lower) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Determine if a video is "viral" compared to the channel's average.
 * Viral = views > 2x average views.
 */
export function isVideoViral(videoViews: number, avgViews: number): boolean {
  if (avgViews <= 0) return false;
  return videoViews > avgViews * 2;
}

/**
 * Parse ISO 8601 duration (e.g. "PT1H2M30S") to seconds.
 */
export function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

// ============================================
// Mock Data Generators
// ============================================

export function generateMockChannelData(channelId: string): ChannelData {
  const mockChannels: Record<string, Partial<ChannelData>> = {
    default: {
      title: "Mock Channel",
      description: "This is mock data — set YOUTUBE_API_KEY for real data.",
      customUrl: "@mockchannel",
      thumbnailUrl: "",
      bannerUrl: "",
      subscriberCount: 150000,
      videoCount: 320,
      viewCount: BigInt(45000000),
      country: "US",
    },
  };

  const base = mockChannels.default;

  return {
    channelId,
    title: base.title ?? "Mock Channel",
    description: base.description ?? "",
    customUrl: base.customUrl ?? "",
    thumbnailUrl: base.thumbnailUrl ?? "",
    bannerUrl: base.bannerUrl ?? "",
    subscriberCount: base.subscriberCount ?? 0,
    videoCount: base.videoCount ?? 0,
    viewCount: base.viewCount ?? BigInt(0),
    country: base.country ?? "US",
    publishedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function generateMockChannelVideos(
  channelId: string,
  count: number = 10
): ChannelVideoData[] {
  const mockTitles = [
    "How I Built a Million Dollar Business in 90 Days",
    "This AI Tool Changed Everything",
    "10 Mistakes Every Beginner Makes",
    "I Tried the Most Viral Trend and Here's What Happened",
    "Why Everyone Is Switching to This",
    "The Secret Nobody Tells You About Growth",
    "Full Tutorial: From Zero to Expert",
    "Reacting to the Top Trending Videos",
    "My Honest Review After 6 Months",
    "The Complete Guide You Actually Need",
    "I Tested Every Tool So You Don't Have To",
    "Why This Strategy Actually Works in 2024",
    "Beginner to Pro in One Video",
    "The Truth About Going Viral",
    "Everything Changed When I Discovered This",
    "Stop Making These Common Mistakes",
    "My Workflow Revealed (Full Behind the Scenes)",
    "This Free Tool Is Better Than the Paid One",
    "What Nobody Tells You About Starting Out",
    "The Only Guide You'll Ever Need",
  ];

  const videos: ChannelVideoData[] = [];

  for (let i = 0; i < Math.min(count, mockTitles.length); i++) {
    const daysAgo = Math.floor(Math.random() * 60) + 1;
    const views = Math.floor(Math.random() * 500000) + 5000;

    videos.push({
      videoId: `mock_${channelId}_${i}`,
      title: mockTitles[i],
      description: `Mock video description for "${mockTitles[i]}"`,
      thumbnailUrl: "",
      publishedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
      duration: Math.floor(Math.random() * 1200) + 120,
      views,
      likes: Math.floor(views * (Math.random() * 0.05 + 0.02)),
      comments: Math.floor(views * (Math.random() * 0.01 + 0.002)),
      tags: ["mock", "test", "youtube", "content"],
    });
  }

  return videos.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
