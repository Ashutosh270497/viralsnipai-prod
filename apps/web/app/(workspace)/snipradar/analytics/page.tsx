"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Clock,
  Eye,
  Heart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { FollowerGrowthChart } from "@/components/snipradar/analytics/follower-growth-chart";
import { EngagementHeatmap } from "@/components/snipradar/analytics/engagement-heatmap";
import { PostPerformanceTable } from "@/components/snipradar/analytics/post-performance-table";
import { PatternBreakdown } from "@/components/snipradar/analytics/pattern-breakdown";
import {
  SchedulerOpsPanel,
  type SchedulerRunsOpsPayload,
} from "@/components/snipradar/analytics/scheduler-ops-panel";
import { WinnerLoopPanel } from "@/components/snipradar/winner-loop-panel";
import { parseServerTimingMs } from "@/lib/server-timing";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";
import { useBillingSubscriptionState } from "@/hooks/use-billing-subscription";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import { cn } from "@/lib/utils";
import {
  deriveSnipRadarRecoveryState,
  parseSnipRadarApiError,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";
import {
  getAnalyticsWindowDaysFromState,
  getSnipRadarBillingGateDetails,
} from "@/lib/snipradar/billing-gates";
import {
  type AnalyticsGrowthPoint,
  type AnalyticsSummary,
  type AnalyticsSummaryInsights,
  type AnalyticsTweetRow,
  type PostTypePerformance,
} from "@/lib/snipradar/analytics";

interface MetricsData {
  periodDays: number;
  auth?: {
    reauthRequired: boolean;
    message: string | null;
    refreshedToken: boolean;
  };
  summary: AnalyticsSummary;
  growthChart: AnalyticsGrowthPoint[];
  postedTweets: AnalyticsTweetRow[];
  replyTweets: AnalyticsTweetRow[];
  sources?: {
    summary: "live_x" | "db_posted_drafts" | "none";
    posts: "live_x" | "db_posted_drafts" | "none";
    replies: "live_x" | "none";
    summarySampleSize: number;
    livePostsSampleSize: number;
    liveRepliesSampleSize: number;
    patternSource: "live_x_posts" | "db_posted_drafts" | "none";
  };
  aiSummary: AnalyticsSummaryInsights;
  topPostTypes: PostTypePerformance[];
  bestPerforming: {
    id: string;
    tweetId: string | null;
    tweetUrl: string | null;
    text: string;
    actualLikes: number | null;
    actualRetweets: number | null;
    actualReplies: number | null;
    actualImpressions: number | null;
  } | null;
  hookTypeBreakdown: Record<string, number>;
  formatBreakdown: Record<string, number>;
  emotionBreakdown: Record<string, number>;
}

interface HealthData {
  scheduler: {
    recentRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRatePct: number;
    avgDurationMs: number;
    consecutiveFailures: number;
    lastRunAt: string | null;
  };
  engagement: {
    counts: {
      all: number;
      new: number;
      saved: number;
      replied: number;
      ignored: number;
    };
    staleCount: number;
  };
  queue: {
    scheduledDrafts: number;
  };
  account: {
    connected: boolean;
  };
}

export default function SnipRadarAnalyticsPage() {
  const flags = useFeatureFlags();
  const [periodDays, setPeriodDays] = useState<7 | 30>(30);
  const [metricsLatencyMs, setMetricsLatencyMs] = useState<number | null>(null);
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null);
  const billingQuery = useBillingSubscriptionState();
  const analyticsWindowDays = billingQuery.data
    ? getAnalyticsWindowDaysFromState(billingQuery.data)
    : 30;

  useEffect(() => {
    if (analyticsWindowDays === 7 && periodDays !== 7) {
      setPeriodDays(7);
    }
  }, [analyticsWindowDays, periodDays]);

  const {
    data,
    isLoading,
    error,
    refetch: refetchMetrics,
    isRefetching: metricsRefetching,
  } = useQuery<MetricsData>({
    queryKey: ["snipradar-metrics", periodDays],
    queryFn: async () => {
      const res = await fetch(`/api/snipradar/metrics?periodDays=${periodDays}`);
      const timing = parseServerTimingMs(res.headers.get("Server-Timing"));
      if (typeof timing === "number") setMetricsLatencyMs(Math.round(timing));
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to fetch metrics");
      }
      return res.json();
    },
    staleTime: 60_000,
    enabled: analyticsWindowDays > 0,
  });

  const {
    data: health,
    error: healthError,
    refetch: refetchHealth,
    isRefetching: healthRefetching,
  } = useQuery<HealthData>({
    queryKey: ["snipradar-health"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/health");
      const timing = parseServerTimingMs(res.headers.get("Server-Timing"));
      if (typeof timing === "number") setHealthLatencyMs(Math.round(timing));
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to fetch health");
      }
      return res.json();
    },
    staleTime: 30_000,
    enabled: analyticsWindowDays > 0,
  });

  const schedulerRunsQuery = useQuery<SchedulerRunsOpsPayload>({
    queryKey: ["snipradar-scheduler-runs-ops"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/scheduled/runs?limit=30&windowHours=72");
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to fetch scheduler operations");
      }
      return res.json();
    },
    staleTime: 45_000,
    refetchOnWindowFocus: false,
    enabled: analyticsWindowDays > 0,
  });

  const analyticsGateDetails = getSnipRadarBillingGateDetails(
    error ? toSnipRadarApiError(error, "Failed to load analytics") : null
  );

  if (billingQuery.isLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[340px]" />
          <Skeleton className="h-[340px]" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (analyticsWindowDays === 0 && billingQuery.data) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <SnipRadarBillingGateCard
          details={{
            kind: "upgrade_required",
            feature: "analytics",
            currentPlan: billingQuery.data.plan.id,
            requiredPlan: "pro",
            upgradePlan: "pro",
            analyticsWindowDays: 0,
          }}
        />
      </div>
    );
  }

  if (error) {
    const apiError = toSnipRadarApiError(error, "Failed to load analytics");
    const recovery = deriveSnipRadarRecoveryState(apiError);

    if (analyticsGateDetails) {
      return (
        <div className="space-y-5">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <SnipRadarBillingGateCard details={analyticsGateDetails} />
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="space-y-4 rounded-2xl border border-border/50 dark:border-white/[0.07] bg-muted/20 dark:bg-white/[0.02] p-8 text-center">
          <div className="space-y-1">
            <p className="text-sm font-medium">{recovery?.title ?? "Failed to load analytics"}</p>
            <p className="text-sm text-muted-foreground/70">
              {recovery?.message ?? "Please try again."}
            </p>
            {recovery?.code ? (
              <p className="text-xs text-muted-foreground/60">Error code: {recovery.code}</p>
            ) : null}
          </div>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                void refetchMetrics();
                void refetchHealth();
              }}
              disabled={metricsRefetching || healthRefetching}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {recovery?.actionLabel ?? "Retry"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalEngagement = data.summary.totalEngagement;
  const totalImpressions = data.summary.totalImpressions;
  const avgEngRate = data.summary.avgEngagementRate.toFixed(2);
  const topPostTypes = data.topPostTypes;
  const aiSummary = data.aiSummary;

  const confidenceColor =
    aiSummary.confidence === "high"
      ? "text-emerald-600 dark:text-emerald-400 border-emerald-400 dark:border-emerald-500/30 bg-emerald-100 dark:bg-emerald-500/10"
      : aiSummary.confidence === "medium"
      ? "text-amber-600 dark:text-amber-400 border-amber-400 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10"
      : "text-muted-foreground/70 dark:text-muted-foreground/60 border-border/60 dark:border-white/10 bg-muted/60 dark:bg-white/[0.04]";

  const schedulerOk = (health?.scheduler.successRatePct ?? 100) >= 90;
  const dataSourceLabel =
    data.sources?.summary === "live_x"
      ? "Live X metrics"
      : data.sources?.summary === "db_posted_drafts"
        ? "DB fallback metrics"
        : "No metrics source yet";

  return (
    <div className="space-y-6 pb-10">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shrink-0">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground/60 mt-0.5">
              Growth and post performance over the last {periodDays} days
            </p>
          </div>
        </div>

        {/* Period toggle pill */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border dark:border-white/[0.07] bg-muted/50 dark:bg-white/[0.03] p-0.5">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={d > analyticsWindowDays}
              onClick={() => {
                trackSnipRadarEvent("snipradar_analytics_period_change", { periodDays: d });
                setPeriodDays(d);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40",
                periodDays === d
                  ? "bg-background dark:bg-white/10 text-foreground dark:text-white shadow-sm"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border px-2 py-1">{dataSourceLabel}</span>
        {data.auth?.reauthRequired ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-300">
            {data.auth.message ?? "Reconnect X to restore live metrics"}
          </span>
        ) : null}
        {data.sources ? (
          <span>
            posts: {data.sources.posts} ({data.sources.livePostsSampleSize}) · replies:{" "}
            {data.sources.replies} ({data.sources.liveRepliesSampleSize}) · summary sample:{" "}
            {data.sources.summarySampleSize} · patterns: {data.sources.patternSource}
          </span>
        ) : null}
        {healthError ? (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300">
            {deriveSnipRadarRecoveryState(healthError)?.message ?? "Health feed unavailable"}
          </span>
        ) : null}
      </div>

      {/* ── AI Summary ───────────────────────────────────────────────── */}
      {flags.snipRadarAnalyticsV2Enabled && (
        <div className="relative overflow-hidden rounded-2xl border border-purple-300 dark:border-purple-500/20 bg-gradient-to-br from-purple-50 dark:from-purple-500/[0.07] to-transparent p-5">
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="flex flex-wrap items-start gap-3 relative">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-500/15 shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-sm font-semibold">AI Summary</p>
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold",
                  confidenceColor
                )}>
                  {aiSummary.confidence} confidence
                </span>
              </div>
              <p className="text-sm text-muted-foreground/80 leading-relaxed">{aiSummary.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary metric cards ─────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/70 dark:text-muted-foreground/50 mb-3">
          Period Summary
        </p>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            {
              label: "Posts Tracked",
              value: data.summary.windowPostsTracked.toLocaleString(),
              sub: `${data.sources?.posts === "live_x" ? "live X window" : "draft fallback"} · ${data.summary.totalRadarPosts} via SnipRadar`,
              icon: TrendingUp,
              accentColor: "text-violet-600 dark:text-violet-400",
              accentBg: "bg-violet-100 dark:bg-violet-500/10",
              borderColor: "border-l-violet-500",
            },
            {
              label: "Replies Tracked",
              value: data.summary.windowRepliesTracked.toLocaleString(),
              sub: `${data.sources?.replies === "live_x" ? "live X replies" : "no live replies yet"}`,
              icon: Users,
              accentColor: "text-cyan-600 dark:text-cyan-400",
              accentBg: "bg-cyan-100 dark:bg-cyan-500/10",
              borderColor: "border-l-cyan-500",
            },
            {
              label: "Total Impressions",
              value: totalImpressions.toLocaleString(),
              sub: `${data.summary.avgImpressionsPerPost.toLocaleString()} avg / post`,
              icon: Eye,
              accentColor: "text-pink-600 dark:text-pink-400",
              accentBg: "bg-pink-100 dark:bg-pink-500/10",
              borderColor: "border-l-pink-500",
            },
            {
              label: "Avg Eng. Rate",
              value: `${avgEngRate}%`,
              sub: `${totalEngagement.toLocaleString()} engagements in ${periodDays}d`,
              icon: Activity,
              accentColor: "text-amber-600 dark:text-amber-400",
              accentBg: "bg-amber-100 dark:bg-amber-500/10",
              borderColor: "border-l-amber-500",
            },
          ].map((card) => (
            <div
              key={card.label}
              className={cn(
                "relative overflow-hidden rounded-xl border border-border dark:border-white/[0.07] border-l-2 bg-gradient-to-br from-muted/60 dark:from-white/[0.04] to-transparent p-4 transition-all hover:from-muted/80 dark:hover:from-white/[0.06]",
                card.borderColor
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60">{card.label}</span>
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", card.accentBg)}>
                  <card.icon className={cn("h-3.5 w-3.5", card.accentColor)} />
                </div>
              </div>
              <p className={cn("text-2xl font-bold tracking-tight tabular-nums mb-0.5", card.accentColor)}>
                {card.value}
              </p>
              <p className="text-[11px] text-muted-foreground/60 dark:text-muted-foreground/40">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {flags.winnerLoopEnabled && <WinnerLoopPanel mode="analytics" />}

      {/* ── System Health ────────────────────────────────────────────── */}
      {health && (
        <div className="rounded-2xl border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg",
                schedulerOk ? "bg-emerald-100 dark:bg-emerald-500/15" : "bg-amber-100 dark:bg-amber-500/15"
              )}>
                <ShieldCheck className={cn("h-4 w-4", schedulerOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")} />
              </div>
              <span className="text-sm font-semibold">System Health</span>
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                schedulerOk
                  ? "text-emerald-600 dark:text-emerald-400 border-emerald-400 dark:border-emerald-500/25 bg-emerald-100 dark:bg-emerald-500/10"
                  : "text-amber-600 dark:text-amber-400 border-amber-400 dark:border-amber-500/25 bg-amber-100 dark:bg-amber-500/10"
              )}>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  schedulerOk ? "bg-emerald-500" : "bg-amber-500"
                )} />
                {schedulerOk ? "Healthy" : "Degraded"}
              </span>
            </div>
            {(metricsLatencyMs !== null || healthLatencyMs !== null) && (
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 dark:text-muted-foreground/30">
                {metricsLatencyMs !== null && <span>metrics {metricsLatencyMs}ms</span>}
                {healthLatencyMs !== null && <span>health {healthLatencyMs}ms</span>}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {(
              [
                {
                  label: "Scheduler Success",
                  value: `${health.scheduler.successRatePct}%`,
                  sub: `${health.scheduler.failedRuns} failed / ${health.scheduler.recentRuns} runs`,
                  icon: Zap,
                  accent: health.scheduler.successRatePct >= 90 ? "emerald" : "amber",
                },
                {
                  label: "Avg Runtime",
                  value: `${health.scheduler.avgDurationMs}ms`,
                  sub: `${health.scheduler.consecutiveFailures} consecutive failures`,
                  icon: Clock,
                  accent: health.scheduler.consecutiveFailures === 0 ? "emerald" : "red",
                },
                {
                  label: "Engagement Queue",
                  value: `${health.engagement.counts.new} new`,
                  sub: `${health.engagement.staleCount} stale opportunities`,
                  icon: Users,
                  accent: "blue",
                },
                {
                  label: "Scheduled Drafts",
                  value: String(health.queue.scheduledDrafts),
                  sub: health.account.connected ? "account connected" : "account not connected",
                  icon: CalendarClock,
                  accent: health.account.connected ? "emerald" : "amber",
                },
              ] as const
            ).map((item) => {
              const accentMap = {
                emerald: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/10" },
                amber:   { text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-100 dark:bg-amber-500/10" },
                red:     { text: "text-red-600 dark:text-red-400",          bg: "bg-red-100 dark:bg-red-500/10" },
                blue:    { text: "text-blue-600 dark:text-blue-400",        bg: "bg-blue-100 dark:bg-blue-500/10" },
              } as const;
              const colors = accentMap[item.accent];
              return (
                <div key={item.label} className="rounded-xl border border-border dark:border-white/[0.06] bg-muted/40 dark:bg-white/[0.02] p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-muted-foreground/80 dark:text-muted-foreground/60">{item.label}</p>
                    <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", colors.bg)}>
                      <item.icon className={cn("h-3.5 w-3.5", colors.text)} />
                    </div>
                  </div>
                  <p className={cn("text-lg font-bold tabular-nums", colors.text)}>{item.value}</p>
                  <p className="text-[11px] text-muted-foreground/60 dark:text-muted-foreground/40 mt-0.5">{item.sub}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {schedulerRunsQuery.data ? (
        <SchedulerOpsPanel
          data={schedulerRunsQuery.data}
          onRefresh={() => {
            void schedulerRunsQuery.refetch();
          }}
          refreshing={schedulerRunsQuery.isRefetching}
        />
      ) : schedulerRunsQuery.error ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200/90">
          {deriveSnipRadarRecoveryState(schedulerRunsQuery.error)?.message ??
            "Scheduler operations data is temporarily unavailable."}
        </div>
      ) : null}

      {/* ── Charts row ───────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/50 mb-3">
          Performance Charts
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FollowerGrowthChart data={data.growthChart} />
          <EngagementHeatmap tweets={data.postedTweets} />
        </div>
      </div>

      {/* ── Pattern Breakdowns ───────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/50 mb-3">
          Content Patterns
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <PatternBreakdown title="Hook Types" data={data.hookTypeBreakdown} accentColor="blue" />
          <PatternBreakdown title="Formats" data={data.formatBreakdown} accentColor="violet" />
          <PatternBreakdown title="Emotions" data={data.emotionBreakdown} accentColor="rose" />
        </div>
      </div>

      {/* ── Top Post Types (V2) ──────────────────────────────────────── */}
      {flags.snipRadarAnalyticsV2Enabled && (
        <div className="grid gap-3 md:grid-cols-3">
          {topPostTypes.length > 0 ? (
            topPostTypes.map((item, i) => {
              const colors = [
                { accent: "text-purple-600 dark:text-purple-400", border: "border-l-purple-500" },
                { accent: "text-cyan-600 dark:text-cyan-400",     border: "border-l-cyan-500" },
                { accent: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
              ][i] ?? { accent: "text-violet-600 dark:text-violet-400", border: "border-l-violet-500" };
              return (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-xl border border-border dark:border-white/[0.07] border-l-2 bg-gradient-to-br from-muted/60 dark:from-white/[0.03] to-transparent p-4",
                    colors.border
                  )}
                >
                  <p className={cn("text-[10px] font-semibold uppercase tracking-widest mb-2", colors.accent)}>
                    {item.label}
                  </p>
                  <p className={cn("text-2xl font-bold tabular-nums", colors.accent)}>{item.avgRate}%</p>
                  <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground/60 mt-0.5">
                    avg engagement rate · {item.posts} post{item.posts === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-muted-foreground/50 dark:text-muted-foreground/40 mt-1">
                    ~{item.avgEngagement.toLocaleString()} engagements / post
                  </p>
                </div>
              );
            })
          ) : (
            <div className="md:col-span-3 rounded-xl border border-dashed border-border/50 dark:border-white/[0.07] bg-white/[0.01] p-5 text-center">
              <p className="text-sm text-muted-foreground/50">
                Top post type cards will appear after more published data is available.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Best Performing Tweet ────────────────────────────────────── */}
      {data.bestPerforming && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-500/20 bg-gradient-to-br from-amber-50 dark:from-amber-500/[0.06] to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/15">
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Best Performing Tweet</span>
          </div>
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed text-foreground/85">
              {data.bestPerforming.text}
            </p>
            {data.bestPerforming.tweetUrl ? (
              <a
                href={data.bestPerforming.tweetUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/15"
              >
                View on X
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-5">
            {[
              { label: "Likes", value: (data.bestPerforming.actualLikes ?? 0).toLocaleString(), icon: Heart, color: "text-pink-600 dark:text-pink-400" },
              { label: "Retweets", value: (data.bestPerforming.actualRetweets ?? 0).toLocaleString(), icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Impressions", value: (data.bestPerforming.actualImpressions ?? 0).toLocaleString(), icon: Eye, color: "text-cyan-600 dark:text-cyan-400" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-1.5">
                <stat.icon className={cn("h-3.5 w-3.5", stat.color)} />
                <span className={cn("text-sm font-bold tabular-nums", stat.color)}>{stat.value}</span>
                <span className="text-xs text-muted-foreground/60 dark:text-muted-foreground/50">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Post Performance Table ───────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 dark:text-muted-foreground/50 mb-3">
          Post Performance
        </p>
        <PostPerformanceTable tweets={data.postedTweets} replyTweets={data.replyTweets} />
      </div>
    </div>
  );
}
