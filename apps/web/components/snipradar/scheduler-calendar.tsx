"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  getTopRecommendedSlots,
  type SchedulerHeatmapDay,
} from "@/lib/snipradar/scheduler-recommendations";
import { cn } from "@/lib/utils";

interface ScheduledDraft {
  id: string;
  text: string;
  scheduledFor: string | null;
  status: string;
}

type CalendarMode = "week" | "month";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(key: string) {
  const date = new Date(`${key}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string | null) {
  if (!iso) return "Time not set";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toLocalDateTimeInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function applyPresetHour(baseIso: string | null, hour: number): string {
  const date = baseIso ? new Date(baseIso) : new Date();
  date.setHours(hour, 0, 0, 0);
  return toLocalDateTimeInputValue(date.toISOString());
}

function signalClass(score: number) {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
}

export function SchedulerCalendar({
  scheduledDrafts,
  heatmap = [],
}: {
  scheduledDrafts: ScheduledDraft[];
  heatmap?: SchedulerHeatmapDay[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CalendarMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [pendingDateTime, setPendingDateTime] = useState("");
  const [dragDraftId, setDragDraftId] = useState<string | null>(null);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  const draftsByDate = useMemo(() => {
    const map = new Map<string, ScheduledDraft[]>();
    for (const draft of scheduledDrafts) {
      if (!draft.scheduledFor) continue;
      const key = toDateKey(new Date(draft.scheduledFor));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(draft);
    }
    for (const [, drafts] of map.entries()) {
      drafts.sort(
        (a, b) =>
          new Date(a.scheduledFor ?? 0).getTime() - new Date(b.scheduledFor ?? 0).getTime()
      );
    }
    return map;
  }, [scheduledDrafts]);

  const visibleDays = useMemo(() => {
    const base =
      mode === "week" ? startOfWeek(anchorDate) : startOfMonthGrid(anchorDate);
    const count = mode === "week" ? 7 : 42;
    return Array.from({ length: count }, (_, idx) => addDays(base, idx));
  }, [anchorDate, mode]);

  const selectedDraft = useMemo(
    () => scheduledDrafts.find((draft) => draft.id === selectedDraftId) ?? null,
    [scheduledDrafts, selectedDraftId]
  );

  const heatmapLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of heatmap) {
      for (const hour of day.hours) {
        map.set(`${day.day}-${hour.hour}`, hour.score);
      }
    }
    return map;
  }, [heatmap]);

  const recommendedSlots = useMemo(
    () => getTopRecommendedSlots(heatmap, { limit: 3, minScore: 55 }),
    [heatmap]
  );

  const rescheduleMutation = useMutation({
    mutationFn: async ({ draftId, dateTimeISO }: { draftId: string; dateTimeISO: string }) => {
      const res = await fetch(`/api/snipradar/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled", scheduledFor: dateTimeISO }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to reschedule draft");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar"] });
      toast({
        title: "Schedule updated",
        description: "Draft timing saved successfully.",
      });
    },
  });

  const unscheduleMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await fetch(`/api/snipradar/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft", scheduledFor: null }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to unschedule draft");
      return payload;
    },
    onSuccess: () => {
      setSelectedDraftId(null);
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar"] });
      toast({
        title: "Draft unscheduled",
        description: "The draft was moved back to your active queue.",
      });
    },
  });

  const applyQuickShift = (hours: number) => {
    if (!selectedDraft?.scheduledFor) return;
    const base = new Date(selectedDraft.scheduledFor);
    base.setHours(base.getHours() + hours);
    rescheduleMutation.mutate({
      draftId: selectedDraft.id,
      dateTimeISO: base.toISOString(),
    });
  };

  const toggleSelectedDraft = (draftId: string) => {
    setSelectedDraftIds((prev) =>
      prev.includes(draftId) ? prev.filter((id) => id !== draftId) : [...prev, draftId]
    );
  };

  const batchShiftMutation = useMutation({
    mutationFn: async ({ draftIds, hours }: { draftIds: string[]; hours: number }) => {
      const targets = scheduledDrafts.filter((draft) => draftIds.includes(draft.id));
      const results = await Promise.allSettled(
        targets.map(async (draft) => {
          if (!draft.scheduledFor) return;
          const next = new Date(draft.scheduledFor);
          next.setHours(next.getHours() + hours);
          if (next <= new Date()) throw new Error("Cannot schedule into past");
          const res = await fetch(`/api/snipradar/drafts/${draft.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "scheduled", scheduledFor: next.toISOString() }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error ?? "Failed to reschedule draft");
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar"] });
      toast({
        title: "Batch shift complete",
        description: "Selected drafts were rescheduled.",
      });
    },
  });

  const batchUnscheduleMutation = useMutation({
    mutationFn: async (draftIds: string[]) => {
      const results = await Promise.allSettled(
        draftIds.map(async (draftId) => {
          const res = await fetch(`/api/snipradar/drafts/${draftId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "draft", scheduledFor: null }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error ?? "Failed to unschedule draft");
        })
      );
      return results;
    },
    onSuccess: () => {
      setSelectedDraftIds([]);
      setSelectedDraftId(null);
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar"] });
      toast({
        title: "Batch unschedule complete",
        description: "Selected drafts were moved back to draft status.",
      });
    },
  });

  const handleDropOnDate = (date: Date) => {
    if (!dragDraftId) return;
    const dragged = scheduledDrafts.find((d) => d.id === dragDraftId);
    if (!dragged?.scheduledFor) return;
    const from = new Date(dragged.scheduledFor);
    const target = new Date(date);
    target.setHours(from.getHours(), from.getMinutes(), 0, 0);
    if (target <= new Date()) return;
    rescheduleMutation.mutate({
      draftId: dragDraftId,
      dateTimeISO: target.toISOString(),
    });
    setDragDraftId(null);
  };

  const applyRecommendedSlot = (day: string, hour: number) => {
    if (!selectedDraft) return;
    const base = selectedDraft.scheduledFor ? new Date(selectedDraft.scheduledFor) : new Date();
    const currentDay = base.getDay();
    const nextDay = DAYS.indexOf(day);
    if (nextDay === -1) return;

    let offset = nextDay - currentDay;
    if (offset < 0 || (offset === 0 && hour <= base.getHours())) {
      offset += 7;
    }

    base.setDate(base.getDate() + offset);
    base.setHours(hour, 0, 0, 0);
    const iso = base.toISOString();
    setPendingDateTime(toLocalDateTimeInputValue(iso));
    rescheduleMutation.mutate({
      draftId: selectedDraft.id,
      dateTimeISO: iso,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Content Calendar</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={mode === "week" ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setMode("week")}
            >
              <Calendar className="h-3.5 w-3.5" />
              Week
            </Button>
            <Button
              type="button"
              variant={mode === "month" ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setMode("month")}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Month
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setAnchorDate((current) => addDays(current, mode === "week" ? -7 : -30))}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setAnchorDate(new Date())}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setAnchorDate((current) => addDays(current, mode === "week" ? 7 : 30))}
          >
            Next
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {scheduledDrafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scheduled posts yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Recommended schedule slots</p>
                  <p className="text-xs text-muted-foreground">
                    Apply the strongest predicted time windows directly to the selected draft.
                  </p>
                </div>
                <Badge variant="outline">Drag cards between days to reschedule</Badge>
              </div>

              {recommendedSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Not enough posting history yet to recommend slots.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recommendedSlots.map((slot) => (
                    <button
                      key={`${slot.day}-${slot.hour}`}
                      type="button"
                      onClick={() => applyRecommendedSlot(slot.day, slot.hour)}
                      disabled={!selectedDraft || rescheduleMutation.isPending}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        !selectedDraft || rescheduleMutation.isPending
                          ? "cursor-not-allowed border-border bg-muted/10 text-muted-foreground/60"
                          : "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10"
                      )}
                    >
                      <p className="text-sm font-medium">
                        {slot.day} · {formatHour(slot.hour)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Signal {slot.score} · {slot.samples} samples
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {visibleDays.map((day) => {
                const dayKey = toDateKey(day);
                const drafts = draftsByDate.get(dayKey) ?? [];
                const isToday = dayKey === toDateKey(new Date());
                return (
                  <div
                    key={dayKey}
                    className={cn(
                      "min-h-[140px] rounded-lg border border-border p-2",
                      isToday && "border-primary/50 bg-primary/5"
                    )}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOnDate(day)}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatDateLabel(dayKey)}
                      </p>
                      {drafts.length > 0 ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          {drafts.length}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      {(expandedDayKey === dayKey ? drafts : drafts.slice(0, 3)).map((draft) => (
                        <button
                          key={draft.id}
                          type="button"
                          draggable
                          onDragStart={() => setDragDraftId(draft.id)}
                          onClick={() => {
                            setSelectedDraftId(draft.id);
                            setPendingDateTime(toLocalDateTimeInputValue(draft.scheduledFor));
                          }}
                          className={cn(
                            "w-full rounded-md border px-2 py-1 text-left text-[11px] transition-colors",
                            selectedDraftId === draft.id
                              ? "border-primary/40 bg-primary/10"
                              : "border-border bg-muted/20 hover:bg-muted/40"
                          )}
                        >
                          <div
                            className="mb-1 flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedDraftIds.includes(draft.id)}
                              onChange={() => toggleSelectedDraft(draft.id)}
                              className="h-3 w-3"
                            />
                            <span className="text-[10px] text-muted-foreground">Select</span>
                          </div>
                          <div className="mb-0.5 text-[10px] text-muted-foreground">
                            {formatTime(draft.scheduledFor)}
                          </div>
                          {draft.scheduledFor ? (
                            <span
                              className={cn(
                                "mb-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                                signalClass(
                                  heatmapLookup.get(
                                    `${DAYS[new Date(draft.scheduledFor).getDay()]}-${new Date(
                                      draft.scheduledFor,
                                    ).getHours()}`,
                                  ) ?? 0,
                                ),
                              )}
                              title={`Predicted engagement signal ${
                                heatmapLookup.get(
                                  `${DAYS[new Date(draft.scheduledFor).getDay()]}-${new Date(
                                    draft.scheduledFor,
                                  ).getHours()}`,
                                ) ?? 0
                              }/100`}
                            >
                              Signal{" "}
                              {heatmapLookup.get(
                                `${DAYS[new Date(draft.scheduledFor).getDay()]}-${new Date(
                                  draft.scheduledFor,
                                ).getHours()}`,
                              ) ?? 0}
                            </span>
                          ) : null}
                          <p className="line-clamp-2">{draft.text}</p>
                        </button>
                      ))}
                      {drafts.length > 3 ? (
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setExpandedDayKey((current) =>
                              current === dayKey ? null : dayKey
                            )
                          }
                        >
                          {expandedDayKey === dayKey
                            ? "Show less"
                            : `+${drafts.length - 3} more`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedDraftIds.length > 0 ? (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Batch Actions</p>
                  <Badge variant="outline">{selectedDraftIds.length} selected</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={batchShiftMutation.isPending}
                    onClick={() =>
                      batchShiftMutation.mutate({ draftIds: selectedDraftIds, hours: 1 })
                    }
                  >
                    +1h all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={batchShiftMutation.isPending}
                    onClick={() =>
                      batchShiftMutation.mutate({ draftIds: selectedDraftIds, hours: 24 })
                    }
                  >
                    +1d all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={batchUnscheduleMutation.isPending}
                    onClick={() => batchUnscheduleMutation.mutate(selectedDraftIds)}
                  >
                    Unschedule all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDraftIds([])}
                  >
                    Clear selection
                  </Button>
                </div>
                {batchShiftMutation.error ? (
                  <p className="mt-2 text-xs text-destructive">
                    {(batchShiftMutation.error as Error).message}
                  </p>
                ) : null}
                {batchUnscheduleMutation.error ? (
                  <p className="mt-2 text-xs text-destructive">
                    {(batchUnscheduleMutation.error as Error).message}
                  </p>
                ) : null}
              </div>
            ) : null}

            {selectedDraft ? (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Quick Edit</p>
                  <Badge variant="outline">{formatTime(selectedDraft.scheduledFor)}</Badge>
                </div>
                <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                  {selectedDraft.text}
                </p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="datetime-local"
                    value={pendingDateTime}
                    min={toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60_000).toISOString())}
                    onChange={(e) => setPendingDateTime(e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!pendingDateTime || rescheduleMutation.isPending}
                    onClick={() =>
                      rescheduleMutation.mutate({
                        draftId: selectedDraft.id,
                        dateTimeISO: new Date(pendingDateTime).toISOString(),
                      })
                    }
                  >
                    {rescheduleMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Save time"
                    )}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => applyQuickShift(1)}>
                    +1h
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyQuickShift(24)}>
                    +1d
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyQuickShift(-1)}>
                    -1h
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingDateTime(applyPresetHour(selectedDraft.scheduledFor, 9))}
                  >
                    9:00
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingDateTime(applyPresetHour(selectedDraft.scheduledFor, 13))}
                  >
                    13:00
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingDateTime(applyPresetHour(selectedDraft.scheduledFor, 18))}
                  >
                    18:00
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={unscheduleMutation.isPending}
                    onClick={() => unscheduleMutation.mutate(selectedDraft.id)}
                  >
                    {unscheduleMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Unschedule"
                    )}
                  </Button>
                </div>
                {rescheduleMutation.error ? (
                  <p className="mt-2 text-xs text-destructive">
                    {(rescheduleMutation.error as Error).message}
                  </p>
                ) : null}
                {unscheduleMutation.error ? (
                  <p className="mt-2 text-xs text-destructive">
                    {(unscheduleMutation.error as Error).message}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tip: Drag a scheduled card to another day, or click it to edit time quickly.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
