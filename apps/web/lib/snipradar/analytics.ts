export interface AnalyticsTweetRow {
  id: string;
  tweetId: string | null;
  tweetUrl: string | null;
  text: string;
  hookType: string | null;
  format: string | null;
  emotionalTrigger: string | null;
  viralPrediction: number | null;
  postType: "post" | "reply";
  postedAt: string | null;
  actualLikes: number | null;
  actualRetweets: number | null;
  actualReplies: number | null;
  actualImpressions: number | null;
}

export interface AnalyticsGrowthPoint {
  date: string;
  followers: number;
  following: number;
  tweets: number;
  growth: number;
}

export interface AnalyticsSummaryInsights {
  text: string;
  confidence: "low" | "medium" | "high";
}

export interface PostTypePerformance {
  label: string;
  posts: number;
  avgEngagement: number;
  avgRate: number;
}

export interface AnalyticsSummary {
  accountTweetCount: number;
  totalRadarPosts: number;
  totalImpressions: number;
  totalEngagement: number;
  avgEngagementRate: number;
  windowPostsTracked: number;
  windowRepliesTracked: number;
  avgImpressionsPerPost: number;
  avgImpressionsPerReply: number;
}

export interface AnalyticsBreakdowns {
  hookTypeBreakdown: Record<string, number>;
  formatBreakdown: Record<string, number>;
  emotionBreakdown: Record<string, number>;
}

export function calcEngagement(
  row: Pick<AnalyticsTweetRow, "actualLikes" | "actualRetweets" | "actualReplies">
) {
  return (row.actualLikes ?? 0) + (row.actualRetweets ?? 0) + (row.actualReplies ?? 0);
}

export function calcEngagementRate(row: AnalyticsTweetRow) {
  const impressions = row.actualImpressions ?? 0;
  if (impressions <= 0) return 0;
  return (calcEngagement(row) / impressions) * 100;
}

