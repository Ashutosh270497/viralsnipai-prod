import { google, youtube_v3 } from "googleapis";

// Initialize YouTube client - gracefully handle missing API key
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

let youtube: youtube_v3.Youtube | null = null;

if (YOUTUBE_API_KEY) {
  youtube = google.youtube({
    version: "v3",
    auth: YOUTUBE_API_KEY,
  });
} else {
  console.warn(
    "[YouTube Keywords] YOUTUBE_API_KEY not set - using mock data for keyword research"
  );
}

// ============================================
// Interfaces
// ============================================

export interface KeywordSearchResult {
  keyword: string;
  totalResults: number;
  videos: VideoResult[];
  nextPageToken?: string;
  freshnessTimestamp: string;
  discoveryMetadata?: {
    mode: "single_query" | "multi_query_expansion";
    queriesTried: number;
    queriesSucceeded: number;
    queriesFailed: number;
    truncated: boolean;
    maxExpansions?: number;
    maxResultsPerQuery: number;
    maxVideosReturned: number;
  };
  dataQuality: {
    source: "youtube_api" | "mock";
    confidence: "high" | "medium" | "low";
    warnings: string[];
  };
}

export interface VideoResult {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
  tags: string[];
}

export interface ChannelInfo {
  channelId: string;
  title: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  thumbnailUrl: string;
  description: string;
}

// ============================================
// Mock Data Generator
// ============================================

function generateMockSearchResult(
  keyword: string,
  warning?: string
): KeywordSearchResult {
  const mockVideos: VideoResult[] = Array.from({ length: 10 }, (_, i) => {
    const viewCount = Math.floor(Math.random() * 500000) + 1000;
    const likeRatio = 0.02 + Math.random() * 0.06;
    const commentRatio = 0.001 + Math.random() * 0.005;

    return {
      videoId: `mock_vid_${keyword.replace(/\s+/g, "_")}_${i}`,
      title: `${keyword} - ${["Ultimate Guide", "Top Tips", "Everything You Need to Know", "Complete Tutorial", "Beginner to Pro", "In-Depth Review", "Step by Step", "Expert Analysis", "Full Breakdown", "Best Practices"][i]}`,
      description: `A comprehensive video about ${keyword}. Learn the best strategies and tips for ${keyword} in this detailed guide.`,
      channelId: `mock_channel_${i}`,
      channelTitle: `${["TechExplorer", "CreatorHub", "ProGuide", "DigitalMaster", "ContentKing", "ViewBoost", "TrendSetters", "GrowthHacks", "ViralFactory", "InsightLab"][i]}`,
      publishedAt: new Date(
        Date.now() - Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000
      ).toISOString(),
      thumbnailUrl: `https://i.ytimg.com/vi/mock_${i}/hqdefault.jpg`,
      viewCount,
      likeCount: Math.floor(viewCount * likeRatio),
      commentCount: Math.floor(viewCount * commentRatio),
      duration: `PT${Math.floor(Math.random() * 20) + 3}M${Math.floor(Math.random() * 60)}S`,
      tags: [keyword, ...keyword.split(" "), "youtube", "tutorial"],
    };
  });

  return {
    keyword,
    totalResults: Math.floor(Math.random() * 5000000) + 10000,
    videos: mockVideos,
    freshnessTimestamp: new Date().toISOString(),
    discoveryMetadata: {
      mode: "single_query",
      queriesTried: 1,
      queriesSucceeded: 1,
      queriesFailed: 0,
      truncated: false,
      maxResultsPerQuery: mockVideos.length,
      maxVideosReturned: mockVideos.length,
    },
    dataQuality: {
      source: "mock",
      confidence: "low",
      warnings: [
        warning ??
          "Using fallback mock keyword data because live YouTube API data is unavailable.",
      ],
    },
  };
}

// ============================================
// YouTube API Functions
// ============================================

