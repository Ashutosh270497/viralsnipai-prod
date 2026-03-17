"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, TableProperties, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";

interface PostedTweet {
  id: string;
  tweetId?: string | null;
  tweetUrl?: string | null;
  text: string;
  hookType: string | null;
  format: string | null;
  emotionalTrigger: string | null;
  viralPrediction: number | null;
  postType?: "post" | "reply";
  postedAt: string | null;
  actualLikes: number | null;
  actualRetweets: number | null;
  actualReplies: number | null;
  actualImpressions: number | null;
}

type SortField = "postedAt" | "likes" | "impressions" | "engagement";
type PerformanceType = "post" | "reply";

export function PostPerformanceTable({
  tweets,
  replyTweets = [],
}: {
  tweets: PostedTweet[];
  replyTweets?: PostedTweet[];
}) {
  const [sortBy, setSortBy] = useState<SortField>("postedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [performanceType, setPerformanceType] = useState<PerformanceType>("post");

  function getEngagement(t: PostedTweet) {
    return (t.actualLikes ?? 0) + (t.actualRetweets ?? 0) + (t.actualReplies ?? 0);
  }

  function getEngagementRate(t: PostedTweet) {
    const imp = t.actualImpressions ?? 0;
    if (imp === 0) return 0;
    return (getEngagement(t) / imp) * 100;
  }

  const baseTweets = useMemo(
    () => (performanceType === "post" ? tweets : replyTweets),
    [performanceType, tweets, replyTweets]
  );

  const filteredTweets = useMemo(() => {
    if (!fromDate && !toDate) return baseTweets;
    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const end = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
    return baseTweets.filter((tweet) => {
      if (!tweet.postedAt) return false;
      const postedAt = new Date(tweet.postedAt);
      if (Number.isNaN(postedAt.getTime())) return false;
      if (start && postedAt < start) return false;
      if (end && postedAt > end) return false;
      return true;
    });
  }, [baseTweets, fromDate, toDate]);

  const sorted = [...filteredTweets].sort((a, b) => {
    let av: number, bv: number;
    switch (sortBy) {
      case "likes":
        av = a.actualLikes ?? 0; bv = b.actualLikes ?? 0; break;
      case "impressions":
        av = a.actualImpressions ?? 0; bv = b.actualImpressions ?? 0; break;
      case "engagement":
        av = getEngagementRate(a); bv = getEngagementRate(b); break;
      default:
        av = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        bv = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    }
    return sortDir === "desc" ? bv - av : av - bv;
  });

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  const hasFilters = Boolean(fromDate || toDate);

  if (tweets.length === 0 && replyTweets.length === 0) {
    return (
      <SnipRadarEmptyState
        icon={TableProperties}
        eyebrow="Analytics"
        title="Post performance will populate after the first live publish"
        description="SnipRadar only shows trusted post and reply metrics after content has been published and live engagement has started landing."
        hint="Post a few drafts from SnipRadar to unlock date filters, post/reply breakdowns, and reliable engagement-rate comparisons."
        primaryAction={{ label: "Open Publish", href: "/snipradar/publish" }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 dark:border-white/[0.07] bg-gradient-to-br from-muted/30 dark:from-white/[0.03] to-transparent overflow-hidden">
      {/* Header + filters */}
      <div className="px-5 py-4 border-b border-border/40 dark:border-white/[0.06]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Title */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15">
              <TableProperties className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                Post Performance
              </p>
              <p className="text-[11px] text-muted-foreground/50">
                {sorted.length} of {baseTweets.length}{" "}
                {performanceType === "post" ? "posts" : "replies"}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type dropdown */}
            <Select
              value={performanceType}
              onValueChange={(value) => setPerformanceType(value as PerformanceType)}
            >
              <SelectTrigger className="h-8 w-[120px] rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-2.5 text-[11px] text-foreground/80 focus:ring-1 focus:ring-amber-500/40 focus:ring-offset-0">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent
                position="item-aligned"
                className="rounded-xl border border-border/60 dark:border-white/[0.08] bg-popover dark:bg-[#0f1117] text-sm shadow-xl"
              >
                <SelectItem
                  value="post"
                  className="text-[12px] rounded-lg cursor-pointer pl-3 focus:bg-muted/50 dark:bg-white/[0.06] focus:text-white data-[state=checked]:bg-amber-500/10 data-[state=checked]:text-amber-400"
                >
                  Posts
                </SelectItem>
                <SelectItem
                  value="reply"
                  className="text-[12px] rounded-lg cursor-pointer pl-3 focus:bg-muted/50 dark:bg-white/[0.06] focus:text-white data-[state=checked]:bg-amber-500/10 data-[state=checked]:text-amber-400"
                >
                  Replies
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
              className="h-8 rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-2.5 text-[11px] text-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40 transition-colors"
              aria-label="From date"
            />
            <span className="text-[11px] text-muted-foreground/40">–</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
              className="h-8 rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-2.5 text-[11px] text-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40 transition-colors"
              aria-label="To date"
            />
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setFromDate(""); setToDate(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 dark:bg-white/[0.07] transition-colors"
                aria-label="Clear date filters"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="px-5 py-5">
          <SnipRadarEmptyState
            icon={TableProperties}
            eyebrow="Filtered"
            title={`No ${performanceType === "post" ? "posts" : "replies"} match this date window`}
            description="Your underlying performance history is intact. The current date filter just narrows the window down to zero results."
            hint="Adjust the start or end date to expand the analysis window."
            primaryAction={{
              label: "Clear filters",
              onClick: () => {
                setFromDate("");
                setToDate("");
              },
            }}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 dark:border-white/[0.05]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Tweet
                </th>
                {(
                  [
                    { field: "postedAt", label: "Date" },
                    { field: "likes", label: "Likes" },
                    { field: "impressions", label: "Impr." },
                    { field: "engagement", label: "Eng. Rate" },
                  ] as { field: SortField; label: string }[]
                ).map(({ field, label }) => (
                  <th key={field} className="px-3 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort(field)}
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest transition-colors",
                        sortBy === field
                          ? "text-amber-400"
                          : "text-muted-foreground/40 hover:text-muted-foreground"
                      )}
                    >
                      {label}
                      <ArrowUpDown className="h-3 w-3 shrink-0" />
                    </button>
                  </th>
                ))}
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Predicted
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tweet) => {
                const engRate = getEngagementRate(tweet);
                const isHighEng = engRate >= 3;
                const isMedEng = engRate >= 1 && engRate < 3;
                const destinationUrl =
                  tweet.tweetUrl ?? (tweet.tweetId ? `https://x.com/i/web/status/${tweet.tweetId}` : null);

                return (
                  <tr
                    key={tweet.id}
                    className="border-b border-border/25 dark:border-white/[0.04] last:border-0 hover:bg-muted/25 dark:bg-white/[0.025] transition-colors"
                  >
                    {/* Tweet text + tags */}
                    <td className="max-w-[280px] px-5 py-3.5">
                      {destinationUrl ? (
                        <a
                          href={destinationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-2 text-xs leading-relaxed text-foreground/75 underline-offset-4 hover:text-primary hover:underline"
                          title="Open on X"
                        >
                          {tweet.text}
                        </a>
                      ) : (
                        <p className="line-clamp-2 text-xs leading-relaxed text-foreground/75">
                          {tweet.text}
                        </p>
                      )}
                      {(tweet.hookType || tweet.format) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tweet.hookType && (
                            <span className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                              {tweet.hookType}
                            </span>
                          )}
                          {tweet.format && (
                            <span className="inline-flex items-center rounded-md border border-violet-500/20 bg-violet-500/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                              {tweet.format}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-3 py-3.5 text-xs text-muted-foreground/50">
                      {tweet.postedAt
                        ? new Date(tweet.postedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>

                    {/* Likes */}
                    <td className="px-3 py-3.5 text-xs tabular-nums text-foreground/70">
                      {(tweet.actualLikes ?? 0).toLocaleString()}
                    </td>

                    {/* Impressions */}
                    <td className="px-3 py-3.5 text-xs tabular-nums text-foreground/70">
                      {(tweet.actualImpressions ?? 0).toLocaleString()}
                    </td>

                    {/* Eng rate pill */}
                    <td className="px-3 py-3.5">
                      {engRate > 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                            isHighEng
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : isMedEng
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-muted/50 dark:bg-white/[0.05] text-muted-foreground/50 border border-border/40 dark:border-white/[0.06]"
                          )}
                        >
                          {isHighEng ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : isMedEng ? null : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {engRate.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Viral prediction */}
                    <td className="px-3 py-3.5 text-xs tabular-nums text-muted-foreground/40">
                      {tweet.viralPrediction != null ? tweet.viralPrediction : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