export function derivePatternBreakdown(
  tweets: AnalyticsTweetRow[],
  field: "hookType" | "format" | "emotionalTrigger"
) {
  return tweets.reduce<Record<string, number>>((acc, tweet) => {
    const value = tweet[field]?.trim();
    if (!value) return acc;
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export function derivePatternBreakdowns(tweets: AnalyticsTweetRow[]): AnalyticsBreakdowns {
  return {
    hookTypeBreakdown: derivePatternBreakdown(tweets, "hookType"),
    formatBreakdown: derivePatternBreakdown(tweets, "format"),
    emotionBreakdown: derivePatternBreakdown(tweets, "emotionalTrigger"),
  };
}

export function deriveTopPostTypes(tweets: AnalyticsTweetRow[]): PostTypePerformance[] {
  const grouped = new Map<
    string,
    { posts: number; totalEngagement: number; totalImpressions: number }
  >();

  for (const tweet of tweets) {
    const formatLabel = tweet.format?.trim() || "single post";
    const key = formatLabel.toLowerCase();
    const existing = grouped.get(key) ?? { posts: 0, totalEngagement: 0, totalImpressions: 0 };
    existing.posts += 1;
    existing.totalEngagement += calcEngagement(tweet);
    existing.totalImpressions += tweet.actualImpressions ?? 0;
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .map(([label, values]) => {
      const avgEngagement = values.posts > 0 ? values.totalEngagement / values.posts : 0;
      const avgRate =
        values.totalImpressions > 0 ? (values.totalEngagement / values.totalImpressions) * 100 : 0;
      return {
        label,
        posts: values.posts,
        avgEngagement: Math.round(avgEngagement),
        avgRate: Number(avgRate.toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (b.avgRate !== a.avgRate) return b.avgRate - a.avgRate;
      return b.posts - a.posts;
    })
    .slice(0, 3);
}

export function selectBestPerformingTweet(tweets: AnalyticsTweetRow[]) {
  if (tweets.length === 0) return null;

  return tweets.reduce((best, current) => {
    const bestEngagement = calcEngagement(best);
    const currentEngagement = calcEngagement(current);
    if (currentEngagement === bestEngagement) {
      return (current.actualImpressions ?? 0) > (best.actualImpressions ?? 0) ? current : best;
    }
    return currentEngagement > bestEngagement ? current : best;
  });
}

export function computeAverageImpressions(tweets: AnalyticsTweetRow[]) {
  if (tweets.length === 0) return 0;
  const total = tweets.reduce((sum, tweet) => sum + (tweet.actualImpressions ?? 0), 0);
  return Math.round(total / tweets.length);
}

export function buildSummary(params: {
  accountTweetCount: number;
  totalRadarPosts: number;
  postedTweets: AnalyticsTweetRow[];
  replyTweets: AnalyticsTweetRow[];
  summaryTweets?: AnalyticsTweetRow[];
}): AnalyticsSummary {
  const { accountTweetCount, totalRadarPosts, postedTweets, replyTweets, summaryTweets } = params;
  const sourceTweets = summaryTweets && summaryTweets.length > 0 ? summaryTweets : postedTweets;
  const totalImpressions = sourceTweets.reduce((sum, tweet) => sum + (tweet.actualImpressions ?? 0), 0);
  const totalEngagement = sourceTweets.reduce((sum, tweet) => sum + calcEngagement(tweet), 0);
  const avgEngagementRate = totalImpressions > 0 ? Number(((totalEngagement / totalImpressions) * 100).toFixed(2)) : 0;

  return {
    accountTweetCount,
    totalRadarPosts,
    totalImpressions,
    totalEngagement,
    avgEngagementRate,
    windowPostsTracked: postedTweets.length,
    windowRepliesTracked: replyTweets.length,
    avgImpressionsPerPost: computeAverageImpressions(postedTweets),
    avgImpressionsPerReply: computeAverageImpressions(replyTweets),
  };
}

export function buildAiSummary(params: {
  growthChart: AnalyticsGrowthPoint[];
  postedTweets: AnalyticsTweetRow[];
  replyTweets: AnalyticsTweetRow[];
}): AnalyticsSummaryInsights {
  const { growthChart, postedTweets, replyTweets } = params;
  const first = growthChart[0];
  const last = growthChart[growthChart.length - 1];
  const followerDelta = first && last ? last.followers - first.followers : 0;
  const growthPct =
    first && first.followers > 0 ? ((followerDelta / first.followers) * 100).toFixed(1) : "0.0";

  const hookBreakdown = derivePatternBreakdown(postedTweets, "hookType");
  const dominantHook =
    Object.entries(hookBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "question";

  const avgRate = (tweets: AnalyticsTweetRow[]) => {
    const totals = tweets.reduce(
      (acc, tweet) => {
        acc.engagement += calcEngagement(tweet);
        acc.impressions += tweet.actualImpressions ?? 0;
        return acc;
      },
      { engagement: 0, impressions: 0 }
    );
    if (totals.impressions <= 0) return 0;
    return totals.engagement / totals.impressions;
  };

  const threadTweets = postedTweets.filter((tweet) =>
    (tweet.format ?? "").toLowerCase().includes("thread")
  );
  const singleTweets = postedTweets.filter(
    (tweet) => !(tweet.format ?? "").toLowerCase().includes("thread")
  );
  const replyRate = avgRate(replyTweets);
  const threadRate = avgRate(threadTweets);
  const singleRate = avgRate(singleTweets);

  const confidence =
    postedTweets.length >= 15 ? "high" : postedTweets.length >= 6 ? "medium" : "low";

  if (replyTweets.length > 0 && replyRate > 0) {
    return {
      text: `Growth moved ${growthPct}% in this window. ${dominantHook} hooks are leading your post results, and replies are converting at ${(replyRate * 100).toFixed(1)}% engagement.`,
      confidence,
    };
  }

  if (threadRate > 0 && singleRate > 0) {
    return {
      text: `Growth moved ${growthPct}% in this window. ${dominantHook} hooks are leading results, and thread formats are performing ${(threadRate / singleRate).toFixed(1)}x better than single posts.`,
      confidence,
    };
  }

  return {
    text: `Growth moved ${growthPct}% in this window. ${dominantHook} hooks are leading results across your recently posted content.`,
    confidence,
  };
}
