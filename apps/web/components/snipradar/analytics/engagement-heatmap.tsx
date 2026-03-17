"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PostedTweet {
  postedAt: string | null;
  actualLikes: number | null;
  actualRetweets: number | null;
  actualReplies: number | null;
  actualImpressions: number | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DISPLAY_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

function formatHour(h: number) {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

export function EngagementHeatmap({ tweets }: { tweets: PostedTweet[] }) {
  // Build 7×24 grid of engagement
  const grid: { total: number; count: number }[][] = DAYS.map(() =>
    HOURS.map(() => ({ total: 0, count: 0 }))
  );

  for (const tweet of tweets) {
    if (!tweet.postedAt) continue;
    const d = new Date(tweet.postedAt);
    const day = d.getDay();
    const hour = d.getHours();
    const engagement =
      (tweet.actualLikes ?? 0) +
      (tweet.actualRetweets ?? 0) +
      (tweet.actualReplies ?? 0);
    grid[day][hour].total += engagement;
    grid[day][hour].count += 1;
  }

  let maxAvg = 0;
  for (const row of grid) {
    for (const cell of row) {
      const avg = cell.count > 0 ? cell.total / cell.count : 0;
      if (avg > maxAvg) maxAvg = avg;
    }
  }

  function getIntensity(day: number, hour: number): number {
    const cell = grid[day][hour];
    if (cell.count === 0) return 0;
    return (cell.total / cell.count) / (maxAvg || 1);
  }

  // Find the best slot
  let bestDay = -1, bestHour = -1, bestVal = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const val = getIntensity(d, h);
      if (val > bestVal) { bestVal = val; bestDay = d; bestHour = h; }
    }
  }

  if (tweets.filter((t) => t.postedAt).length < 3) {
    return (
      <div className="rounded-2xl border border-border/50 dark:border-white/[0.07] bg-gradient-to-br from-muted/30 dark:from-white/[0.03] to-transparent p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15">
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
              Best Posting Times
            </p>
            <p className="text-[11px] text-muted-foreground/50">Engagement by day & hour</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground/50">
          Post at least 3 tweets to see your best times heatmap.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.03] to-transparent p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/15">
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Best Posting Times
            </p>
            <p className="text-[11px] text-muted-foreground/60 dark:text-muted-foreground/50">Avg engagement by day &amp; hour</p>
          </div>
        </div>
        {bestDay >= 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400 dark:border-emerald-500/20 bg-emerald-100 dark:bg-emerald-500/[0.07] px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {DAYS[bestDay]} {formatHour(bestHour)}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[380px]">
          {/* Hour labels */}
          <div className="mb-1.5 flex pl-10">
            {DISPLAY_HOURS.map((h) => (
              <div
                key={h}
                className="text-[10px] text-muted-foreground/40"
                style={{ width: `${(100 / 24) * 3}%` }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-1 mb-[3px]">
              <span className="w-9 text-right text-[11px] text-muted-foreground/40 pr-1 shrink-0">
                {day}
              </span>
              <div className="flex flex-1 gap-px">
                {HOURS.map((hour) => {
                  const intensity = getIntensity(dayIdx, hour);
                  const cell = grid[dayIdx][hour];
                  const isBest = dayIdx === bestDay && hour === bestHour;
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "aspect-square flex-1 rounded-[2px] transition-colors cursor-default",
                        isBest && "ring-1 ring-emerald-400/60",
                        intensity === 0
                          ? "bg-muted/60 dark:bg-white/[0.04]"
                          : intensity < 0.25
                            ? "bg-emerald-200 dark:bg-emerald-500/20"
                            : intensity < 0.5
                              ? "bg-emerald-300 dark:bg-emerald-500/38"
                              : intensity < 0.75
                                ? "bg-emerald-400 dark:bg-emerald-500/58"
                                : "bg-emerald-500 dark:bg-emerald-500/85"
                      )}
                      title={
                        cell.count > 0
                          ? `${day} ${formatHour(hour)}: ${Math.round(cell.total / cell.count)} avg engagement (${cell.count} posts)`
                          : `${day} ${formatHour(hour)}: No data`
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="mt-4 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground/60 dark:text-muted-foreground/40">
            <span>Less</span>
            <div className="h-2.5 w-2.5 rounded-[2px] bg-muted/60 dark:bg-white/[0.04]" />
            <div className="h-2.5 w-2.5 rounded-[2px] bg-emerald-200 dark:bg-emerald-500/20" />
            <div className="h-2.5 w-2.5 rounded-[2px] bg-emerald-300 dark:bg-emerald-500/38" />
            <div className="h-2.5 w-2.5 rounded-[2px] bg-emerald-400 dark:bg-emerald-500/58" />
            <div className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500 dark:bg-emerald-500/85" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
