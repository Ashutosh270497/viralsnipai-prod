"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Eye,
  Video,
  Plus,
  ExternalLink,
  Trash2,
  BarChart3,
  Loader2,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddCompetitorDialog } from "@/components/competitors/add-competitor-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    (match) => entities[match] ?? match,
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ============================================
// Types
// ============================================

interface CompetitorVideo {
  id: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  views: number;
  likes: number | null;
  comments: number | null;
  isViral: boolean;
}

interface Competitor {
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
  isActive: boolean;
  createdAt?: string;
  subsGrowth: number;
  subsGrowthPercent: number;
  viewsGrowth: string;
  avgViews: number;
  isNewlyTracked: boolean;
  syncStatus?: "idle" | "queued" | "syncing" | "success" | "failed";
  lastSyncAt?: string | null;
  lastSyncQueuedAt?: string | null;
  lastSyncReason?: string | null;
  lastSyncError?: string | null;
  syncFailureCount?: number;
  videos: CompetitorVideo[];
}

// ============================================
// Component
// ============================================

export default function CompetitorsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "growth" | "subscribers" | "avgViews" | "sync">(
    "recent",
  );
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ competitors: Competitor[] }>({
    queryKey: ["competitors"],
    queryFn: async () => {
      const res = await fetch("/api/competitors");
      if (!res.ok) throw new Error("Failed to fetch competitors");
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/competitors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/competitors/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshVideos: true, force: true }),
      });
      if (!res.ok) throw new Error("Failed to queue sync");
      const json = await res.json();
      if (!json?.enqueued) {
        throw new Error("Sync could not be started");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    },
  });

  const competitors = useMemo(() => data?.competitors ?? [], [data?.competitors]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(competitors.map((c) => c.category).filter((v): v is string => Boolean(v))),
      ).sort((a, b) => a.localeCompare(b)),
    [competitors],
  );

  const filteredCompetitors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = (c: Competitor) => {
      if (!query) return true;
      return (
        c.channelTitle.toLowerCase().includes(query) ||
        c.channelId.toLowerCase().includes(query) ||
        (c.category?.toLowerCase().includes(query) ?? false)
      );
    };

    const matchesCategory = (c: Competitor) =>
      categoryFilter === "all" || c.category === categoryFilter;

    const getSyncRank = (status?: Competitor["syncStatus"]) => {
      switch (status) {
        case "failed":
          return 5;
        case "syncing":
          return 4;
        case "queued":
          return 3;
        case "success":
          return 2;
        default:
          return 1;
      }
    };

    return competitors
      .filter((c) => matchesQuery(c) && matchesCategory(c))
      .sort((a, b) => {
        if (sortBy === "growth") return b.subsGrowth - a.subsGrowth;
        if (sortBy === "subscribers") return b.subscriberCount - a.subscriberCount;
        if (sortBy === "avgViews") return b.avgViews - a.avgViews;
        if (sortBy === "sync") return getSyncRank(b.syncStatus) - getSyncRank(a.syncStatus);
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      });
  }, [competitors, searchQuery, categoryFilter, sortBy]);

  // Summary stats
  const trackingCount = filteredCompetitors.length;
  const allNewlyTracked =
    filteredCompetitors.length > 0 && filteredCompetitors.every((c) => c.isNewlyTracked);
  const growingCount = filteredCompetitors.filter(
    (c) => !c.isNewlyTracked && c.subsGrowth > 0,
  ).length;
  const { totalViews, totalVideoCount } = filteredCompetitors.reduce(
    (acc, c) => ({
      totalViews: acc.totalViews + c.avgViews * c.videos.length,
      totalVideoCount: acc.totalVideoCount + c.videos.length,
    }),
    { totalViews: 0, totalVideoCount: 0 },
  );
  const totalAvgViews = totalVideoCount > 0 ? Math.round(totalViews / totalVideoCount) : 0;
  const recentVideosCount = filteredCompetitors.reduce((sum, c) => sum + c.videos.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Competitor Tracking</h1>
          <p className="text-muted-foreground">Monitor your competitors&apos; YouTube channels.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Competitor Tracking</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Failed to load competitors. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Competitor Tracking</h1>
          <p className="text-muted-foreground">
            Monitor your competitors&apos; YouTube channels and find content opportunities.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
        >
          <Plus className="h-4 w-4" />
          Add Competitor
        </Button>
      </div>

      {/* Controls */}
      <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/40 dark:from-white/[0.02] to-transparent">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by channel, category, or ID..."
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="growth">Highest growth</SelectItem>
                <SelectItem value="subscribers">Most subscribers</SelectItem>
                <SelectItem value="avgViews">Highest avg views</SelectItem>
                <SelectItem value="sync">Sync priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {filteredCompetitors.length} of {competitors.length} competitors
          </p>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-violet-100 dark:bg-violet-500/10 p-2.5 text-violet-600 dark:text-violet-400">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground/70">channels</span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{trackingCount}</p>
          <p className="text-sm text-muted-foreground">Tracking</p>
        </Card>

        <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground/70">gaining subs</span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{allNewlyTracked ? "—" : growingCount}</p>
          <p className="text-sm text-muted-foreground">Growing</p>
        </Card>

        <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-blue-100 dark:bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
              <Eye className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground/70">per video</span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{formatNumber(totalAvgViews)}</p>
          <p className="text-sm text-muted-foreground">Avg Views</p>
        </Card>

        <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-amber-100 dark:bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
              <Video className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground/70">latest tracked</span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{recentVideosCount}</p>
          <p className="text-sm text-muted-foreground">Recent Videos</p>
        </Card>
      </div>

      {/* Competitor Cards or Empty State */}
      {filteredCompetitors.length === 0 ? (
        <Card className="border border-border dark:border-white/[0.07]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-500/10">
              <Users className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No Competitors Yet</h3>
            <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
              Start tracking your competitors to discover content strategies, trending topics, and
              growth opportunities.
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
            >
              <Plus className="h-4 w-4" />
              Add Your First Competitor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredCompetitors.map((competitor) => (
            <Card key={competitor.id} className="flex flex-col border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/30 dark:from-white/[0.02] to-transparent hover:from-muted/60 dark:hover:from-white/[0.05] transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  {/* Channel Avatar */}
                  {competitor.thumbnailUrl ? (
                    <Image
                      src={competitor.thumbnailUrl}
                      alt={competitor.channelTitle}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{competitor.channelTitle}</CardTitle>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {formatNumber(competitor.subscriberCount)} subs
                      </span>
                      {competitor.category && (
                        <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                          {competitor.category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Growth Indicator */}
                  <div className="flex-shrink-0">
                    {competitor.isNewlyTracked ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-blue-300 dark:border-blue-500/20 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-semibold">
                        New
                      </span>
                    ) : competitor.subsGrowth > 0 ? (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-medium">
                          +{formatNumber(competitor.subsGrowth)}
                        </span>
                      </div>
                    ) : competitor.subsGrowth < 0 ? (
                      <div className="flex items-center gap-1 text-red-600 dark:text-red-500">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs font-medium">
                          {formatNumber(competitor.subsGrowth)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                {/* Sync Status */}
                <div className="flex items-center justify-between rounded-lg border border-border dark:border-white/[0.07] bg-muted/30 dark:bg-white/[0.02] px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    {competitor.syncStatus === "failed" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-500" />
                    ) : competitor.syncStatus === "syncing" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-500" />
                    ) : competitor.syncStatus === "queued" ? (
                      <Clock3 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
                    )}
                    <span className="capitalize">{competitor.syncStatus ?? "idle"}</span>
                    {competitor.syncStatus === "failed" && competitor.syncFailureCount ? (
                      <span className="text-muted-foreground">
                        ({competitor.syncFailureCount} failures)
                      </span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground">
                    {competitor.syncStatus === "queued"
                      ? `Queued ${formatRelativeTime(competitor.lastSyncQueuedAt)}`
                      : `Synced ${formatRelativeTime(competitor.lastSyncAt)}`}
                  </span>
                </div>
                {competitor.syncStatus === "failed" && competitor.lastSyncError ? (
                  <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">{competitor.lastSyncError}</p>
                ) : null}

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-border dark:border-white/[0.07] bg-muted/40 dark:bg-white/[0.02] p-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Videos</p>
                    <p className="text-sm font-semibold">{formatNumber(competitor.videoCount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Views</p>
                    <p className="text-sm font-semibold">{formatNumber(competitor.viewCount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Avg Views</p>
                    <p className="text-sm font-semibold">{formatNumber(competitor.avgViews)}</p>
                  </div>
                </div>

                {/* Recent Videos */}
                {competitor.videos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Recent Videos</p>
                    {competitor.videos.slice(0, 3).map((video) => (
                      <div key={video.id} className="flex items-center gap-2 rounded-md border border-border dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.01] p-2">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-medium">
                            {decodeHtmlEntities(video.title)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatNumber(video.views)} views</span>
                            <span>&middot;</span>
                            <span>{formatDate(video.publishedAt)}</span>
                            {video.isViral && (
                              <span className="inline-flex items-center px-1.5 py-0 rounded-full border border-orange-300 dark:border-orange-500/20 bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 text-[10px] font-semibold">
                                Viral
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/competitors/${competitor.id}`}>
                      <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                      Analytics
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={competitor.channelUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate(competitor.id)}
                    disabled={
                      syncMutation.isPending ||
                      competitor.syncStatus === "queued" ||
                      competitor.syncStatus === "syncing"
                    }
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Stop tracking ${competitor.channelTitle}?`)) {
                        deleteMutation.mutate(competitor.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Competitor Dialog */}
      <AddCompetitorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["competitors"] });
        }}
      />
    </div>
  );
}
