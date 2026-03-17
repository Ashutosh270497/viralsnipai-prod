"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  Pencil,
  Send,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";
import { cn } from "@/lib/utils";
import type {
  QueueItem,
  SchedulerQueueResponse,
  ThreadQueueItem,
  PostQueueItem,
} from "@/app/api/snipradar/scheduler/queue/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatScheduledTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMinScheduleDateTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ── Skeleton loader ────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 animate-pulse space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded bg-muted" />
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted ml-auto" />
      </div>
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}

// ── Scheduled Item Card ────────────────────────────────────────────────────

function ScheduledCard({
  item,
  xUsername,
  onOptimisticRemove,
  processNowMutate,
}: {
  item: QueueItem;
  xUsername: string;
  onOptimisticRemove: (id: string) => void;
  processNowMutate: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  // ── Unschedule ───────────────────────────────────────────────────────────
  const unscheduleMutation = useMutation({
    mutationFn: async () => {
      if (item.type === "thread") {
        const res = await fetch(
          `/api/snipradar/threads/schedule?threadGroupId=${encodeURIComponent(item.groupId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to unschedule thread");
        }
        return res.json();
      } else {
        const res = await fetch(`/api/snipradar/drafts/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "draft", scheduledFor: null }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to unschedule post");
        }
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-queue"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-contents"] });
    },
  });

  // ── Post now ─────────────────────────────────────────────────────────────
  const postNowMutation = useMutation({
    mutationFn: async () => {
      if (item.type === "thread") {
        const res = await fetch("/api/snipradar/threads/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadGroupId: item.groupId }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to post thread");
        }
        return res.json();
      } else {
        // For single posts: make it immediately due, then trigger process queue
        const pastTime = new Date(Date.now() - 60_000).toISOString();
        const patchRes = await fetch(`/api/snipradar/drafts/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "scheduled", scheduledFor: pastTime }),
        });
        if (!patchRes.ok) throw new Error("Failed to queue post");
        return null; // process queue called below
      }
    },
    onSuccess: (_data) => {
      const itemId = item.type === "thread" ? item.groupId : item.id;
      onOptimisticRemove(itemId);
      queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-queue"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      // For single posts, trigger process queue to actually send
      if (item.type === "post") {
        processNowMutate();
      }
    },
  });

  // ── Reschedule ───────────────────────────────────────────────────────────
  const rescheduleMutation = useMutation({
    mutationFn: async (scheduledFor: string) => {
      if (item.type === "thread") {
        const res = await fetch("/api/snipradar/threads/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadGroupId: item.groupId, scheduledFor }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to reschedule thread");
        }
        return res.json();
      } else {
        const res = await fetch(`/api/snipradar/drafts/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "scheduled", scheduledFor }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to reschedule post");
        }
        return res.json();
      }
    },
    onSuccess: () => {
      setShowScheduler(false);
      setScheduleDateTime("");
      queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-queue"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-contents"] });
    },
  });

  const isThread = item.type === "thread";
  const isPending =
    unscheduleMutation.isPending ||
    postNowMutation.isPending ||
    rescheduleMutation.isPending;

  const handleEdit = () => {
    if (isThread) {
      router.push("/snipradar/create/threads");
    } else {
      router.push("/snipradar/create/drafts");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Card header */}
      <div className="p-3 space-y-1.5">
        {/* Type badge + count */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isThread ? (
              <>
                <MessageSquareText className="h-3.5 w-3.5" />
                <span className="font-medium">Thread</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {(item as ThreadQueueItem).tweetCount} tweets
                </Badge>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium">Post</span>
                {(item as PostQueueItem).hookType && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {(item as PostQueueItem).hookType}
                  </Badge>
                )}
              </>
            )}
          </div>
          {(item as PostQueueItem).viralPrediction != null && !isThread && (
            <span className="text-[10px] text-muted-foreground">
              score {(item as PostQueueItem).viralPrediction}
            </span>
          )}
        </div>

        {/* Hook text / post text */}
        <p className="text-sm text-foreground leading-snug line-clamp-2">
          {isThread
            ? (item as ThreadQueueItem).hookText
            : (item as PostQueueItem).text}
        </p>

        {/* Scheduled time */}
        {item.scheduledFor && (
          <div className="flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400">
            <CalendarClock className="h-3 w-3 shrink-0" />
            {formatScheduledTime(item.scheduledFor)}
          </div>
        )}
      </div>

      {/* Reschedule picker */}
      {showScheduler && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
          <input
            type="datetime-local"
            min={getMinScheduleDateTime()}
            value={scheduleDateTime}
            onChange={(e) => setScheduleDateTime(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            className="h-7 gap-1 shrink-0"
            disabled={!scheduleDateTime || rescheduleMutation.isPending}
            onClick={() =>
              rescheduleMutation.mutate(new Date(scheduleDateTime).toISOString())
            }
          >
            {rescheduleMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Confirm"
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => {
              setShowScheduler(false);
              setScheduleDateTime("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Error feedback */}
      {(unscheduleMutation.error ||
        postNowMutation.error ||
        rescheduleMutation.error) && (
        <div className="px-3 pb-2">
          <p className="text-xs text-destructive">
            {(unscheduleMutation.error as Error)?.message ??
              (postNowMutation.error as Error)?.message ??
              (rescheduleMutation.error as Error)?.message}
          </p>
        </div>
      )}

      {/* Action bar */}
      {!showScheduler && (
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-muted-foreground"
              disabled={isPending}
              onClick={() => unscheduleMutation.mutate()}
            >
              {unscheduleMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Unschedule"
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-muted-foreground"
              disabled={isPending}
              onClick={() => setShowScheduler(true)}
            >
              <CalendarClock className="h-3 w-3" />
              Edit time
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-muted-foreground"
              onClick={handleEdit}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            disabled={isPending}
            onClick={() => postNowMutation.mutate()}
          >
            {postNowMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Post Now →
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Ready Item Card (staging area) ────────────────────────────────────────

function ReadyCard({
  item,
  onScheduled,
}: {
  item: QueueItem;
  onScheduled: () => void;
}) {
  const queryClient = useQueryClient();
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  const scheduleMutation = useMutation({
    mutationFn: async (scheduledFor: string) => {
      if (item.type === "thread") {
        const res = await fetch("/api/snipradar/threads/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadGroupId: item.groupId, scheduledFor }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to schedule thread");
        }
        return res.json();
      } else {
        const res = await fetch(`/api/snipradar/drafts/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "scheduled", scheduledFor }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to schedule post");
        }
        return res.json();
      }
    },
    onSuccess: () => {
      setShowScheduler(false);
      setScheduleDateTime("");
      queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-queue"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-contents"] });
      onScheduled();
    },
  });

  const isThread = item.type === "thread";

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {isThread ? (
          <>
            <MessageSquareText className="h-3.5 w-3.5" />
            <span>Thread</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {(item as ThreadQueueItem).tweetCount} tweets
            </Badge>
          </>
        ) : (
          <>
            <FileText className="h-3.5 w-3.5" />
            <span>Post</span>
          </>
        )}
      </div>
      <p className="text-sm text-foreground line-clamp-2 leading-snug">
        {isThread
          ? (item as ThreadQueueItem).hookText
          : (item as PostQueueItem).text}
      </p>

      {showScheduler ? (
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            min={getMinScheduleDateTime()}
            value={scheduleDateTime}
            onChange={(e) => setScheduleDateTime(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            className="h-7 gap-1 shrink-0 text-[11px]"
            disabled={!scheduleDateTime || scheduleMutation.isPending}
            onClick={() =>
              scheduleMutation.mutate(new Date(scheduleDateTime).toISOString())
            }
          >
            {scheduleMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Schedule"
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => setShowScheduler(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          onClick={() => setShowScheduler(true)}
        >
          <CalendarClock className="h-3 w-3" />
          Schedule
        </Button>
      )}

      {scheduleMutation.error && (
        <p className="text-xs text-destructive">
          {(scheduleMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}

// ── Main SchedulerQueuePanel ───────────────────────────────────────────────

export function SchedulerQueuePanel({
  onProcessQueue,
  isProcessing,
}: {
  onProcessQueue: () => void;
  isProcessing: boolean;
}) {
  const { account } = useSnipRadar();
  const queryClient = useQueryClient();
  const [optimisticRemovedIds, setOptimisticRemovedIds] = useState<Set<string>>(
    new Set()
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading } = useQuery<SchedulerQueueResponse>({
    queryKey: ["snipradar-scheduler-queue"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/scheduler/queue");
      if (!res.ok) throw new Error("Failed to fetch scheduler queue");
      return res.json();
    },
    staleTime: 25_000,
    refetchOnWindowFocus: true,
  });

  // Auto-refresh every 30 seconds (Part C requirement)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-queue"] });
    }, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [queryClient]);

  const scheduled = (data?.scheduled ?? []).filter(
    (item) =>
      !optimisticRemovedIds.has(
        item.type === "thread" ? item.groupId : item.id
      )
  );
  const ready = data?.ready ?? [];

  const handleOptimisticRemove = useCallback((id: string) => {
    setOptimisticRemovedIds((prev) => new Set([...prev, id]));
  }, []);

  const handleScheduled = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-queue"] });
  }, [queryClient]);

  // Part C — health badge based on scheduled count
  const healthBadgeClass =
    scheduled.length > 0
      ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
      : "border-border text-muted-foreground";
  const healthBadgeText = scheduled.length > 0 ? "active" : "empty";

  return (
    <div className="space-y-4">
      {/* Scheduler health summary — Part C */}
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground">Scheduler health:</span>
        <Badge variant="outline" className={healthBadgeClass}>
          {healthBadgeText}
        </Badge>
        <span className="text-muted-foreground">
          {scheduled.length} scheduled · {ready.length} ready
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Scheduled drafts (…)</p>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Ready to schedule (…)</p>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left column — Scheduled items */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Scheduled drafts ({scheduled.length})
            </p>
            {scheduled.length === 0 ? (
              <SnipRadarEmptyState
                icon={CalendarClock}
                eyebrow="Scheduler"
                title="Nothing queued yet"
                description={
                  ready.length > 0
                    ? `${ready.length} item${ready.length === 1 ? "" : "s"} in the ready column — pick a time to schedule them.`
                    : "Generate content in the Create tab, then schedule it from the ready column on the right."
                }
                hint="The scheduler checks for due posts every few minutes automatically."
                primaryAction={
                  ready.length === 0
                    ? {
                        label: "View saved content",
                        href: "/snipradar/create/contents",
                      }
                    : {
                        label: "Process Queue Now",
                        onClick: onProcessQueue,
                        disabled: isProcessing,
                      }
                }
                secondaryAction={
                  ready.length === 0
                    ? undefined
                    : {
                        label: "View saved content",
                        href: "/snipradar/create/contents",
                      }
                }
              />
            ) : (
              <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {scheduled.map((item) => (
                  <ScheduledCard
                    key={item.type === "thread" ? item.groupId : item.id}
                    item={item}
                    xUsername={account?.xUsername ?? ""}
                    onOptimisticRemove={handleOptimisticRemove}
                    processNowMutate={onProcessQueue}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right column — Ready to schedule */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Ready to schedule ({ready.length})
            </p>
            {ready.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active drafts or threads available. Generate content from the{" "}
                <a
                  href="/snipradar/create/drafts"
                  className="text-foreground underline underline-offset-2"
                >
                  Create tab
                </a>
                .
              </p>
            ) : (
              <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {ready.map((item) => (
                  <ReadyCard
                    key={item.type === "thread" ? item.groupId : item.id}
                    item={item}
                    onScheduled={handleScheduled}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
