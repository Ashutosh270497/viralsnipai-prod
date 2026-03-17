"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { X, TrendingUp, Heart, Repeat2, MessageCircle, Eye, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ViralTweetCard } from "./viral-tweet-card";

interface TrackedAccountDetailDialogProps {
  accountId: string | null;
  onClose: () => void;
}

interface AccountDetails {
  account: {
    id: string;
    trackedUsername: string;
    trackedDisplayName: string;
    profileImageUrl: string | null;
    followerCount: number;
    niche: string | null;
    createdAt: string;
  };
  analytics: {
    totalTweets: number;
    analyzedTweets: number;
    analysisProgress: number;
    totalEngagement: {
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
    };
    averageEngagement: {
      likes: number;
      retweets: number;
      replies: number;
      viralScore: number;
    };
    patterns: {
      hookTypes: Record<string, number>;
      formats: Record<string, number>;
      emotions: Record<string, number>;
      mediaTypes: Record<string, number>;
    };
  };
  topTweets: Array<any>;
  allTweets: Array<any>;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

export function TrackedAccountDetailDialog({
  accountId,
  onClose,
}: TrackedAccountDetailDialogProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading } = useQuery<AccountDetails>({
    queryKey: ["snipradar-account-details", accountId],
    queryFn: async () => {
      const res = await fetch(`/api/snipradar/accounts/${accountId}/details`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!accountId,
  });

  return (
    <Dialog open={!!accountId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <DialogHeader>
              <div className="flex items-center gap-3">
                {data.account.profileImageUrl && (
                  <Image
                    src={data.account.profileImageUrl}
                    alt={data.account.trackedDisplayName}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full"
                  />
                )}
                <div>
                  <DialogTitle className="text-xl">
                    {data.account.trackedDisplayName}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    @{data.account.trackedUsername} •{" "}
                    {formatNumber(data.account.followerCount)} followers
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="patterns">Patterns</TabsTrigger>
                <TabsTrigger value="tweets">All Tweets ({data.analytics.totalTweets})</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Viral Tweets
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{data.analytics.totalTweets}</div>
                      <p className="text-xs text-muted-foreground">
                        {data.analytics.analyzedTweets} analyzed
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Heart className="h-3 w-3" /> Avg Likes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatNumber(data.analytics.averageEngagement.likes)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(data.analytics.totalEngagement.likes)} total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Repeat2 className="h-3 w-3" /> Avg RTs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatNumber(data.analytics.averageEngagement.retweets)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(data.analytics.totalEngagement.retweets)} total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Viral Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {data.analytics.averageEngagement.viralScore}
                      </div>
                      <p className="text-xs text-muted-foreground">average</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Top Tweets */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    Top 10 Performing Tweets
                  </h3>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {data.topTweets.map((tweet) => (
                      <ViralTweetCard key={tweet.id} tweet={tweet} />
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Patterns Tab */}
              <TabsContent value="patterns" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Hook Types */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Hook Types</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(data.analytics.patterns.hookTypes)
                          .sort(([, a], [, b]) => b - a)
                          .map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between">
                              <span className="text-sm capitalize">{type}</span>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{
                                      width: `${(count / data.analytics.totalTweets) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium w-8 text-right">
                                  {count}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Formats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Tweet Formats</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(data.analytics.patterns.formats)
                          .sort(([, a], [, b]) => b - a)
                          .map(([format, count]) => (
                            <div key={format} className="flex items-center justify-between">
                              <span className="text-sm capitalize">{format}</span>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{
                                      width: `${(count / data.analytics.totalTweets) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium w-8 text-right">
                                  {count}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Emotions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Emotional Triggers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(data.analytics.patterns.emotions)
                          .sort(([, a], [, b]) => b - a)
                          .map(([emotion, count]) => (
                            <div key={emotion} className="flex items-center justify-between">
                              <span className="text-sm capitalize">{emotion}</span>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{
                                      width: `${(count / data.analytics.totalTweets) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium w-8 text-right">
                                  {count}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Media Types */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Media Types</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(data.analytics.patterns.mediaTypes)
                          .sort(([, a], [, b]) => b - a)
                          .map(([media, count]) => (
                            <div key={media} className="flex items-center justify-between">
                              <span className="text-sm capitalize">{media}</span>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{
                                      width: `${(count / data.analytics.totalTweets) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium w-8 text-right">
                                  {count}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pattern Insights */}
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">
                      📊 Pattern Insights
                    </h4>
                    <ul className="text-xs space-y-1 text-blue-800 dark:text-blue-200">
                      {Object.entries(data.analytics.patterns.hookTypes)[0] && (
                        <li>
                          • Most effective hook:{" "}
                          <span className="font-semibold capitalize">
                            {Object.entries(data.analytics.patterns.hookTypes).sort(([, a], [, b]) => b - a)[0][0]}
                          </span>
                        </li>
                      )}
                      {Object.entries(data.analytics.patterns.emotions)[0] && (
                        <li>
                          • Primary emotional trigger:{" "}
                          <span className="font-semibold capitalize">
                            {Object.entries(data.analytics.patterns.emotions).sort(([, a], [, b]) => b - a)[0][0]}
                          </span>
                        </li>
                      )}
                      <li>
                        • Analysis completion:{" "}
                        <span className="font-semibold">
                          {data.analytics.analysisProgress}%
                        </span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* All Tweets Tab */}
              <TabsContent value="tweets" className="space-y-3">
                <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3">
                  {data.allTweets.map((tweet) => (
                    <ViralTweetCard key={tweet.id} tweet={tweet} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
