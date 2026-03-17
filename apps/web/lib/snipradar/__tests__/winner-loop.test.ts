import { buildRepostScheduleDate, detectWinnerPosts } from "@/lib/snipradar/winner-loop";
import type { AnalyticsTweetRow } from "@/lib/snipradar/analytics";

function makePostedTweet(overrides: Partial<AnalyticsTweetRow> = {}): AnalyticsTweetRow {
  return {
    id: overrides.id ?? "draft-1",
    tweetId: overrides.tweetId ?? "tweet-1",
    tweetUrl: overrides.tweetUrl ?? "https://x.com/i/web/status/tweet-1",
    text: overrides.text ?? "Test winner candidate",
    hookType: overrides.hookType ?? "contrarian",
    format: overrides.format ?? "single post",
    emotionalTrigger: overrides.emotionalTrigger ?? "curiosity",
    viralPrediction: overrides.viralPrediction ?? 72,
    postType: "post",
    postedAt: overrides.postedAt ?? "2026-03-01T12:00:00.000Z",
    actualLikes: overrides.actualLikes ?? 12,
    actualRetweets: overrides.actualRetweets ?? 4,
    actualReplies: overrides.actualReplies ?? 3,
    actualImpressions: overrides.actualImpressions ?? 180,
  };
}

describe("winner loop helpers", () => {
  it("detects standout winners relative to the posting baseline", () => {
    const result = detectWinnerPosts([
      makePostedTweet({ id: "a", actualImpressions: 180, actualLikes: 12, actualRetweets: 4, actualReplies: 3 }),
      makePostedTweet({ id: "b", actualImpressions: 160, actualLikes: 10, actualRetweets: 2, actualReplies: 2 }),
      makePostedTweet({
        id: "winner",
        text: "Winning post",
        actualImpressions: 420,
        actualLikes: 38,
        actualRetweets: 12,
        actualReplies: 14,
      }),
    ]);

    expect(result.winners[0]?.id).toBe("winner");
    expect(result.winners[0]?.whyWon.length).toBeGreaterThan(0);
    expect(result.winners[0]?.recommendedActions.length).toBeGreaterThan(0);
  });

  it("builds a repost schedule at least 10 days in the future", () => {
    const scheduled = buildRepostScheduleDate(new Date());
    const diffMs = scheduled.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(9 * 24 * 60 * 60 * 1000);
  });
});
