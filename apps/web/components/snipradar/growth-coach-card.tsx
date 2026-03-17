"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import {
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GrowthReport {
  summary: string;
  whatsWorking: string;
  whatToImprove: string;
  actionItems: string[];
  suggestedSchedule: string;
  generatedAt: string;
}

export function GrowthCoachCard() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ report: GrowthReport }>({
    queryKey: ["snipradar-coach"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/coach");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to generate report");
      }
      return res.json();
    },
    staleTime: 7 * 24 * 60 * 60 * 1000,
    enabled: false,
  });

  const report = data?.report;
  const hasInsight = Boolean(report?.whatsWorking?.trim());
  const teaserText = hasInsight
    ? report!.whatsWorking.trim()
    : "Last week's insight: Questions got 3.4× replies.";

  const isWorking = isLoading || isFetching;

  return (
    <div className="rounded-2xl border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.04] to-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-500/15">
            <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">AI Growth Coach</p>
              <Badge variant="secondary" className="h-[18px] px-1.5 text-[10px] font-semibold">
                Weekly
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              Personalized insights & action items
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {report && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border dark:border-white/10 bg-muted/40 dark:bg-white/5 hover:bg-muted/80 dark:hover:bg-white/10 transition-colors text-muted-foreground/60 hover:text-foreground"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              trackSnipRadarEvent(
                report
                  ? "snipradar_growth_coach_refresh_click"
                  : "snipradar_growth_coach_generate_click",
                { hasReport: Boolean(report) }
              );
              refetch();
            }}
            disabled={isWorking}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-purple-400 dark:border-purple-500/30 bg-purple-100 dark:bg-purple-500/10 hover:bg-purple-200 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isWorking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : report ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {isWorking ? "Analyzing…" : report ? "Refresh" : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        {/* Teaser insight callout */}
        <div className="flex items-start gap-2.5 rounded-xl border border-purple-300 dark:border-purple-500/15 bg-purple-50 dark:bg-purple-500/[0.06] px-3.5 py-2.5">
          <Lightbulb className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
          <p className="text-xs text-purple-700 dark:text-purple-300/90 leading-relaxed">
            {teaserText}
          </p>
        </div>

        {/* Error state */}
        {error && !report && (
          <p className="text-sm text-muted-foreground/60">{(error as Error).message}</p>
        )}

        {/* Default empty state */}
        {!report && !isWorking && !error && (
          <p className="text-sm text-muted-foreground/60 leading-relaxed">
            Generate a personalized weekly growth report with AI-powered insights and action items.
          </p>
        )}

        {/* Loading state */}
        {isWorking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
            Analyzing your X performance…
          </div>
        )}

        {/* Report — summary always visible */}
        {report && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground/80">{report.summary}</p>

            {/* Expanded detail sections */}
            {expanded && (
              <div className="space-y-3 border-t border-border dark:border-white/[0.06] pt-3">
                <CoachSection
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                  label="What's Working"
                  labelColor="text-emerald-600 dark:text-emerald-400"
                  content={report.whatsWorking}
                />
                <CoachSection
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                  label="To Improve"
                  labelColor="text-amber-600 dark:text-amber-400"
                  content={report.whatToImprove}
                />

                {/* Action items */}
                <div className="flex gap-2.5">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">Action Items</p>
                    {report.actionItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-[10px] font-bold text-purple-600/60 dark:text-purple-400/60 shrink-0">
                          {i + 1}.
                        </span>
                        <p className="text-sm text-muted-foreground/70">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {report.suggestedSchedule && (
                  <CoachSection
                    icon={<Clock className="h-3.5 w-3.5 text-muted-foreground/50" />}
                    label="Suggested Schedule"
                    labelColor="text-muted-foreground/60"
                    content={report.suggestedSchedule}
                  />
                )}

                <p className="text-[10px] text-muted-foreground/30">
                  Generated{" "}
                  {new Date(report.generatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CoachSection({
  icon,
  label,
  labelColor,
  content,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor: string;
  content: string;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className={cn("text-xs font-semibold mb-0.5", labelColor)}>{label}</p>
        <p className="text-sm text-muted-foreground/70 leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