export async function searchKeyword(
  keyword: string,
  maxResults: number = 50,
  options?: {
    regionCode?: string;
    relevanceLanguage?: string;
    allowMockFallback?: boolean;
  }
): Promise<KeywordSearchResult> {
  const allowMockFallback = options?.allowMockFallback ?? true;
  const relevanceLanguage = options?.relevanceLanguage ?? "en";
  const regionCode = options?.regionCode ?? "US";

  if (!youtube) {
    if (!allowMockFallback) {
      throw new Error("YOUTUBE_API_UNAVAILABLE");
    }
    return generateMockSearchResult(
      keyword,
      "YouTube API key is missing. Configure YOUTUBE_API_KEY for production keyword analysis."
    );
  }

  try {
    const searchResponse = await youtube.search.list({
      part: ["snippet"],
      q: keyword,
      type: ["video"],
      maxResults: Math.min(maxResults, 50),
      order: "relevance",
      relevanceLanguage,
      regionCode,
    });

    const items = searchResponse.data.items || [];
    const videoIds = items
      .map((item) => item.id?.videoId)
      .filter(Boolean) as string[];

    // Fetch detailed video stats
    const videoDetails = videoIds.length > 0 ? await getVideoDetails(videoIds) : [];

    const videos: VideoResult[] = items.map((item, index) => {
      const details = videoDetails.find(
        (v) => v.videoId === item.id?.videoId
      );

      return {
        videoId: item.id?.videoId || "",
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
        channelId: item.snippet?.channelId || "",
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        viewCount: details?.viewCount || 0,
        likeCount: details?.likeCount || 0,
        commentCount: details?.commentCount || 0,
        duration: details?.duration || "PT0S",
        tags: details?.tags || [],
      };
    });

    return {
      keyword,
      totalResults:
        searchResponse.data.pageInfo?.totalResults || videos.length,
      videos,
      nextPageToken: searchResponse.data.nextPageToken || undefined,
      freshnessTimestamp: new Date().toISOString(),
      discoveryMetadata: {
        mode: "single_query",
        queriesTried: 1,
        queriesSucceeded: 1,
        queriesFailed: 0,
        truncated: false,
        maxResultsPerQuery: Math.min(maxResults, 50),
        maxVideosReturned: videos.length,
      },
      dataQuality: {
        source: "youtube_api",
        confidence: "high",
        warnings: [
          "Search volume is based on YouTube result counts and should be treated as directional demand, not exact monthly volume.",
        ],
      },
    };
  } catch (error: any) {
    // Fall back to mock data on quota/permission only when explicitly allowed (e.g., local dev)
    if (error?.code === 403 || error?.response?.status === 403) {
      console.warn(
        "[YouTube Keywords] API quota exceeded, falling back to mock data"
      );
      if (!allowMockFallback) {
        throw new Error("YOUTUBE_API_QUOTA_EXCEEDED");
      }
      return generateMockSearchResult(
        keyword,
        "YouTube API quota exceeded. Showing fallback data."
      );
    }
    console.error("[YouTube Keywords] Search error:", error);
    if (!allowMockFallback) {
      throw new Error("YOUTUBE_API_SEARCH_FAILED");
    }
    return generateMockSearchResult(
      keyword,
      "YouTube API search failed. Showing fallback data."
    );
  }
}

export async function getVideoDetails(
  videoIds: string[]
): Promise<
  {
    videoId: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    duration: string;
    tags: string[];
  }[]
> {
  if (!youtube || videoIds.length === 0) return [];

  try {
    const response = await youtube.videos.list({
      part: ["statistics", "contentDetails", "snippet"],
      id: videoIds,
    });

    return (response.data.items || []).map((item) => ({
      videoId: item.id || "",
      viewCount: parseInt(item.statistics?.viewCount || "0", 10),
      likeCount: parseInt(item.statistics?.likeCount || "0", 10),
      commentCount: parseInt(item.statistics?.commentCount || "0", 10),
      duration: item.contentDetails?.duration || "PT0S",
      tags: item.snippet?.tags || [],
    }));
  } catch (error) {
    console.error("[YouTube Keywords] Video details error:", error);
    return [];
  }
}

export async function getChannelDetails(
  channelIds: string[]
): Promise<ChannelInfo[]> {
  if (!youtube || channelIds.length === 0) return [];

  try {
    const response = await youtube.channels.list({
      part: ["snippet", "statistics"],
      id: channelIds,
    });

    return (response.data.items || []).map((item) => ({
      channelId: item.id || "",
      title: item.snippet?.title || "",
      subscriberCount: parseInt(
        item.statistics?.subscriberCount || "0",
        10
      ),
      videoCount: parseInt(item.statistics?.videoCount || "0", 10),
      viewCount: parseInt(item.statistics?.viewCount || "0", 10),
      thumbnailUrl:
        item.snippet?.thumbnails?.default?.url || "",
      description: item.snippet?.description || "",
    }));
  } catch (error) {
    console.error("[YouTube Keywords] Channel details error:", error);
    return [];
  }
}

