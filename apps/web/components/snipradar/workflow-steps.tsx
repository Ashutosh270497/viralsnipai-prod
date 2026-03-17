"use client";

import { ArrowRight, Check, Radar, Rss, Cpu, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkflowSteps({
  trackedCount,
  viralCount,
  analyzedCount,
  draftCount,
  onDraftsReadyClick,
}: {
  trackedCount: number;
  viralCount: number;
  analyzedCount: number;
  draftCount: number;
  onDraftsReadyClick?: () => void;
}) {
  const steps = [
    {
      label: "Track Accounts",
      sublabel: `${trackedCount} tracked`,
      done: trackedCount > 0,
      icon: Radar,
      accentColor: "text-blue-400",
      accentBg: "bg-blue-500/15",
      doneBg: "bg-emerald-500",
    },
    {
      label: "Fetch Tweets",
      sublabel: `${viralCount} fetched`,
      done: viralCount > 0,
      icon: Rss,
      accentColor: "text-cyan-400",
      accentBg: "bg-cyan-500/15",
      doneBg: "bg-emerald-500",
    },
    {
      label: "Analyze Patterns",
      sublabel: `${analyzedCount} analyzed`,
      done: analyzedCount > 0,
      icon: Cpu,
      accentColor: "text-violet-400",
      accentBg: "bg-violet-500/15",
      doneBg: "bg-emerald-500",
    },
    {
      label: "Generate Drafts",
      sublabel: draftCount > 0 ? `${draftCount} ready` : "pending",
      done: draftCount > 0,
      icon: PenLine,
      accentColor: "text-pink-400",
      accentBg: "bg-pink-500/15",
      doneBg: "bg-emerald-500",
    },
  ];

  const currentIdx = steps.findIndex((s) => !s.done);
  const allDone = currentIdx === -1;

  return (
    <div className="rounded-xl border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Workflow Pipeline
        </p>
        {allDone && draftCount > 0 && onDraftsReadyClick && (
          <button
            type="button"
            onClick={onDraftsReadyClick}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-400 dark:border-emerald-500/30 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {draftCount} draft{draftCount !== 1 ? "s" : ""} ready to post
          </button>
        )}
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isDone = step.done;
          const isActive = i === currentIdx;
          const isPending = !isDone && !isActive;

          return (
            <div key={step.label} className="flex items-center flex-1 min-w-0">
              {/* Step cell */}
              <div
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 transition-all",
                  isDone
                    ? "bg-emerald-500/[0.07]"
                    : isActive
                    ? "bg-purple-500/[0.08] border border-purple-500/20"
                    : "opacity-40"
                )}
              >
                {/* Icon circle */}
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    isDone
                      ? "bg-emerald-500"
                      : isActive
                      ? "bg-gradient-to-br from-purple-500 to-pink-500"
                      : "bg-muted/50 dark:bg-white/[0.06]"
                  )}
                >
                  {isDone ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : (
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        isActive ? "text-white" : "text-muted-foreground/40"
                      )}
                    />
                  )}
                </div>

                {/* Labels */}
                <div className="text-center">
                  <p
                    className={cn(
                      "text-[11px] font-semibold whitespace-nowrap",
                      isDone
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isActive
                        ? "text-foreground dark:text-white"
                        : "text-muted-foreground/40"
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] tabular-nums",
                      isDone
                        ? "text-emerald-600/70 dark:text-emerald-400/60"
                        : isActive
                        ? "text-purple-700 dark:text-purple-300/70"
                        : "text-muted-foreground/25"
                    )}
                  >
                    {step.sublabel}
                  </p>
                </div>
              </div>

              {/* Arrow connector */}
              {i < steps.length - 1 && (
                <ArrowRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 mx-1",
                    steps[i].done ? "text-emerald-500/40" : "text-muted-foreground/15"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
