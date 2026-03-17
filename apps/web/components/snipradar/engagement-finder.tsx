"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircleMore,
  MessageSquare,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Heart,
  Repeat2,
  MessageCircle,
  Sparkles,
  BookmarkPlus,
  CheckCircle2,
  EyeOff,
  Search,
  ChevronDown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseServerTimingMs } from "@/lib/server-timing";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";
import { getSnipRadarBillingGateDetails } from "@/lib/snipradar/billing-gates";
import {
  parseSnipRadarApiError,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";

type OpportunityStatus = "new" | "saved" | "replied" | "ignored";
type SortBy = "score" | "recent" | "engagement";

interface Conversation {
  id: string;
  tweetId: string;
  text: string;
  authorUsername: string;
  authorName: string;
  authorAvatar?: string;
  score: number;
  status: OpportunityStatus;
  replyCount: number;
  metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    impression_count: number;
  };
  createdAt: string;
}

interface EngagementResponse {
  niche: string;
  sortBy: SortBy;
  minScore: number;
  q: string;
  counts: {
    all: number;
    new: number;
    saved: number;
    replied: number;
    ignored: number;
  };
  conversations: Conversation[];
  paging: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

const PAGE_SIZE = 10;

/* ── Score badge ────────────────────────────────────────── */
function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : score >= 60
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : score >= 40
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-muted/50 dark:bg-white/[0.05] text-muted-foreground/40 border-border/40 dark:border-white/[0.06]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
        cls,
      )}
    >
      {score}
    </span>
  );
}

/* ── Status badge ───────────────────────────────────────── */
const STATUS_STYLE: Record<OpportunityStatus, string> = {
  new: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  saved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  replied: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  ignored: "bg-muted/50 dark:bg-white/[0.05] text-muted-foreground/40 border-border/40 dark:border-white/[0.06]",
};

function StatusBadge({ status }: { status: OpportunityStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
        STATUS_STYLE[status],
      )}
    >
      {status}
    </span>
  );
}

