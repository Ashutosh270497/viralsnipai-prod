"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookmarkCheck,
  CalendarClock,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface TweetItem {
  id: string;
  text: string;
  format: string | null;
  hookType: string | null;
  status: string;
  scheduledFor: string | null;
  postedAt: string | null;
  postedTweetId: string | null;
  viralPrediction: number | null;
  createdAt: string;
  threadGroupId?: string;
  threadOrder?: number;
}

interface ThreadGroup {
  groupId: string;
  status: string;
  scheduledFor: string | null;
  tweets: TweetItem[];
  createdAt: string;
}

interface ContentsData {
  threads: ThreadGroup[];
  singlePosts: TweetItem[];
}

type FilterPill = "all" | "threads" | "posts";

// ── Helpers ────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "posted":
      return (
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
          Posted
        </Badge>
      );
    case "scheduled":
      return (
        <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px]">
          Scheduled
        </Badge>
      );
    case "draft":
      return (
        <Badge variant="outline" className="text-muted-foreground text-[10px]">
          Draft
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          {status}
        </Badge>
      );
  }
}

function formatTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${Math.max(1, diffMin)}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ── Thread Card ────────────────────────────────────────────────────────────

function ThreadCard({
  group,
  xUsername,
  onDeleted,
  onScheduled,
}: {
  group: ThreadGroup;
  xUsername: string;
  onDeleted: (groupId: string) => void;
  onScheduled: (scheduledFor: string) => void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/snipradar/threads/${encodeURIComponent(group.groupId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-contents"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      onDeleted(group.groupId);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (scheduledFor: string) => {
      const res = await fetch("/api/snipradar/threads/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadGroupId: group.groupId, scheduledFor }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to schedule thread");
      }
      return res.json();
    },
    onSuccess: (_data, scheduledFor) => {
      setShowScheduler(false);
      setScheduleDateTime("");
      queryClient.invalidateQueries({ queryKey: ["snipradar-contents"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-queue"] });
      onScheduled(scheduledFor);
    },
  });

  const isPosted = group.status === "posted";
  const isScheduled = group.status === "scheduled";
  const hook = group.tweets[0]?.text ?? "";
  const rootTweetId = group.tweets[0]?.postedTweetId;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <MessageSquareText className="h-3 w-3" />
              Thread · {group.tweets.length} tweets
            </span>
            {statusBadge(group.status)}
            <span className="text-[10px] text-muted-foreground">{formatTime(group.createdAt)}</span>
          </div>
          <p className="text-sm text-foreground line-clamp-2 leading-snug">{hook}</p>
          {isScheduled && group.scheduledFor && (
            <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {new Date(group.scheduledFor).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
          {isPosted && rootTweetId && xUsername && (
            <a
              href={`https://x.com/${xUsername}/status/${rootTweetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on X
            </a>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] px-2 text-muted-foreground"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Collapse" : "Expand"}
          </Button>
          {!isPosted && !isScheduled && !confirmDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground gap-1"
              onClick={() => setShowScheduler((s) => !s)}
            >
              <CalendarClock className="h-3 w-3" />
              Schedule
            </Button>
          )}
          {!isPosted && !confirmDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Inline schedule picker */}
      {showScheduler && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
          <input
            type="datetime-local"
            min={(() => {
              const now = new Date();
              now.setMinutes(now.getMinutes() + 5);
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            })()}
            value={scheduleDateTime}
            onChange={(e) => setScheduleDateTime(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            className="h-7 gap-1 text-[11px] shrink-0"
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
            onClick={() => {
              setShowScheduler(false);
              setScheduleDateTime("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {scheduleMutation.error && (
        <div className="px-3 pb-2">
          <p className="text-xs text-destructive">
            {(scheduleMutation.error as Error).message}
          </p>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="flex items-center justify-between border-t border-destructive/20 bg-destructive/5 px-3 py-2">
          <p className="text-xs text-destructive">Delete this thread permanently?</p>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 text-[11px] gap-1"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px]"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Expanded tweet list */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border/50">
          {group.tweets.map((tweet, idx) => (
            <div key={tweet.id} className="px-3 py-2 flex gap-2">
              <span className="text-[10px] text-muted-foreground w-5 shrink-0 pt-0.5">{idx + 1}.</span>
              <p className="text-xs text-foreground leading-relaxed">{tweet.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single Post Card ───────────────────────────────────────────────────────

function SinglePostCard({
  post,
  xUsername,
  onDeleted,
  onScheduled,
}: {
  post: TweetItem;
  xUsername: string;
  onDeleted: (id: string) => void;
  onScheduled: (scheduledFor: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/snipradar/drafts/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-contents"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      onDeleted(post.id);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (scheduledFor: string) => {
      const res = await fetch(`/api/snipradar/drafts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled", scheduledFor }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to schedule post");
      }
      return res.json();
    },
    onSuccess: (_data, scheduledFor) => {
      setShowScheduler(false);
      setScheduleDateTime("");
      queryClient.invalidateQueries({ queryKey: ["snipradar-contents"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-queue"] });
      onScheduled(scheduledFor);
    },
  });

  const isPosted = post.status === "posted";
  const isScheduled = post.status === "scheduled";

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <FileText className="h-3 w-3" />
              Post
            </span>
            {statusBadge(post.status)}
            {post.viralPrediction != null && (
              <span className="text-[10px] text-muted-foreground">score {post.viralPrediction}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{formatTime(post.createdAt)}</span>
          </div>
          <p className="text-sm text-foreground line-clamp-3 leading-snug">{post.text}</p>
          {post.scheduledFor && post.status === "scheduled" && (
            <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {new Date(post.scheduledFor).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
          {isPosted && post.postedTweetId && xUsername && (
            <a
              href={`https://x.com/${xUsername}/status/${post.postedTweetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on X
            </a>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isPosted && !isScheduled && !confirmDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground gap-1"
              onClick={() => setShowScheduler((s) => !s)}
            >
              <CalendarClock className="h-3 w-3" />
              Schedule
            </Button>
          )}
          {!isPosted && !confirmDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Inline schedule picker */}
      {showScheduler && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
          <input
            type="datetime-local"
            min={(() => {
              const now = new Date();
              now.setMinutes(now.getMinutes() + 5);
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            })()}
            value={scheduleDateTime}
            onChange={(e) => setScheduleDateTime(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            className="h-7 gap-1 text-[11px] shrink-0"
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
            onClick={() => {
              setShowScheduler(false);
              setScheduleDateTime("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {scheduleMutation.error && (
        <div className="px-3 pb-2">
          <p className="text-xs text-destructive">
            {(scheduleMutation.error as Error).message}
          </p>
        </div>
      )}

      {confirmDelete && (
        <div className="flex items-center justify-between border-t border-destructive/20 bg-destructive/5 px-3 py-2">
          <p className="text-xs text-destructive">Delete this draft permanently?</p>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 text-[11px] gap-1"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px]"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ContentsTab ───────────────────────────────────────────────────────

export function ContentsTab() {
  const router = useRouter();
  const { account } = useSnipRadar();
  const [filter, setFilter] = useState<FilterPill>("all");
  const [deletedThreadIds, setDeletedThreadIds] = useState<Set<string>>(new Set());
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(new Set());
  // Part D — schedule banner
  const [scheduleBanner, setScheduleBanner] = useState<{ scheduledFor: string } | null>(null);

  const { data, isLoading } = useQuery<ContentsData>({
    queryKey: ["snipradar-contents"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/contents");
      if (!res.ok) throw new Error("Failed to fetch contents");
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const threads = (data?.threads ?? []).filter((t) => !deletedThreadIds.has(t.groupId));
  const singlePosts = (data?.singlePosts ?? []).filter((p) => !deletedPostIds.has(p.id));

  const totalCount = threads.length + singlePosts.length;
  const xUsername = account?.xUsername ?? "";

  const filterPills: { key: FilterPill; label: string; count: number }[] = [
    { key: "all", label: "All", count: totalCount },
    { key: "threads", label: "Threads", count: threads.length },
    { key: "posts", label: "Posts", count: singlePosts.length },
  ];

  const showThreads = filter === "all" || filter === "threads";
  const showPosts = filter === "all" || filter === "posts";

  const isEmpty =
    !isLoading &&
    ((filter === "all" && totalCount === 0) ||
      (filter === "threads" && threads.length === 0) ||
      (filter === "posts" && singlePosts.length === 0));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4 text-muted-foreground" />
            Contents
            <span className="text-xs font-normal text-muted-foreground">
              Last 30 days
            </span>
          </CardTitle>
          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {filterPills.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setFilter(pill.key)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === pill.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {pill.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    filter === pill.key ? "bg-background/20" : "bg-muted"
                  )}
                >
                  {pill.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Part D — Schedule success banner */}
        {scheduleBanner && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              Scheduled for{" "}
              {new Date(scheduleBanner.scheduledFor).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <a
                href="/snipradar/publish/scheduler"
                className="text-xs text-amber-700 dark:text-amber-400 underline underline-offset-2 flex items-center gap-1 hover:opacity-80"
              >
                View in Scheduler
                <ArrowRight className="h-3 w-3" />
              </a>
              <button
                onClick={() => setScheduleBanner(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading contents...
          </div>
        )}

        {isEmpty && !isLoading && filter === "all" && (
          <SnipRadarEmptyState
            icon={BookmarkCheck}
            eyebrow="Contents"
            title="Your content library is empty"
            description="Threads you build and posts you generate save here automatically — organized in one place."
            primaryAction={{
              label: "Write a thread",
              onClick: () => router.push("/snipradar/create/threads"),
            }}
            secondaryAction={{
              label: "Generate a draft",
              onClick: () => router.push("/snipradar/create/drafts"),
            }}
          />
        )}

        {isEmpty && !isLoading && filter === "threads" && (
          <SnipRadarEmptyState
            icon={MessageSquareText}
            eyebrow="Threads"
            title="No threads saved yet"
            description="Use the Thread Builder to write multi-tweet threads. They save here automatically once generated."
            primaryAction={{
              label: "Open Thread Builder",
              onClick: () => router.push("/snipradar/create/threads"),
            }}
          />
        )}

        {isEmpty && !isLoading && filter === "posts" && (
          <SnipRadarEmptyState
            icon={FileText}
            eyebrow="Posts"
            title="No single posts saved yet"
            description="Generate drafts or write in the Draft Studio — they land here automatically."
            primaryAction={{
              label: "Open Draft Studio",
              onClick: () => router.push("/snipradar/create/drafts"),
            }}
          />
        )}

        {/* Thread groups */}
        {showThreads && threads.length > 0 && (
          <div className="space-y-2">
            {filter === "all" && singlePosts.length > 0 && (
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-1">
                Threads ({threads.length})
              </p>
            )}
            {threads.map((group) => (
              <ThreadCard
                key={group.groupId}
                group={group}
                xUsername={xUsername}
                onDeleted={(id) => setDeletedThreadIds((prev) => new Set([...prev, id]))}
                onScheduled={(scheduledFor) => setScheduleBanner({ scheduledFor })}
              />
            ))}
          </div>
        )}

        {/* Single posts */}
        {showPosts && singlePosts.length > 0 && (
          <div className="space-y-2">
            {filter === "all" && threads.length > 0 && (
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-1 pt-1">
                Posts ({singlePosts.length})
              </p>
            )}
            {singlePosts.map((post) => (
              <SinglePostCard
                key={post.id}
                post={post}
                xUsername={xUsername}
                onDeleted={(id) => setDeletedPostIds((prev) => new Set([...prev, id]))}
                onScheduled={(scheduledFor) => setScheduleBanner({ scheduledFor })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
