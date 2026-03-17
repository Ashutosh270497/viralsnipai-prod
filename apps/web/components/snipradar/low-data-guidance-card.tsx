"use client";

import { CheckCircle2, Circle, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  label: string;
  done: boolean;
}

export function LowDataGuidanceCard({
  checklist,
  onGoCreate,
}: {
  checklist: ChecklistItem[];
  onGoCreate: () => void;
}) {
  const doneCount = checklist.filter((c) => c.done).length;
  const totalCount = checklist.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.08] via-transparent to-pink-500/[0.04] p-6">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center relative">

        {/* ── Left: Content ─────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-200 dark:bg-purple-500/20">
                <Zap className="h-3.5 w-3.5 text-purple-700 dark:text-purple-400" />
              </div>
              <p className="text-sm font-semibold text-foreground dark:text-white">Unlock Full AI Predictions</p>
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-sm">
              Connect your X account and publish at least 3 SnipRadar drafts to build prediction confidence.
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Setup progress
              </span>
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                {doneCount}/{totalCount}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted/60 dark:bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                )}
                <span
                  className={cn(
                    "text-sm transition-colors",
                    item.done
                      ? "text-foreground/80 line-through decoration-muted-foreground/30"
                      : "text-muted-foreground/60"
                  )}
                >
                  {item.label}
                </span>
                {item.done && (
                  <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Done</span>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onGoCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/25"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Create Drafts
          </button>
        </div>

        {/* ── Right: Prediction signal chart ─────────────────────── */}
        <div className="rounded-xl border border-border dark:border-white/[0.07] bg-muted/50 dark:bg-black/20 p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Prediction Signal
          </p>
          <p className="mb-3 text-[11px] text-muted-foreground/40">Confidence builds with more data</p>

          {/* Animated signal bars */}
          <div className="flex h-16 items-end gap-1">
            {[6, 8, 10, 12, 16, 18, 24, 28, 34, 40, 46, 52].map((height, idx) => {
              const isFilled = idx < Math.ceil((doneCount / totalCount) * 6);
              return (
                <div
                  key={`${height}-${idx}`}
                  className={cn(
                    "flex-1 rounded-sm transition-all duration-500",
                    isFilled
                      ? "bg-gradient-to-t from-purple-500 to-pink-400"
                      : idx < 9
                      ? "bg-muted/60 dark:bg-white/[0.08]"
                      : "bg-purple-500/20"
                  )}
                  style={{ height }}
                />
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/40 leading-relaxed">
            Low data mode active. Post more drafts to strengthen forecasts.
          </p>
        </div>
      </div>
    </div>
  );
}
