"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  ThumbsUp,
  MessageSquare,
  TrendingUp,
  Clock,
  Calendar,
  Flame,
  ExternalLink,
  Play,
  Film,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ============================================
// Helpers
// ============================================

function formatNumber(num: number | string): string {
  const n = typeof num === "string" ? parseInt(num, 10) : num;
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K`;
  }
  return n.toLocaleString();
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&apos;": "'",
  };
  return text.replace(
    /&(?:amp|lt|gt|quot|apos|#39|#x27|#x2F);/g,
    (match) => entities[match] ?? match
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDurationMin(seconds: number | null): string {
  if (!seconds) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============================================
// Types
// ============================================

interface VideoItem {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  duration: number | null;
  views: number;
  likes: number | null;
  comments: number | null;
  isViral: boolean;
  category?: "short" | "long";
}

interface CategoryStats {
  count: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  viralVideos: number;
  totalViews: number;
}

interface AnalyticsData {
  competitor: {
    id: string;
    channelId: string;
    channelTitle: string;
    channelUrl: string;
    thumbnailUrl: string | null;
    description: string | null;
    category: string | null;
    subscriberCount: number;
    videoCount: number;
    viewCount: string;
  };
  growthChart: { date: string; subscribers: number; views: string }[];
  topVideos: VideoItem[];
  topShorts: VideoItem[];
  topLongForm: VideoItem[];
  shortsStats: CategoryStats;
  longFormStats: CategoryStats;
  stats: {
    avgViews: number;
    avgLikes: number;
    avgComments: number;
    engagementRate: number;
    uploadFrequency: number;
    viralVideos: number;
    totalVideosTracked: number;
  };
  commonKeywords: { keyword: string; count: number }[];
  durationDistribution: {
    short: number;
    medium: number;
    long: number;
    veryLong: number;
  };
  uploadDayDistribution: Record<string, number>;
}

// ============================================
// Video List Sub-Component
// ============================================

function VideoList({
  videos,
  emptyMessage = "No videos tracked yet.",
  isShorts = false,
}: {
  videos: VideoItem[];
  emptyMessage?: string;
  isShorts?: boolean;
}) {
  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {videos.map((video, idx) => (
        <Card key={video.videoId} className="group transition-colors hover:bg-muted/30">
          <CardContent className="flex items-center gap-4 p-4">
            <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
              {idx + 1}
            </span>

            <div className="relative flex-shrink-0">
              {video.thumbnailUrl ? (
                <Image
                  src={video.thumbnailUrl}
                  alt={video.title}
                  width={isShorts ? 48 : 112}
                  height={isShorts ? 80 : 64}
                  className={`rounded object-cover ${isShorts ? "h-20 w-12" : "h-16 w-28"}`}
                />
              ) : (
                <div className={`flex items-center justify-center rounded bg-muted ${isShorts ? "h-20 w-12" : "h-16 w-28"}`}>
                  <Eye className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {video.category === "short" && (
                <Badge className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] px-1 py-0">
                  Short
                </Badge>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={`https://youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-medium hover:underline"
                >
                  {decodeHtmlEntities(video.title)}
                </a>
                {video.isViral && (
                  <Badge variant="warning" className="flex-shrink-0">
                    <Flame className="mr-1 h-3 w-3" />
                    Viral
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {formatNumber(video.views)} views
                </span>
                {video.likes !== null && (
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {formatNumber(video.likes)} likes
                  </span>
                )}
                {video.comments !== null && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {formatNumber(video.comments)} comments
                  </span>
                )}
                {video.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDurationMin(video.duration)}
                  </span>
                )}
                <span>{formatDate(video.publishedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function CompetitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const competitorId = params.id as string;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ["competitor-analytics", competitorId],
    queryFn: async () => {
      const res = await fetch(`/api/competitors/${competitorId}/analytics`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!competitorId,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Force refresh from YouTube API
      const res = await fetch(
        `/api/competitors/${competitorId}/analytics?refresh=true`
      );
      if (res.ok) {
        // Refetch to update the UI with fresh data
        await refetch();
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/competitors")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Competitors
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Failed to load analytics. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    competitor,
    stats,
    topVideos,
    topShorts = [],
    topLongForm = [],
    shortsStats,
    longFormStats,
    commonKeywords,
    durationDistribution,
    uploadDayDistribution,
    growthChart,
  } = data;

  const maxDuration = Math.max(
    durationDistribution.short,
    durationDistribution.medium,
    durationDistribution.long,
    durationDistribution.veryLong,
    1
  );

  const maxDayCount = Math.max(...Object.values(uploadDayDistribution), 1);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push("/competitors")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Competitors
      </Button>

      {/* Channel Header */}
      <div className="flex items-center gap-4">
        {competitor.thumbnailUrl ? (
          <Image
            src={competitor.thumbnailUrl}
            alt={competitor.channelTitle}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">
            {competitor.channelTitle.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {competitor.channelTitle}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatNumber(competitor.subscriberCount)} subscribers</span>
            <span>&middot;</span>
            <span>{formatNumber(competitor.videoCount)} videos</span>
            <span>&middot;</span>
            <span>{formatNumber(competitor.viewCount)} total views</span>
            {competitor.category && (
              <Badge variant="secondary">{competitor.category}</Badge>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh Videos"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={competitor.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Channel
            </a>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Views
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatNumber(stats.avgViews)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Likes
            </CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatNumber(stats.avgLikes)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Comments
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatNumber(stats.avgComments)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Engagement
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.engagementRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upload Freq
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.uploadFrequency}/wk</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="videos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="videos">
            <Play className="mr-1.5 h-4 w-4" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="shorts">
            <Zap className="mr-1.5 h-4 w-4" />
            Shorts
          </TabsTrigger>
          <TabsTrigger value="longform">
            <Film className="mr-1.5 h-4 w-4" />
            Long Form
          </TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
        </TabsList>

        {/* All Videos Tab */}
        <TabsContent value="videos" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Top Performing Videos ({topVideos.length})
            </h3>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Calendar className="mr-1 h-3 w-3" />
              Last 30 days
            </Badge>
          </div>
          <VideoList videos={topVideos} emptyMessage="No videos published in the last 30 days." />
        </TabsContent>

        {/* Shorts Tab */}
        <TabsContent value="shorts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Shorts Performance</h3>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Calendar className="mr-1 h-3 w-3" />
              Last 30 days &middot; &le; 2 min
            </Badge>
          </div>

          {/* Shorts Summary Stats */}
          {shortsStats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Total Shorts</p>
                  <p className="mt-1 text-xl font-bold">{shortsStats.count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Avg Views</p>
                  <p className="mt-1 text-xl font-bold">{formatNumber(shortsStats.avgViews)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Avg Likes</p>
                  <p className="mt-1 text-xl font-bold">{formatNumber(shortsStats.avgLikes)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Engagement</p>
                  <p className="mt-1 text-xl font-bold">{shortsStats.engagementRate}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Viral Shorts</p>
                  <p className="mt-1 text-xl font-bold text-amber-600">{shortsStats.viralVideos}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Total Views</p>
                  <p className="mt-1 text-xl font-bold">{formatNumber(shortsStats.totalViews)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <h3 className="text-lg font-semibold">
            <Zap className="mr-1.5 inline h-5 w-5 text-amber-500" />
            Top 10 Performing Shorts
          </h3>
          <VideoList videos={topShorts} emptyMessage="No Shorts published in the last 30 days." isShorts />
        </TabsContent>

        {/* Long Form Tab */}
        <TabsContent value="longform" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Long Form Performance</h3>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <Calendar className="mr-1 h-3 w-3" />
              Last 30 days &middot; &gt; 2 min
            </Badge>
          </div>

          {/* Long Form Summary Stats */}
          {longFormStats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Total Long Form</p>
                  <p className="mt-1 text-xl font-bold">{longFormStats.count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Avg Views</p>
                  <p className="mt-1 text-xl font-bold">{formatNumber(longFormStats.avgViews)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Avg Likes</p>
                  <p className="mt-1 text-xl font-bold">{formatNumber(longFormStats.avgLikes)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Engagement</p>
                  <p className="mt-1 text-xl font-bold">{longFormStats.engagementRate}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Viral Videos</p>
                  <p className="mt-1 text-xl font-bold text-amber-600">{longFormStats.viralVideos}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Total Views</p>
                  <p className="mt-1 text-xl font-bold">{formatNumber(longFormStats.totalViews)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <h3 className="text-lg font-semibold">
            <Film className="mr-1.5 inline h-5 w-5 text-blue-500" />
            Top 10 Performing Long Form Videos
          </h3>
          <VideoList videos={topLongForm} emptyMessage="No long-form videos published in the last 30 days." />
        </TabsContent>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="space-y-4">
          <h3 className="text-lg font-semibold">
            Common Keywords ({commonKeywords.length})
          </h3>
          {commonKeywords.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No keyword data available yet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-wrap gap-2 p-4">
                {commonKeywords.map((kw) => (
                  <Badge
                    key={kw.keyword}
                    variant="secondary"
                    className="text-sm"
                  >
                    {kw.keyword}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({kw.count})
                    </span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-6">
          {/* Duration Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Video Length Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Shorts (\u22642 min)", value: durationDistribution.short },
                { label: "Medium (2-10 min)", value: durationDistribution.medium },
                { label: "Long (10-30 min)", value: durationDistribution.long },
                { label: "Very Long (30+ min)", value: durationDistribution.veryLong },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{
                        width: `${(item.value / maxDuration) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upload Day Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload Day Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(uploadDayDistribution).map(([day, count]) => (
                <div key={day} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{day}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{
                        width: `${(count / maxDayCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  Uploads approximately{" "}
                  <strong className="text-foreground">
                    {stats.uploadFrequency} videos/week
                  </strong>
                </li>
                <li className="flex items-center gap-2">
                  <Flame className="h-4 w-4 flex-shrink-0" />
                  <strong className="text-foreground">
                    {stats.viralVideos}
                  </strong>{" "}
                  viral videos (2x+ avg views) out of{" "}
                  {stats.totalVideosTracked} tracked
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 flex-shrink-0" />
                  Average engagement rate:{" "}
                  <strong className="text-foreground">
                    {stats.engagementRate}%
                  </strong>
                </li>
                {commonKeywords.length > 0 && (
                  <li className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    Top keyword:{" "}
                    <strong className="text-foreground">
                      &quot;{commonKeywords[0].keyword}&quot;
                    </strong>{" "}
                    (used {commonKeywords[0].count} times)
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Growth Tab */}
        <TabsContent value="growth" className="space-y-4">
          <h3 className="text-lg font-semibold">Subscriber History</h3>
          {growthChart.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Not enough data for growth tracking yet. Check back after more
                snapshots are collected.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Date
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          Subscribers
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          Total Views
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {growthChart.map((entry, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatNumber(entry.subscribers)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatNumber(entry.views)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