export function EngagementFinder() {
  const queryClient = useQueryClient();
  const [selectedTweet, setSelectedTweet] = useState<Conversation | null>(null);
  const [replies, setReplies] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [niche, setNiche] = useState("tech");
  const [status, setStatus] = useState<"all" | OpportunityStatus>("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [minScore, setMinScore] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastFetchMs, setLastFetchMs] = useState<number | null>(null);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [niche, status, sortBy, minScore, debouncedQ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const normalizedNiche = useMemo(() => {
    const value = niche.trim().toLowerCase();
    return value.length > 0 ? value : "tech";
  }, [niche]);

  const { data, isLoading, error, isFetching } = useQuery<EngagementResponse>({
    queryKey: ["snipradar-engagement", normalizedNiche, status, page, sortBy, minScore, debouncedQ],
    queryFn: async () => {
      const params = new URLSearchParams({
        niche: normalizedNiche,
        status,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        minScore: String(minScore),
      });
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/snipradar/engagement?${params.toString()}`);
      const timingMs = parseServerTimingMs(res.headers.get("Server-Timing"));
      if (typeof timingMs === "number") setLastFetchMs(Math.round(timingMs));
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to fetch engagement opportunities");
      }
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ niche: normalizedNiche, refresh: "true" });
      const res = await fetch(`/api/snipradar/engagement?${params.toString()}`);
      if (!res.ok) throw await parseSnipRadarApiError(res, "Failed to refresh opportunities");
      return res.json();
    },
    onSuccess: (payload: EngagementResponse) => {
      if (payload?.niche && payload.niche !== normalizedNiche) setNiche(payload.niche);
      queryClient.invalidateQueries({ queryKey: ["snipradar-engagement"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: OpportunityStatus }) => {
      const res = await fetch(`/api/snipradar/engagement/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to update status");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-engagement"] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, nextStatus }: { ids: string[]; nextStatus: OpportunityStatus }) => {
      const res = await fetch("/api/snipradar/engagement/opportunities/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: nextStatus }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to bulk update status");
      return payload;
    },
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["snipradar-engagement"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (tweet: Conversation) => {
      const res = await fetch("/api/snipradar/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetText: tweet.text,
          authorUsername: tweet.authorUsername,
          niche: data?.niche ?? niche,
          opportunityId: tweet.id,
          tweetId: tweet.tweetId,
        }),
      });
      if (!res.ok) throw await parseSnipRadarApiError(res, "Failed to generate replies");
      return res.json();
    },
    onSuccess: (payload) => {
      setReplies(payload.replies ?? []);
      queryClient.invalidateQueries({ queryKey: ["snipradar-engagement"] });
    },
  });

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) return `${Math.max(1, Math.floor(diff / (60 * 1000)))}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const items = useMemo(() => data?.conversations ?? [], [data?.conversations]);
  const total = data?.paging.total ?? 0;
  const hasMore = data?.paging.hasMore ?? false;
  const currentPage = data?.paging.page ?? page;
  const counts = data?.counts;
  const gateDetails = getSnipRadarBillingGateDetails(
    toSnipRadarApiError(
      error ?? refreshMutation.error ?? replyMutation.error ?? null,
      "Failed to load engagement opportunities"
    )
  );
  const statusCountLabel = useMemo(() => `${items.length}/${total}`, [items.length, total]);
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  useEffect(() => {
    if (!selectedTweet) return;
    if (!items.some((item) => item.id === selectedTweet.id)) {
      setSelectedTweet(null);
      setReplies([]);
    }
  }, [items, selectedTweet]);

  const toggleSelectedId = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !items.some((item) => item.id === id)));
      return;
    }
    setSelectedIds((prev) => {
      const merged = new Set(prev);
      for (const item of items) merged.add(item.id);
      return Array.from(merged);
    });
  };

  /* ── shared select style ────────────────────────────────── */
  const glassSelect =
    "h-9 appearance-none rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] pl-3 pr-7 text-[12px] text-foreground/70 outline-none focus:ring-1 focus:ring-cyan-500/40 transition-colors cursor-pointer";

  const STATUS_FILTER_ITEMS = [
    { key: "all", label: "All", count: counts?.all ?? 0 },
    { key: "new", label: "New", count: counts?.new ?? 0 },
    { key: "saved", label: "Saved", count: counts?.saved ?? 0 },
    { key: "replied", label: "Replied", count: counts?.replied ?? 0 },
    { key: "ignored", label: "Ignored", count: counts?.ignored ?? 0 },
  ] as const;

  const STATUS_ACTIVE: Record<string, string> = {
    all: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
    new: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    saved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    replied: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    ignored: "bg-muted/60 dark:bg-white/[0.07] text-foreground/60 border-border/70 dark:border-white/[0.10]",
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 dark:border-white/[0.07] bg-gradient-to-br from-muted/30 dark:from-white/[0.03] to-transparent">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/40 dark:border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15">
            <MessageSquare className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
              Engagement Finder
            </p>
            <p className="text-[11px] text-muted-foreground/50">
              Find &amp; reply to conversations in your niche
            </p>
          </div>

          {/* Count + latency chips */}
          <div className="flex items-center gap-1.5 ml-1">
            <span className="rounded-full border border-border/50 dark:border-white/[0.07] bg-muted/40 dark:bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground/60">
              {statusCountLabel}
            </span>
            {lastFetchMs !== null && (
              <span className="rounded-full border border-border/40 dark:border-white/[0.06] bg-muted/30 dark:bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground/35">
                {lastFetchMs}ms
              </span>
            )}
          </div>
        </div>

        {/* Refresh Source */}
        <button
          type="button"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh Source
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="space-y-3 border-b border-border/30 dark:border-white/[0.05] px-5 py-4">
        {/* 4-col input row */}
        <div className="grid gap-2 md:grid-cols-4">
          {/* Niche keyword */}
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onBlur={() => setNiche(normalizedNiche)}
            placeholder="Niche keyword…"
            className="h-9 rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-3 text-[12px] text-foreground/70 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-cyan-500/40 transition-colors"
          />

          {/* Search input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search text or author…"
              className="h-9 w-full rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] pl-8 pr-3 text-[12px] text-foreground/70 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-cyan-500/40 transition-colors"
            />
          </div>

          {/* Sort select */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className={cn(glassSelect, "w-full")}
            >
              <option value="score">Sort: Opportunity score</option>
              <option value="engagement">Sort: Engagement</option>
              <option value="recent">Sort: Most recent</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-muted-foreground/40" />
          </div>

          {/* Min score select */}
          <div className="relative">
            <select
              value={String(minScore)}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className={cn(glassSelect, "w-full")}
            >
              <option value="0">Min score: Any</option>
              <option value="40">Min score: 40+</option>
              <option value="60">Min score: 60+</option>
              <option value="80">Min score: 80+</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-muted-foreground/40" />
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTER_ITEMS.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[12px] font-semibold transition-all",
                status === key
                  ? STATUS_ACTIVE[key]
                  : "border-border/50 dark:border-white/[0.07] text-muted-foreground/50 hover:text-muted-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  status === key ? "opacity-70" : "opacity-40",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Hint */}
        <p className="text-[11px] text-muted-foreground/40">
          Ranked by opportunity score. Save, ignore, or mark replied to keep your queue clean.
        </p>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/30 dark:border-white/[0.05] bg-muted/20 dark:bg-white/[0.02] px-5 py-3">
          <span className="text-[12px] font-semibold text-foreground/60">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={bulkUpdateMutation.isPending}
              onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, nextStatus: "saved" })}
              className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1 text-[11px] font-semibold text-emerald-400 transition-all hover:bg-emerald-500/15 disabled:opacity-40"
            >
              <BookmarkPlus className="h-3 w-3" />
              Save
            </button>
            <button
              type="button"
              disabled={bulkUpdateMutation.isPending}
              onClick={() =>
                bulkUpdateMutation.mutate({ ids: selectedIds, nextStatus: "replied" })
              }
              className="flex items-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/[0.08] px-3 py-1 text-[11px] font-semibold text-violet-400 transition-all hover:bg-violet-500/15 disabled:opacity-40"
            >
              <CheckCircle2 className="h-3 w-3" />
              Replied
            </button>
            <button
              type="button"
              disabled={bulkUpdateMutation.isPending}
              onClick={() =>
                bulkUpdateMutation.mutate({ ids: selectedIds, nextStatus: "ignored" })
              }
              className="flex items-center gap-1 rounded-lg border border-border/50 dark:border-white/[0.07] bg-muted/30 dark:bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-muted-foreground/50 transition-all hover:border-red-500/20 hover:bg-red-500/[0.07] hover:text-red-400 disabled:opacity-40"
            >
              <EyeOff className="h-3 w-3" />
              Ignore
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Error states ─────────────────────────────────────── */}
      {gateDetails ? (
        <div className="mx-5 mt-4">
          <SnipRadarBillingGateCard details={gateDetails} compact />
        </div>
      ) : null}
      {(error || refreshMutation.error || bulkUpdateMutation.error) && !gateDetails ? (
        <div className="mx-5 mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3.5 py-2.5 text-xs text-red-400">
          {((error ?? refreshMutation.error ?? bulkUpdateMutation.error) as Error).message}
        </div>
      ) : null}

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-3">
        {isLoading || isFetching ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            Loading opportunities…
          </div>
        ) : items.length === 0 ? (
          <SnipRadarEmptyState
            icon={MessageCircleMore}
            eyebrow="Engagement"
            title="No reply opportunities are queued yet"
            description="Refresh the source to pull live niche conversations, rank them by opportunity, and keep the best ones ready for response."
            hint="The tighter the niche term, the cleaner your reply queue will be."
            primaryAction={{
              label: refreshMutation.isPending ? "Refreshing..." : "Refresh source",
              onClick: () => refreshMutation.mutate(),
              disabled: refreshMutation.isPending,
            }}
          />
        ) : (
          <>
            {/* Select all row */}
            <div className="flex items-center gap-2.5 rounded-xl border border-border/40 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] px-3.5 py-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="h-3.5 w-3.5 accent-cyan-500"
              />
              <span className="text-[11px] text-muted-foreground/50">Select all on this page</span>
            </div>

            {/* Conversation cards */}
            {items.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "cursor-pointer overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/30 dark:from-white/[0.03] to-transparent transition-all hover:from-muted/50 dark:from-white/[0.05]",
                  selectedTweet?.id === conv.id
                    ? "border-cyan-500/30 from-cyan-500/[0.04]"
                    : "border-border/50 dark:border-white/[0.07] hover:border-border/80 dark:border-white/[0.12]",
                )}
                onClick={() => {
                  if (selectedTweet?.id === conv.id) {
                    setSelectedTweet(null);
                    setReplies([]);
                  } else {
                    setSelectedTweet(conv);
                    setReplies([]);
                  }
                }}
              >
                <div className="space-y-3 p-4">
                  {/* Author + text row */}
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(conv.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelectedId(conv.id)}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-cyan-500"
                    />

                    {/* Avatar */}
                    {conv.authorAvatar ? (
                      <Image
                        src={conv.authorAvatar}
                        alt={conv.authorUsername}
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/[0.07]"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-white/[0.07]">
                        <span className="text-xs font-bold text-cyan-300">
                          {conv.authorUsername[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {/* Name row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold">{conv.authorName}</span>
                        <span className="text-[11px] text-muted-foreground/45">
                          @{conv.authorUsername}
                        </span>
                        <span className="text-[11px] text-muted-foreground/30">
                          · {formatTime(conv.createdAt)}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <ScoreBadge score={conv.score} />
                          <StatusBadge status={conv.status} />
                        </div>
                      </div>

                      {/* Tweet text */}
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">
                        {conv.text}
                      </p>
                    </div>
                  </div>

                  {/* Metrics + view link */}
                  {conv.metrics && (
                    <div className="flex items-center gap-3 pl-[52px]">
                      <span className="flex items-center gap-1 text-[11px] text-rose-400/60">
                        <Heart className="h-3 w-3" />
                        {conv.metrics.like_count.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400/60">
                        <Repeat2 className="h-3 w-3" />
                        {conv.metrics.retweet_count.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-blue-400/60">
                        <MessageCircle className="h-3 w-3" />
                        {conv.metrics.reply_count.toLocaleString()}
                      </span>
                      <a
                        href={`https://x.com/${conv.authorUsername}/status/${conv.tweetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </a>
                    </div>
                  )}

                  {/* Per-card action buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pl-[52px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStatusMutation.mutate({ id: conv.id, nextStatus: "saved" });
                      }}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition-all hover:bg-emerald-500/15"
                    >
                      <BookmarkPlus className="h-3 w-3" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStatusMutation.mutate({ id: conv.id, nextStatus: "replied" });
                      }}
                      className="flex items-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/[0.07] px-2.5 py-1 text-[11px] font-semibold text-violet-400 transition-all hover:bg-violet-500/15"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Replied
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStatusMutation.mutate({ id: conv.id, nextStatus: "ignored" });
                      }}
                      className="flex items-center gap-1 rounded-lg border border-border/40 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground/40 transition-all hover:border-red-500/20 hover:bg-red-500/[0.07] hover:text-red-400"
                    >
                      <EyeOff className="h-3 w-3" />
                      Ignore
                    </button>
                  </div>
                </div>

                {/* Expanded reply generator */}
                {selectedTweet?.id === conv.id && (
                  <div
                    className="space-y-3 border-t border-border/30 dark:border-white/[0.05] bg-white/[0.01] p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Generate button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        replyMutation.mutate(conv);
                      }}
                      disabled={replyMutation.isPending}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-[12px] font-semibold text-white transition-all hover:from-purple-600 hover:to-pink-600 hover:shadow-lg hover:shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {replyMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {replyMutation.isPending ? "Generating…" : "Generate Replies"}
                    </button>

                    {replyMutation.error && (
                      <p className="text-xs text-red-400">
                        {(replyMutation.error as Error).message}
                      </p>
                    )}

                    {/* Generated reply cards */}
                    {replies.length > 0 && (
                      <div className="space-y-2">
                        {replies.map((reply, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-xl border border-border/50 dark:border-white/[0.07] bg-muted/20 dark:bg-white/[0.02] p-3"
                          >
                            <p className="flex-1 text-sm leading-relaxed text-foreground/75">
                              {reply}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopy(reply, i)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/50 dark:border-white/[0.07] bg-muted/40 dark:bg-white/[0.04] text-muted-foreground/40 transition-all hover:border-emerald-500/20 hover:bg-emerald-500/[0.07] hover:text-emerald-400"
                              aria-label="Copy reply"
                            >
                              {copiedIdx === i ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-4 py-1.5 text-[12px] font-medium text-muted-foreground/60 transition-all hover:bg-muted/60 dark:bg-white/[0.07] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-[11px] text-muted-foreground/40">Page {currentPage}</span>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-4 py-1.5 text-[12px] font-medium text-muted-foreground/60 transition-all hover:bg-muted/60 dark:bg-white/[0.07] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
