import {
  buildAiSummary,
  buildSummary,
  computeAverageImpressions,
  derivePatternBreakdowns,
  deriveTopPostTypes,
  selectBestPerformingTweet,
  type AnalyticsTweetRow,
} from "@/lib/snipradar/analytics";

function makeTweet(overrides: Partial<AnalyticsTweetRow> = {}): AnalyticsTweetRow {
  return {
    id: overrides.id ?? "row-1",
    tweetId: overrides.tweetId ?? "tweet-1",
    tweetUrl: overrides.tweetUrl ?? "https://x.com/i/web/status/tweet-1",
    text: overrides.text ?? "test tweet",
    hookType: overrides.hookType ?? "question",
    format: overrides.format ?? "single post",
    emotionalTrigger: overrides.emotionalTrigger ?? "curiosity",
    viralPrediction: overrides.viralPrediction ?? 72,
    postType: overrides.postType ?? "post",
    postedAt: overrides.postedAt ?? "2026-02-20T12:00:00.000Z",
    actualLikes: overrides.actualLikes ?? 10,
    actualRetweets: overrides.actualRetweets ?? 5,
    actualReplies: overrides.actualReplies ?? 3,
    actualImpressions: overrides.actualImpressions ?? 100,
  };
}

describe("snipradar analytics helpers", () => {
  it("derives pattern breakdowns from creator-owned tweet rows", () => {
    const rows = [
      makeTweet({ id: "a", hookType: "question", format: "thread", emotionalTrigger: "curiosity" }),
      makeTweet({ id: "b", hookType: "question", format: "thread", emotionalTrigger: "curiosity" }),
      makeTweet({ id: "c", hookType: "contrarian", format: "single post", emotionalTrigger: "controversy" }),
    ];

    expect(derivePatternBreakdowns(rows)).toEqual({
      hookTypeBreakdown: { question: 2, contrarian: 1 },
      formatBreakdown: { thread: 2, "single post": 1 },
      emotionBreakdown: { curiosity: 2, controversy: 1 },
    });
  });

  it("orders top post types by average engagement rate", () => {
    const rows = [
      makeTweet({ id: "a", format: "thread", actualLikes: 20, actualRetweets: 10, actualReplies: 0, actualImpressions: 100 }),
      makeTweet({ id: "b", format: "thread", actualLikes: 15, actualRetweets: 5, actualReplies: 0, actualImpressions: 100 }),
      makeTweet({ id: "c", format: "single post", actualLikes: 5, actualRetweets: 0, actualReplies: 0, actualImpressions: 200 }),
    ];

    const result = deriveTopPostTypes(rows);
    expect(result[0]).toMatchObject({ label: "thread", posts: 2, avgRate: 25 });
    expect(result[1]).toMatchObject({ label: "single post", posts: 1, avgRate: 2.5 });
  });

  it("computes average impressions per row", () => {
    expect(
      computeAverageImpressions([
        makeTweet({ actualImpressions: 100 }),
        makeTweet({ id: "b", actualImpressions: 50 }),
        makeTweet({ id: "c", actualImpressions: 0 }),
      ])
    ).toBe(50);
  });

  it("selects the best performing tweet by engagement then impressions", () => {
    const best = selectBestPerformingTweet([
      makeTweet({ id: "a", actualLikes: 10, actualRetweets: 0, actualReplies: 0, actualImpressions: 200 }),
      makeTweet({ id: "b", actualLikes: 8, actualRetweets: 2, actualReplies: 0, actualImpressions: 500 }),
      makeTweet({ id: "c", actualLikes: 20, actualRetweets: 1, actualReplies: 0, actualImpressions: 100 }),
    ]);

    expect(best?.id).toBe("c");
  });

  it("builds a trustworthy window summary from post and reply rows", () => {
    const summary = buildSummary({
      accountTweetCount: 999,
      totalRadarPosts: 12,
      postedTweets: [
        makeTweet({ actualLikes: 10, actualRetweets: 5, actualReplies: 5, actualImpressions: 100 }),
        makeTweet({ id: "b", actualLikes: 4, actualRetweets: 1, actualReplies: 0, actualImpressions: 50 }),
      ],
      replyTweets: [
        makeTweet({ id: "r1", postType: "reply", actualLikes: 1, actualRetweets: 0, actualReplies: 1, actualImpressions: 20 }),
      ],
    });

    expect(summary).toMatchObject({
      accountTweetCount: 999,
      totalRadarPosts: 12,
      totalImpressions: 150,
      totalEngagement: 25,
      avgEngagementRate: 16.67,
      windowPostsTracked: 2,
      windowRepliesTracked: 1,
      avgImpressionsPerPost: 75,
      avgImpressionsPerReply: 20,
    });
  });

  it("builds reply-aware AI summary copy and confidence", () => {
    const summary = buildAiSummary({
      growthChart: [
        { date: "2026-02-18", followers: 100, following: 50, tweets: 10, growth: 0 },
        { date: "2026-02-21", followers: 130, following: 50, tweets: 15, growth: 30 },
      ],
      postedTweets: Array.from({ length: 6 }, (_, index) =>
        makeTweet({
          id: `p-${index}`,
          hookType: "contrarian",
          format: index < 3 ? "thread" : "single post",
          actualLikes: 12,
          actualRetweets: 6,
          actualReplies: 2,
          actualImpressions: 100,
        })
      ),
      replyTweets: [
        makeTweet({
          id: "reply-1",
          postType: "reply",
          actualLikes: 5,
          actualRetweets: 1,
          actualReplies: 0,
          actualImpressions: 20,
        }),
      ],
    });

    expect(summary.confidence).toBe("medium");
    expect(summary.text).toContain("contrarian");
    expect(summary.text).toContain("replies are converting");
  });
});
