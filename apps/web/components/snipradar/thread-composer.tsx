"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MessageSquareText,
  Send,
  CalendarClock,
  Check,
  X,
  Trash2,
  BookmarkCheck,
  Eye,
  EyeOff,
  Heart,
  Repeat2,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";
import type { SnipRadarDraft } from "@/components/snipradar/snipradar-context";
import { ThreadTweetRow } from "@/components/snipradar/thread-tweet-row";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { dispatchBanner } from "@/lib/snipradar/banner-events";
import { cn } from "@/lib/utils";

function getMinScheduleDateTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ThreadComposer() {
  const { drafts, account, invalidate, statsPeriodDays } = useSnipRadar();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  // Holds thread drafts returned directly from the generate API so they appear
  // immediately, before the server-side summary cache (8s TTL) has time to expire.
  const [localDrafts, setLocalDrafts] = useState<SnipRadarDraft[]>([]);

  // Merge context drafts with any locally-cached generated drafts.
  // Context drafts take precedence (they are the authoritative source once refreshed).
  const allDrafts = useMemo(() => {
    const contextIds = new Set(drafts.map((d) => d.id));
    const extras = localDrafts.filter((d) => !contextIds.has(d.id));
    return [...drafts, ...extras];
  }, [drafts, localDrafts]);

  const groupedThreads = useMemo(() => {
    const groups = new Map<string, typeof allDrafts>();

    for (const draft of allDrafts) {
      if (!draft.threadGroupId) continue;
      if (!groups.has(draft.threadGroupId)) {
        groups.set(draft.threadGroupId, []);
      }
      groups.get(draft.threadGroupId)!.push(draft);
    }

    return [...groups.entries()]
      .map(([groupId, items]) => ({
        groupId,
        items: [...items].sort((a, b) => (a.threadOrder ?? 0) - (b.threadOrder ?? 0)),
        createdAt: items[0]?.createdAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );
  }, [allDrafts]);

  const selectedThread =
    groupedThreads.find((g) => g.groupId === selectedGroupId) ??
    groupedThreads[0] ??
    null;

  const isThreadPosted =
    selectedThread?.items.every((d) => d.status === "posted") ?? false;
  const isThreadScheduled =
    !isThreadPosted &&
    selectedThread?.items.every((d) => d.status === "scheduled") === true;

  // ── Generate ──────────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/threads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tweetCount: 6 }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate thread");
      }
      return res.json() as Promise<{
        threadGroupId: string;
        drafts: Array<{
          id: string;
          text: string;
          threadGroupId: string;
          threadOrder: number;
          status: string;
          createdAt: string;
        }>;
      }>;
    },
    onSuccess: (data) => {
      setSelectedGroupId(data.threadGroupId);
      setShowScheduler(false);

      // Immediately inject new thread into local state so it shows up before
      // the server-side summary cache (8 s TTL) has time to expire.
      const newDrafts: SnipRadarDraft[] = data.drafts.map((d) => ({
        id: d.id,
        text: d.text,
        hookType: null,
        format: "thread",
        emotionalTrigger: null,
        viralPrediction: null,
        aiReasoning: null,
        threadGroupId: d.threadGroupId,
        threadOrder: d.threadOrder,
        status: d.status,
        scheduledFor: null,
        postedAt: null,
        postedTweetId: null,
        createdAt: d.createdAt,
      }));
      setLocalDrafts((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        return [...prev, ...newDrafts.filter((d) => !existingIds.has(d.id))];
      });

      // Write directly into the React Query summary cache so the thread survives
      // navigation (localDrafts resets on unmount; the RQ cache persists for gcTime).
      // We intentionally do NOT call invalidate() on snipradar-summary here:
      // that would trigger a refetch which hits the server-side dashboardCache
      // (8 s TTL) and overwrite this update with stale pre-generation data.
      // The query refetches naturally when staleTime (60 s) expires — by then
      // the server cache has expired and the DB includes the new thread.
      queryClient.setQueryData(
        ["snipradar-summary", statsPeriodDays],
        (old: any) => {
          if (!old) return old;
          const existingIds = new Set((old.drafts ?? []).map((d: any) => d.id));
          const fresh = newDrafts.filter((d) => !existingIds.has(d.id));
          return { ...old, drafts: [...fresh, ...(old.drafts ?? [])] };
        }
      );

      // Only refresh the header draft-count badge — safe because create-data
      // has its own 8 s cache key separate from snipradar-summary.
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-contents"] });
      dispatchBanner({ message: "Thread saved to Contents", variant: "success" });
    },
  });

  // ── Post thread now ───────────────────────────────────────────────────────
  const postMutation = useMutation({
    mutationFn: async (threadGroupId: string) => {
      const res = await fetch("/api/snipradar/threads/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadGroupId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to post thread");
      }
      return res.json() as Promise<{ posted: number; rootTweetId: string }>;
    },
    onSuccess: () => {
      setShowScheduler(false);
      invalidate();
      dispatchBanner({ message: "Thread posted to X!", variant: "success" });
    },
  });

  // ── Schedule thread ───────────────────────────────────────────────────────
  const scheduleMutation = useMutation({
    mutationFn: async ({
      threadGroupId,
      scheduledFor,
    }: {
      threadGroupId: string;
      scheduledFor: string;
    }) => {
      const res = await fetch("/api/snipradar/threads/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadGroupId,
          scheduledFor: new Date(scheduledFor).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to schedule thread");
      }
      return res.json();
    },
    onSuccess: (_data, { scheduledFor }) => {
      setShowScheduler(false);
      setScheduleDateTime("");
      invalidate();
      dispatchBanner({
        message: `Thread scheduled for ${new Date(scheduledFor).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
        variant: "info",
      });
    },
  });

  // ── Unschedule thread ─────────────────────────────────────────────────────
  const unscheduleMutation = useMutation({
    mutationFn: async (threadGroupId: string) => {
      const res = await fetch(
        `/api/snipradar/threads/schedule?threadGroupId=${encodeURIComponent(threadGroupId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to unschedule thread");
      }
      return res.json();
    },
    onSuccess: () => invalidate(),
  });

  // ── Delete thread ─────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: async (threadGroupId: string) => {
      const res = await fetch(
        `/api/snipradar/threads/${encodeURIComponent(threadGroupId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete thread");
      }
      return res.json() as Promise<{ deleted: number }>;
    },
    onSuccess: (_data, threadGroupId) => {
      setConfirmDelete(false);
      setSelectedGroupId(null);
      // Remove deleted thread from local cache using the mutation argument (not stale closure)
      setLocalDrafts((prev) =>
        prev.filter((d) => d.threadGroupId !== threadGroupId)
      );
      queryClient.setQueryData(
        ["snipradar-summary", statsPeriodDays],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            drafts: (old.drafts ?? []).filter(
              (d: any) => d.threadGroupId !== threadGroupId
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
    },
  });

  const isActionPending =
    postMutation.isPending ||
    scheduleMutation.isPending ||
    unscheduleMutation.isPending ||
    deleteMutation.isPending;

  // Cmd+S / Ctrl+S — quick-post the selected thread
  useKeyboardShortcuts(
    [
      {
        key: "s",
        ctrl: true,
        action: () => {
          if (!selectedThread || isThreadPosted || isActionPending) return;
          postMutation.mutate(selectedThread.groupId);
        },
        description: "Post thread",
      },
    ],
    Boolean(selectedThread && !isThreadPosted),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Thread Writer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Topic input */}
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Thread topic (e.g. 5 lessons from building with AI agents)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && topic.trim().length >= 3) {
                generateMutation.mutate();
              }
            }}
          />
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || topic.trim().length < 3}
            className="gap-1.5 shrink-0"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquareText className="h-3.5 w-3.5" />
            )}
            Generate
          </Button>
        </div>

        {generateMutation.error && (
          <p className="text-xs text-destructive">
            {(generateMutation.error as Error).message}
          </p>
        )}

        {groupedThreads.length > 0 ? (
          <div className="space-y-4">
            {/* Thread group selector */}
            <div className="flex flex-wrap gap-2">
              {groupedThreads.map((group) => (
                <Button
                  key={group.groupId}
                  size="sm"
                  variant={
                    selectedThread?.groupId === group.groupId
                      ? "default"
                      : "outline"
                  }
                  onClick={() => {
                    setSelectedGroupId(group.groupId);
                    setShowScheduler(false);
                    setScheduleDateTime("");
                  }}
                >
                  Thread {group.groupId.slice(-4)}
                  <Badge variant="secondary" className="ml-2">
                    {group.items.length}
                  </Badge>
                </Button>
              ))}
            </div>

            {selectedThread && (
              <>
                {/* Thread status banner */}
                {isThreadPosted && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Thread posted —{" "}
                      {selectedThread.items[0]?.postedTweetId && account?.xUsername && (
                        <a
                          href={`https://x.com/${account.xUsername}/status/${selectedThread.items[0].postedTweetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          view on X
                        </a>
                      )}
                    </span>
                  </div>
                )}

                {isThreadScheduled && selectedThread.items[0]?.scheduledFor && (
                  <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                      Scheduled for{" "}
                      {new Date(selectedThread.items[0].scheduledFor).toLocaleString(
                        undefined,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unscheduleMutation.mutate(selectedThread.groupId)}
                      disabled={unscheduleMutation.isPending}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    >
                      {unscheduleMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Unschedule"
                      )}
                    </Button>
                  </div>
                )}

                {/* Preview toggle — only available on large screens */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground/50 lg:hidden">
                    Tip: open on desktop to see the X preview panel.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="hidden lg:flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground ml-auto"
                  >
                    {showPreview ? (
                      <><EyeOff className="h-3.5 w-3.5" />Hide Preview</>
                    ) : (
                      <><Eye className="h-3.5 w-3.5" />X Preview</>
                    )}
                  </button>
                </div>

                {/* Tweet chain — uses ThreadTweetRow, NOT TweetDraftCard */}
                <div className="rounded-xl border border-border overflow-hidden">
                  {/* Editor + optional preview split */}
                  <div className={cn("flex", showPreview ? "lg:divide-x lg:divide-border/40" : "flex-col")}>
                    {/* Editor column */}
                    <div className={cn("px-4 pt-4 pb-2 space-y-0", showPreview ? "lg:w-1/2 w-full" : "w-full")}>
                      {selectedThread.items.map((draft) => (
                        <ThreadTweetRow
                          key={draft.id}
                          draft={draft}
                          xUsername={account?.xUsername ?? ""}
                          totalTweets={selectedThread.items.length}
                        />
                      ))}
                    </div>

                    {/* Live X-style preview panel */}
                    {showPreview && (
                      <div className="hidden lg:flex lg:flex-col lg:w-1/2 bg-muted/[0.03] overflow-y-auto max-h-[600px]">
                        <div className="border-b border-border/30 px-4 py-2.5 flex items-center justify-between shrink-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">X Preview</p>
                          <span className="text-[10px] text-muted-foreground/40">{selectedThread.items.length} tweets</span>
                        </div>
                        <div className="divide-y divide-border/20 overflow-y-auto">
                          {selectedThread.items.map((draft, idx) => {
                            const charCount = draft.text.length;
                            const isOver = charCount > 280;
                            const username = account?.xUsername ?? "you";
                            const initials = username.slice(0, 2).toUpperCase();
                            return (
                              <div key={draft.id} className="flex gap-3 px-4 py-3.5">
                                {/* Thread connector + avatar */}
                                <div className="flex flex-col items-center">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary/70">
                                    {initials}
                                  </div>
                                  {idx < selectedThread.items.length - 1 && (
                                    <div className="mt-1 w-px flex-1 bg-border/40" style={{ minHeight: 16 }} />
                                  )}
                                </div>
                                {/* Tweet body */}
                                <div className="min-w-0 flex-1 space-y-1.5 pb-1">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-[12px] font-bold text-foreground/90">@{username}</span>
                                    <span className="text-[10px] text-muted-foreground/40">{idx + 1}/{selectedThread.items.length}</span>
                                  </div>
                                  <p className={cn(
                                    "whitespace-pre-wrap break-words text-[12px] leading-relaxed",
                                    draft.text ? "text-foreground/80" : "text-muted-foreground/30 italic"
                                  )}>
                                    {draft.text || "Empty tweet…"}
                                  </p>
                                  {/* Char count + engagement row */}
                                  <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center gap-3 text-muted-foreground/30">
                                      <span className="flex items-center gap-1 text-[10px]"><Heart className="h-3 w-3" />0</span>
                                      <span className="flex items-center gap-1 text-[10px]"><Repeat2 className="h-3 w-3" />0</span>
                                      <span className="flex items-center gap-1 text-[10px]"><MessageCircle className="h-3 w-3" />0</span>
                                    </div>
                                    <span className={cn(
                                      "text-[10px] font-mono font-semibold",
                                      isOver ? "text-red-500" : charCount > 240 ? "text-amber-500" : "text-muted-foreground/40"
                                    )}>
                                      {charCount}/280
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error feedback */}
                  {(postMutation.error || scheduleMutation.error || unscheduleMutation.error) && (
                    <div className="mx-4 mb-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                      <p className="text-xs text-destructive">
                        {(postMutation.error as Error)?.message ??
                          (scheduleMutation.error as Error)?.message ??
                          (unscheduleMutation.error as Error)?.message}
                      </p>
                    </div>
                  )}

                  {/* Schedule datetime picker */}
                  {showScheduler && (
                    <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-3">
                      <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        type="datetime-local"
                        min={getMinScheduleDateTime()}
                        value={scheduleDateTime}
                        onChange={(e) => setScheduleDateTime(e.target.value)}
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!scheduleDateTime || !selectedThread) return;
                          scheduleMutation.mutate({
                            threadGroupId: selectedThread.groupId,
                            scheduledFor: scheduleDateTime,
                          });
                        }}
                        disabled={!scheduleDateTime || scheduleMutation.isPending}
                        className="shrink-0 gap-1.5"
                      >
                        {scheduleMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowScheduler(false);
                          setScheduleDateTime("");
                        }}
                        className="h-8 w-8 p-0 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Confirm-delete banner */}
                  {confirmDelete && (
                    <div className="flex items-center justify-between border-t border-destructive/20 bg-destructive/5 px-4 py-3">
                      <p className="text-xs text-destructive font-medium">
                        Delete this entire thread? This cannot be undone.
                      </p>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(selectedThread.groupId)}
                          disabled={deleteMutation.isPending}
                          className="gap-1.5 h-7"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(false)}
                          disabled={deleteMutation.isPending}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Thread-level action bar — ONE bar for the whole thread */}
                  {!isThreadPosted && !confirmDelete && (
                    <div
                      className={cn(
                        "flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3",
                        showScheduler && "hidden"
                      )}
                    >
                      {/* Left: Delete + Saved to Contents */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(true)}
                          disabled={isActionPending}
                          className="gap-1.5 h-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <BookmarkCheck className="h-3.5 w-3.5" />
                          Saved to Contents
                        </span>
                      </div>
                      {/* Right: Schedule + Post */}
                      <div className="flex items-center gap-2">
                        {!isThreadScheduled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowScheduler(true)}
                            disabled={isActionPending}
                            className="gap-1.5"
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            Schedule Thread
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => postMutation.mutate(selectedThread.groupId)}
                          disabled={isActionPending}
                          className="gap-1.5"
                        >
                          {postMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Post Thread
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Generate your first thread. All tweets post as a connected reply chain.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
