"use client";

import { Users, TrendingUp, Send, BarChart3, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface GrowthStatsProps {
  followerCount: number;
  followerGrowth7d: number;
  tweetsPosted: number;
  actualTweetCount: number;
  avgEngagementRate: number;
  avgImpressionsPerPost: number;
  periodDays: 7 | 30;
  onPeriodChange: (period: 7 | 30) => void;
  impressionsTrend: Array<{ date: string; impressions: number }>;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (num >= 1_000) {
    const val = num / 1_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K`;
  }
  return num.toLocaleString();
}

export function GrowthStats({
  followerCount,
  followerGrowth7d,
  tweetsPosted,
  actualTweetCount,
  avgEngagementRate,
  avgImpressionsPerPost,
  periodDays,
  onPeriodChange,
  impressionsTrend,
}: GrowthStatsProps) {
  const maxImpressions = impressionsTrend.reduce(
    (max, point) => Math.max(max, point.impressions),
    1
  );

  const positiveGrowth = followerGrowth7d >= 0;

  const stats = [
    {
      label: "Followers",
      value: formatNumber(followerCount),
      sub: "current",
      icon: Users,
      accentColor: "text-violet-600 dark:text-violet-400",
      accentBg: "bg-violet-100 dark:bg-violet-500/10",
      borderColor: "border-l-violet-500",
      trend: null as number | null,
      showChart: false,
    },
    {
      label: `Growth (${periodDays}d)`,
      value: `${positiveGrowth ? "+" : ""}${formatNumber(followerGrowth7d)}`,
      sub: `last ${periodDays} days`,
      icon: TrendingUp,
      accentColor: positiveGrowth ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
      accentBg: positiveGrowth ? "bg-emerald-100 dark:bg-emerald-500/10" : "bg-red-100 dark:bg-red-500/10",
      borderColor: positiveGrowth ? "border-l-emerald-500" : "border-l-red-500",
      trend: followerGrowth7d,
      showChart: false,
    },
    {
      label: "Tweets Posted",
      value: formatNumber(actualTweetCount),
      sub: tweetsPosted > 0 ? `${tweetsPosted} via SnipRadar` : "total on X",
      icon: Send,
      accentColor: "text-blue-600 dark:text-blue-400",
      accentBg: "bg-blue-100 dark:bg-blue-500/10",
      borderColor: "border-l-blue-500",
      trend: null as number | null,
      showChart: false,
    },
    {
      label: "Avg Impressions",
      value: formatNumber(avgImpressionsPerPost),
      sub: "per posted tweet",
      icon: Eye,
      accentColor: "text-cyan-600 dark:text-cyan-400",
      accentBg: "bg-cyan-100 dark:bg-cyan-500/10",
      borderColor: "border-l-cyan-500",
      trend: null as number | null,
      showChart: true,
    },
    {
      label: "Avg Engagement",
      value: `${avgEngagementRate}%`,
      sub: "engagement rate",
      icon: BarChart3,
      accentColor: "text-amber-600 dark:text-amber-400",
      accentBg: "bg-amber-100 dark:bg-amber-500/10",
      borderColor: "border-l-amber-500",
      trend: null as number | null,
      showChart: false,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Section header with inline period toggle */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/50">
          Growth Overview
        </p>
        <div className="flex items-center gap-0.5 rounded-lg border border-border dark:border-white/[0.07] bg-muted/50 dark:bg-white/[0.03] p-0.5">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onPeriodChange(d)}
              className={cn(
                "rounded-md px-3 py-1 text-[11px] font-semibold transition-all",
                periodDays === d
                  ? "bg-background dark:bg-white/10 text-foreground dark:text-white shadow-sm"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border dark:border-white/[0.07] border-l-2 bg-gradient-to-br from-muted/60 dark:from-white/[0.04] to-transparent p-4 transition-all hover:border-border/80 dark:hover:border-white/15 hover:from-muted/80 dark:hover:from-white/[0.06]",
              stat.borderColor
            )}
          >
            {/* Top row: label + icon */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60">
                {stat.label}
              </span>
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", stat.accentBg)}>
                <stat.icon className={cn("h-3.5 w-3.5", stat.accentColor)} />
              </div>
            </div>

            {/* Value row */}
            <div className="flex items-end gap-1 mb-0.5">
              <span className={cn("text-2xl font-bold tracking-tight tabular-nums", stat.accentColor)}>
                {stat.value}
              </span>
              {stat.trend !== null && stat.trend !== 0 && (
                <span
                  className={cn(
                    "mb-0.5 flex items-center text-[11px] font-semibold",
                    stat.trend > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}
                >
                  {stat.trend > 0 ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/60 dark:text-muted-foreground/40">{stat.sub}</p>

            {/* Mini sparkline (impressions card only) */}
            {stat.showChart && impressionsTrend.length > 0 && (
              <div className="mt-3 flex h-5 items-end gap-px">
                {impressionsTrend.map((point, i) => {
                  const height = Math.max(2, (point.impressions / maxImpressions) * 20);
                  return (
                    <div
                      key={`${point.date}-${i}`}
                      className="flex-1 rounded-sm bg-cyan-500/60 dark:bg-cyan-500/35 hover:bg-cyan-500/80 dark:hover:bg-cyan-500/60 transition-colors cursor-default"
                      style={{ height }}
                      title={`${point.date}: ${point.impressions.toLocaleString()}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
