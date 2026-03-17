"use client";

import { AlertTriangle, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type SchedulerRunStatus = "success" | "partial" | "failed" | "locked" | "empty";

interface SchedulerRun {
  id: string;
  source: string;
  status: SchedulerRunStatus;
  attempted: number;
  posted: number;
  failed: number;
  skipped: number;
  lockAcquired: boolean;
  durationMs: number | null;
  errorSummary: string | null;
  createdAt: string;
}

interface SchedulerRunsSummary {
  windowHours: number;
  totalRuns: number;
  successRuns: number;
  partialRuns: number;
  failedRuns: number;
  lockedRuns: number;
  emptyRuns: number;
  successRatePct: number;
  failureRatePct: number;
  avgDurationMs: number;
}

interface FailureCategory {
  reason: string;
  count: number;
  sharePct: number;
}

interface SourceBreakdown {
  source: string;
  count: number;
}

export interface SchedulerRunsOpsPayload {
  runs: SchedulerRun[];
  summary: SchedulerRunsSummary;
  failureCategories: FailureCategory[];
  sourceBreakdown: SourceBreakdown[];
  generatedAt: string;
  degraded?: boolean;
}

function statusLabel(status: SchedulerRunStatus): string {
  if (status === "success") return "success";
  if (status === "partial") return "partial";
  if (status === "failed") return "failed";
  if (status === "locked") return "locked";
  return "empty";
}

function statusClasses(status: SchedulerRunStatus): string {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "partial") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  if (status === "failed") {
    return "border-red-500/40 bg-red-500/10 text-red-300";
  }
  if (status === "locked") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-300";
  }
  return "border-slate-500/30 bg-slate-500/10 text-slate-300";
}

export function SchedulerOpsPanel({
  data,
  onRefresh,
  refreshing = false,
}: {
  data: SchedulerRunsOpsPayload;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const healthy = data.summary.failureRatePct <= 20;

  return (
    <div className="rounded-2xl border border-border/60 dark:border-white/[0.07] bg-gradient-to-br from-muted/30 dark:from-white/[0.03] to-transparent p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              healthy ? "bg-emerald-500/15" : "bg-amber-500/15"
            )}
          >
            {healthy ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">Scheduler Operations</p>
            <p className="text-xs text-muted-foreground/60">
              Last {data.summary.windowHours}h run health and failure categories
            </p>
          </div>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/30 dark:bg-white/[0.03] px-2.5 py-1.5 text-xs text-muted-foreground/80 hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing ? "animate-spin" : "")} />
            Refresh
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-border/50 dark:border-white/[0.06] bg-muted/30 dark:bg-white/[0.02] p-3">
          <p className="text-[11px] text-muted-foreground/60">Runs</p>
          <p className="text-lg font-semibold tabular-nums">{data.summary.totalRuns}</p>
        </div>
        <div className="rounded-lg border border-border/50 dark:border-white/[0.06] bg-muted/30 dark:bg-white/[0.02] p-3">
          <p className="text-[11px] text-muted-foreground/60">Success rate</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-400">
            {data.summary.successRatePct}%
          </p>
        </div>
        <div className="rounded-lg border border-border/50 dark:border-white/[0.06] bg-muted/30 dark:bg-white/[0.02] p-3">
          <p className="text-[11px] text-muted-foreground/60">Failure rate</p>
          <p className="text-lg font-semibold tabular-nums text-amber-300">
            {data.summary.failureRatePct}%
          </p>
        </div>
        <div className="rounded-lg border border-border/50 dark:border-white/[0.06] bg-muted/30 dark:bg-white/[0.02] p-3">
          <p className="text-[11px] text-muted-foreground/60">Avg runtime</p>
          <p className="text-lg font-semibold tabular-nums">{data.summary.avgDurationMs}ms</p>
        </div>
        <div className="rounded-lg border border-border/50 dark:border-white/[0.06] bg-muted/30 dark:bg-white/[0.02] p-3">
          <p className="text-[11px] text-muted-foreground/60">Failed runs</p>
          <p className="text-lg font-semibold tabular-nums text-red-400">
            {data.summary.failedRuns}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/50 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] p-3.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
            Failure Categories
          </p>
          {data.failureCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground/50">
              No scheduler failures in this time window.
            </p>
          ) : (
            <div className="space-y-2">
              {data.failureCategories.slice(0, 5).map((item) => (
                <div key={item.reason} className="flex items-center justify-between gap-3 text-xs">
                  <span className="line-clamp-1 text-muted-foreground/80">{item.reason}</span>
                  <span className="tabular-nums text-amber-300">
                    {item.count} ({item.sharePct}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border/50 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] p-3.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
            Source Breakdown
          </p>
          {data.sourceBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground/50">No scheduler run source data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.sourceBreakdown.map((item) => (
                <div key={item.source} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/80">{item.source}</span>
                  <span className="tabular-nums text-violet-300">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.runs.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border/50 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-border/40 dark:border-white/[0.05] px-3.5 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Recent Runs
            </p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
              <Clock3 className="h-3.5 w-3.5" />
              {new Date(data.generatedAt).toLocaleTimeString()}
            </div>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background/80 backdrop-blur">
                <tr className="text-muted-foreground/55">
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Posted</th>
                  <th className="px-3 py-2 text-left font-medium">Failed</th>
                  <th className="px-3 py-2 text-left font-medium">Duration</th>
                  <th className="px-3 py-2 text-left font-medium">At</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.slice(0, 10).map((run) => (
                  <tr key={run.id} className="border-t border-border/30 dark:border-white/[0.04]">
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          statusClasses(run.status)
                        )}
                      >
                        {statusLabel(run.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground/80">{run.source}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-300">{run.posted}</td>
                    <td className="px-3 py-2 tabular-nums text-red-300">{run.failed}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground/80">
                      {run.durationMs ?? 0}ms
                    </td>
                    <td className="px-3 py-2 text-muted-foreground/60">
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

