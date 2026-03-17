"use client";

import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";

type Slot = { day: string; hour: number; score: number; samples: number };
type HeatmapDay = {
  day: string;
  hours: Array<{ hour: number; score: number; samples: number }>;
};

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
}

function scoreClass(score: number) {
  if (score >= 75) return "bg-emerald-500/70";
  if (score >= 55) return "bg-emerald-500/45";
  if (score >= 35) return "bg-emerald-500/25";
  if (score > 0) return "bg-emerald-500/15";
  return "bg-muted";
}

export function BestTimeChart({
  slots,
  heatmap,
  source,
  confidence,
  sampleCount,
  minRequired,
  message,
}: {
  slots: Slot[];
  heatmap: HeatmapDay[];
  source?: string;
  confidence?: "none" | "low" | "medium" | "high";
  sampleCount?: number;
  minRequired?: number;
  message?: string;
}) {
  return (
    <div className="space-y-3">
      {(message || source) && (
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {message ?? "Best time model update."}
          {typeof sampleCount === "number" && typeof minRequired === "number" ? (
            <span className="ml-1">({sampleCount}/{minRequired}+ posts)</span>
          ) : null}
          {confidence ? <span className="ml-2 uppercase tracking-wide">confidence: {confidence}</span> : null}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Best Time Slots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {slots.length === 0 ? (
            <SnipRadarEmptyState
              icon={CalendarClock}
              eyebrow="Best Times"
              title="Best-time predictions need more posted history"
              description="Once SnipRadar has enough post-level performance data, it will rank the highest-confidence time slots for the scheduler."
              hint={
                typeof sampleCount === "number" && typeof minRequired === "number"
                  ? `${sampleCount}/${minRequired}+ posts currently available for time-slot training.`
                  : "Publish a few more posts to train the scheduler."
              }
            />
          ) : (
            slots.slice(0, 8).map((slot, idx) => (
              <div key={`${slot.day}-${slot.hour}-${idx}`} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm font-medium">{slot.day} · {formatHour(slot.hour)}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{slot.score}</Badge>
                  <span className="text-xs text-muted-foreground">{slot.samples} samples</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Engagement Heatmap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 overflow-auto">
          {heatmap.length === 0 ? (
            <SnipRadarEmptyState
              icon={CalendarClock}
              eyebrow="Heatmap"
              title="No heatmap density yet"
              description="The hourly grid appears once enough real publishing history exists to model engagement reliably."
              hint="Keep posting through SnipRadar so the scheduler can move from generic guidance to personalized heatmap predictions."
            />
          ) : (
            heatmap.map((day) => (
              <div key={day.day} className="grid grid-cols-[48px_1fr] items-center gap-2">
                <span className="text-xs text-muted-foreground">{day.day}</span>
                <div
                  className="grid min-w-[520px] gap-1"
                  style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
                >
                  {day.hours.map((hour) => (
                    <div
                      key={`${day.day}-${hour.hour}`}
                      className={`h-4 rounded-sm ${scoreClass(hour.score)}`}
                      title={`${day.day} ${formatHour(hour.hour)} · score ${hour.score} · ${hour.samples} samples`}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