export async function getAutocompleteSuggestions(
  keyword: string
): Promise<string[]> {
  if (!youtube) {
    // Return basic generated suggestions when no API key
    const prefixes = ["how to", "best", "top", "why", "what is"];
    return prefixes.map((prefix) => `${prefix} ${keyword}`);
  }

  try {
    const response = await youtube.search.list({
      part: ["snippet"],
      q: keyword,
      type: ["video"],
      maxResults: 10,
    });

    const suggestions = (response.data.items || [])
      .map((item) => item.snippet?.title || "")
      .filter(Boolean);

    return [...new Set(suggestions)];
  } catch (error) {
    console.error("[YouTube Keywords] Autocomplete error:", error);
    return [];
  }
}

// ============================================
// Analytics & Metrics
// ============================================

export function calculateKeywordMetrics(searchResult: KeywordSearchResult) {
  const { videos } = searchResult;

  if (videos.length === 0) {
    return {
      avgViews: 0,
      avgLikes: 0,
      avgComments: 0,
      avgDuration: 0,
      avgChannelSize: 0,
      engagementRate: 0,
      topChannelDominance: 0,
      averageVideoAge: 0,
    };
  }

  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
  const totalLikes = videos.reduce((sum, v) => sum + v.likeCount, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.commentCount, 0);
  const totalDuration = videos.reduce(
    (sum, v) => sum + parseDuration(v.duration),
    0
  );

  const avgViews = Math.round(totalViews / videos.length);
  const avgLikes = Math.round(totalLikes / videos.length);
  const avgComments = Math.round(totalComments / videos.length);
  const avgDuration = Math.round(totalDuration / videos.length);

  // Engagement rate: (likes + comments) / views * 100
  const engagementRate =
    totalViews > 0
      ? parseFloat(
          (((totalLikes + totalComments) / totalViews) * 100).toFixed(2)
        )
      : 0;

  // Top channel dominance: views of top video / total views
  const sortedByViews = [...videos].sort(
    (a, b) => b.viewCount - a.viewCount
  );
  const topChannelDominance =
    totalViews > 0
      ? parseFloat(
          ((sortedByViews[0].viewCount / totalViews) * 100).toFixed(2)
        )
      : 0;

  // Average video age in days
  const now = Date.now();
  const totalAgeDays = videos.reduce((sum, v) => {
    const publishDate = new Date(v.publishedAt).getTime();
    return sum + (now - publishDate) / (1000 * 60 * 60 * 24);
  }, 0);
  const averageVideoAge = Math.round(totalAgeDays / videos.length);

  // Average channel size (we don't have this from search, estimate from views)
  const avgChannelSize = Math.round(avgViews * 15); // rough estimate

  return {
    avgViews,
    avgLikes,
    avgComments,
    avgDuration,
    avgChannelSize,
    engagementRate,
    topChannelDominance,
    averageVideoAge,
  };
}

// ============================================
// Video Categories
// ============================================

export async function getVideoCategories(
  regionCode: string = "US"
): Promise<{ id: string; title: string }[]> {
  if (!youtube) {
    return [
      { id: "1", title: "Film & Animation" },
      { id: "2", title: "Autos & Vehicles" },
      { id: "10", title: "Music" },
      { id: "15", title: "Pets & Animals" },
      { id: "17", title: "Sports" },
      { id: "20", title: "Gaming" },
      { id: "22", title: "People & Blogs" },
      { id: "23", title: "Comedy" },
      { id: "24", title: "Entertainment" },
      { id: "25", title: "News & Politics" },
      { id: "26", title: "Howto & Style" },
      { id: "27", title: "Education" },
      { id: "28", title: "Science & Technology" },
    ];
  }

  try {
    const response = await youtube.videoCategories.list({
      part: ["snippet"],
      regionCode,
    });

    return (response.data.items || []).map((item) => ({
      id: item.id || "",
      title: item.snippet?.title || "",
    }));
  } catch (error) {
    console.error("[YouTube Keywords] Categories error:", error);
    return [
      { id: "1", title: "Film & Animation" },
      { id: "20", title: "Gaming" },
      { id: "22", title: "People & Blogs" },
      { id: "24", title: "Entertainment" },
      { id: "27", title: "Education" },
      { id: "28", title: "Science & Technology" },
    ];
  }
}

// ============================================
// Helpers
// ============================================

export function parseDuration(isoDuration: string): number {
  // Parse ISO 8601 duration (e.g., PT15M33S) to seconds
  const match = isoDuration.match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
  );

  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}
