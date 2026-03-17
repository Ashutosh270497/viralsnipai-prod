import { addDays } from "date-fns";

import { calcEngagement, calcEngagementRate, computeAverageImpressions, type AnalyticsTweetRow } from "@/lib/snipradar/analytics";

export type WinnerAutomationAction = "expand_thread" | "repost_variant" | "spin_off_post";

export type WinnerCandidate = {
  id: string;
  tweetId: string | null;
  tweetUrl: string | null;
  text: string;
  hookType: string | null;
  format: string | null;
  emotionalTrigger: string | null;
  postedAt: string | null;
  actualLikes: number;
  actualRetweets: number;
  actualReplies: number;
  actualImpressions: number;
  engagementRate: number;
  winnerScore: number;
  whyWon: string[];
  recommendedActions: Array<{
    id: WinnerAutomationAction;
    label: string;
    description: string;
  }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value, 1, 100));
}

function describeActions(tweet: WinnerCandidate): WinnerCandidate["recommendedActions"] {
  const actions: WinnerCandidate["recommendedActions"] = [];

  actions.push({
    id: "spin_off_post",
    label: "Spin-off post",
    description: "Turn the same insight into a fresh single post with a new angle.",
  });

  if (!tweet.format?.toLowerCase().includes("thread")) {
    actions.push({
      id: "expand_thread",
      label: "Expand to thread",
      description: "Break the winning idea into a short 3-part thread.",
    });
  }

  actions.push({
    id: "repost_variant",
    label: "Queue repost variant",
    description: "Schedule a rewritten version with a cooled-down hook for later reuse.",
  });

  return actions;
}

export function detectWinnerPosts(postedTweets: AnalyticsTweetRow[]) {
  const rows = postedTweets.filter((tweet) => (tweet.actualImpressions ?? 0) > 0);
  if (rows.length === 0) {
    return {
      winners: [] as WinnerCandidate[],
      summary: "No posted drafts with live metrics yet.",
      baseline: {
        avgImpressions: 0,
        avgEngagementRate: 0,
      },
    };
  }

  const avgImpressions = computeAverageImpressions(rows);
  const avgEngagementRate =
    rows.reduce((sum, tweet) => sum + calcEngagementRate(tweet), 0) / Math.max(1, rows.length);

  const winners = rows
    .map((tweet) => {
      const impressions = tweet.actualImpressions ?? 0;
      const engagementRate = Number(calcEngagementRate(tweet).toFixed(2));
      const engagement = calcEngagement(tweet);
      const impressionRatio = avgImpressions > 0 ? impressions / avgImpressions : 1;
      const engagementRateRatio = avgEngagementRate > 0 ? engagementRate / avgEngagementRate : 1;
      const replyBoost = (tweet.actualReplies ?? 0) >= 10 ? 6 : (tweet.actualReplies ?? 0) >= 5 ? 3 : 0;
      const shareBoost = (tweet.actualRetweets ?? 0) >= 5 ? 5 : (tweet.actualRetweets ?? 0) >= 2 ? 2 : 0;

      const winnerScore = roundScore(
        30 +
          clamp((impressionRatio - 1) * 26, 0, 28) +
          clamp((engagementRateRatio - 1) * 24, 0, 24) +
          clamp(engagement / 12, 0, 12) +
          replyBoost +
          shareBoost
      );

      const whyWon: string[] = [];
      if (impressionRatio >= 1.35) {
        whyWon.push(`${impressionRatio.toFixed(1)}x avg impressions`);
      }
      if (engagementRateRatio >= 1.2) {
        whyWon.push(`${engagementRateRatio.toFixed(1)}x avg engagement rate`);
      }
      if ((tweet.actualReplies ?? 0) >= 5) {
        whyWon.push(`${tweet.actualReplies} replies`);
      }
      if ((tweet.actualRetweets ?? 0) >= 3) {
        whyWon.push(`${tweet.actualRetweets} reposts`);
      }

      const candidate: WinnerCandidate = {
        id: tweet.id,
        tweetId: tweet.tweetId,
        tweetUrl: tweet.tweetUrl,
        text: tweet.text,
        hookType: tweet.hookType,
        format: tweet.format,
        emotionalTrigger: tweet.emotionalTrigger,
        postedAt: tweet.postedAt,
        actualLikes: tweet.actualLikes ?? 0,
        actualRetweets: tweet.actualRetweets ?? 0,
        actualReplies: tweet.actualReplies ?? 0,
        actualImpressions: impressions,
        engagementRate,
        winnerScore,
        whyWon: whyWon.slice(0, 3),
        recommendedActions: [],
      };

      candidate.recommendedActions = describeActions(candidate);
      return candidate;
    })
    .filter((tweet) => tweet.winnerScore >= 58)
    .sort((left, right) => right.winnerScore - left.winnerScore || right.actualImpressions - left.actualImpressions)
    .slice(0, 5);

  return {
    winners,
    summary:
      winners.length > 0
        ? `${winners.length} winner${winners.length > 1 ? "s" : ""} detected from the last ${rows.length} posted drafts.`
        : "No standout winners detected yet. More posted drafts with metrics are needed.",
    baseline: {
      avgImpressions,
      avgEngagementRate: Number(avgEngagementRate.toFixed(2)),
    },
  };
}

export function buildRepostScheduleDate(postedAt: Date | null) {
  const now = new Date();
  const minimum = addDays(now, 10);
  if (!postedAt) return addDays(now, 14);
  const cooldown = addDays(postedAt, 14);
  return cooldown > minimum ? cooldown : minimum;
}
