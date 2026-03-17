"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCheck,
  BookOpenText,
  Copy,
  ExternalLink,
  Inbox,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Tags,
  Trash2,
  UserPlus,
  Chrome,
  MousePointerClick,
  ArrowRight,
  MessageSquare,
} from "lucide-react";

import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";

type InboxStatus = "new" | "drafted" | "tracked" | "archived";
type InboxItemType = "tweet" | "thread" | "profile";

type InboxItem = {
  id: string;
  source: string;
  itemType: InboxItemType;
  sourceUrl: string;
  xEntityId: string | null;
  title: string | null;
  text: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  status: InboxStatus;
  labels: string[];
  note: string | null;
  generatedReply: string | null;
  generatedRemix: string | null;
  metadata: unknown;
  trackedAccountId: string | null;
  draftSeed: string;
  lastActionAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type InboxResponse = {
  items: InboxItem[];
  counts: Record<"all" | InboxStatus, number>;
};

function formatRelativeTime(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function sourceLabel(source: string) {
  return source.replace(/_/g, " ");
}

export default function SnipRadarInboxPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"all" | InboxStatus>("all");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLabelInput, setBulkLabelInput] = useState("");

  const inboxQuery = useQuery<InboxResponse>({
    queryKey: ["snipradar-inbox", statusFilter, search],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        status: statusFilter,
        limit: "80",
      });
      if (search.trim()) searchParams.set("q", search.trim());

      const res = await fetch(`/api/snipradar/inbox?${searchParams.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load research inbox");
      }
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const statusCards = useMemo(
    () =>
      inboxQuery.data
        ? [
            { key: "all" as const, label: "All", value: inboxQuery.data.counts.all, hint: "Total captures" },
            { key: "new" as const, label: "New", value: inboxQuery.data.counts.new, hint: "Needs review" },
            { key: "drafted" as const, label: "Drafted", value: inboxQuery.data.counts.drafted, hint: "Sent to create" },
            { key: "tracked" as const, label: "Tracked", value: inboxQuery.data.counts.tracked, hint: "Author tracked" },
          ]
        : [],
    [inboxQuery.data]
  );

  const patchItemMutation = useMutation({
    mutationFn: async (payload: { id: string; status: InboxStatus }) => {
      const res = await fetch(`/api/snipradar/inbox/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: payload.status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update inbox item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-research-index-status"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (inboxItemId: string) => {
      const res = await fetch("/api/snipradar/extension/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxItemId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate reply");
      }
      return res.json() as Promise<{ reply: string }>;
    },
    onSuccess: async (payload) => {
      await navigator.clipboard?.writeText(payload.reply);
      queryClient.invalidateQueries({ queryKey: ["snipradar-inbox"] });
      toast({
        title: "Reply copied",
        description: "Reply assist is ready to paste into X.",
      });
    },
  });

  const remixMutation = useMutation({
    mutationFn: async (inboxItemId: string) => {
      const res = await fetch("/api/snipradar/extension/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxItemId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate remix");
      }
      return res.json() as Promise<{ remix: string }>;
    },
    onSuccess: async (payload) => {
      await navigator.clipboard?.writeText(payload.remix);
      queryClient.invalidateQueries({ queryKey: ["snipradar-inbox"] });
      toast({
        title: "Remix copied",
        description: "Remixed post is ready to paste or edit.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/snipradar/inbox/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete inbox item");
      }
      return res.json();
    },
    onSuccess: () => {
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["snipradar-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-research-index-status"] });
      toast({ title: "Deleted", description: "Item permanently removed from inbox." });
    },
    onError: (error: Error) => {
      setConfirmDeleteId(null);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const trackMutation = useMutation({
    mutationFn: async (inboxItemId: string) => {
      const res = await fetch("/api/snipradar/extension/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxItemId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to track author");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-discover-data"] });
      toast({
        title: "Author tracked",
        description: "The author is now part of your SnipRadar tracked accounts.",
      });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (
      payload:
        | { action: "delete"; ids: string[] }
        | { action: "status"; ids: string[]; status: InboxStatus }
        | { action: "labels"; ids: string[]; mode: "add" | "replace"; labels: string[] }
    ) => {
      const res = await fetch("/api/snipradar/inbox/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update selected inbox items");
      }
      return data as Promise<
        | { action: "delete"; deleted: number }
        | { action: "status"; updated: number; status: InboxStatus }
        | { action: "labels"; updated: number; labels: string[]; mode: "add" | "replace" }
      >;
    },
    onSuccess: (payload) => {
      setSelectedIds([]);
      if (payload.action === "labels") {
        setBulkLabelInput("");
      }
      queryClient.invalidateQueries({ queryKey: ["snipradar-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-research-index-status"] });
      toast({
        title: "Bulk update applied",
        description:
          payload.action === "delete"
            ? `${payload.deleted} inbox item${payload.deleted === 1 ? "" : "s"} deleted.`
            : payload.action === "status"
              ? `${payload.updated} item${payload.updated === 1 ? "" : "s"} moved to ${payload.status}.`
              : `${payload.updated} item${payload.updated === 1 ? "" : "s"} updated with labels.`,
      });
    },
  });

  const items = inboxQuery.data?.items ?? [];
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const parsedBulkLabels = bulkLabelInput
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 8);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const toggleSelectedId = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !items.some((item) => item.id === id)));
      return;
    }

    setSelectedIds((current) => {
      const merged = new Set(current);
      for (const item of items) merged.add(item.id);
      return Array.from(merged);
    });
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="h-4.5 w-4.5 text-emerald-500" />
                Research Inbox
              </CardTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Captures from the SnipRadar browser extension land here first. Review them, generate a reply or remix,
                track high-signal authors, or send the idea straight into Draft Studio.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={inboxQuery.isFetching}
              onClick={() => inboxQuery.refetch()}
            >
              {inboxQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh inbox
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {statusCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setStatusFilter(card.key)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  statusFilter === card.key
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-border/70 bg-background/40"
                }`}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.hint}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/30 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search captures, handles, profiles, saved notes..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "new", "drafted", "tracked", "archived"] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={statusFilter === status ? "default" : "outline"}
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/20 p-4 text-sm text-muted-foreground">
            Load the extension from `apps/browser-extension`, sign in to SnipRadar in the same browser, then browse X.
            Saved tweets, threads, and profiles will appear here automatically.
          </div>

          {selectedIds.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCheck className="h-4 w-4 text-emerald-500" />
                    {selectedIds.length} selected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Apply one action across the current review batch instead of updating items one by one.
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                  Clear selection
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(["new", "drafted", "tracked", "archived"] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkMutation.isPending}
                    onClick={() => bulkMutation.mutate({ action: "status", ids: selectedIds, status })}
                  >
                    {status === "archived" ? "Archive" : `Mark ${status}`}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  disabled={bulkMutation.isPending}
                  onClick={() => {
                    if (!window.confirm(`Delete ${selectedIds.length} selected inbox item(s)? This cannot be undone.`)) {
                      return;
                    }
                    bulkMutation.mutate({ action: "delete", ids: selectedIds });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete selected
                </Button>
              </div>

              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Tags className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={bulkLabelInput}
                    onChange={(event) => setBulkLabelInput(event.target.value)}
                    placeholder="Add labels in bulk, comma separated"
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkMutation.isPending || parsedBulkLabels.length === 0}
                    onClick={() =>
                      bulkMutation.mutate({
                        action: "labels",
                        ids: selectedIds,
                        mode: "add",
                        labels: parsedBulkLabels,
                      })
                    }
                  >
                    Add labels
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkMutation.isPending || parsedBulkLabels.length === 0}
                    onClick={() =>
                      bulkMutation.mutate({
                        action: "labels",
                        ids: selectedIds,
                        mode: "replace",
                        labels: parsedBulkLabels,
                      })
                    }
                  >
                    Replace labels
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {inboxQuery.error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {(inboxQuery.error as Error).message}
            </div>
          ) : null}
          {bulkMutation.error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {(bulkMutation.error as Error).message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {inboxQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading research inbox...
          </CardContent>
        </Card>
      ) : null}

      {!inboxQuery.isLoading && items.length === 0 ? (
        <div className="space-y-4">
          <SnipRadarEmptyState
            icon={Inbox}
            title="Research Inbox is empty"
            description="Use the SnipRadar browser extension on X.com to save tweets, profiles, and threads into a review queue."
            hint="Captured items land here first — remix them, generate replies, track authors, or push ideas straight into Draft Studio."
          />

          {/* Step-by-step onboarding guide */}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary/60 shrink-0" />
              <p className="text-sm font-semibold text-foreground/80">How to fill your Research Inbox</p>
            </div>

            <ol className="space-y-3">
              {[
                {
                  icon: Chrome,
                  step: "1",
                  title: "Install the SnipRadar browser extension",
                  body: "Get it from the Chrome Web Store — works on X.com and Twitter.com.",
                  action: { label: "Get Extension", href: "https://chrome.google.com/webstore" },
                },
                {
                  icon: MousePointerClick,
                  step: "2",
                  title: "Browse X and save anything interesting",
                  body: "On any tweet or profile, press Alt+S or click the SnipRadar icon to capture it.",
                  action: null,
                },
                {
                  icon: MessageSquare,
                  step: "3",
                  title: "Review captures here and take action",
                  body: "Generate a remix, draft a reply, track the author, or send the idea to your Draft Studio.",
                  action: null,
                },
              ].map(({ icon: Icon, step, title, body, action }) => (
                <li key={step} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary/70">
                    {step}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground/80">{title}</p>
                      {action && (
                        <a
                          href={action.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[11px] font-semibold text-primary/70 hover:bg-primary/[0.14] transition-colors"
                        >
                          {action.label}
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/60">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5 flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-violet-400" />
              <p className="text-xs text-muted-foreground/70">
                <span className="font-semibold text-foreground/70">Pro tip:</span> Save 5–10 tweets from your niche to prime the AI. The more you capture, the better your reply and remix suggestions become.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/20 px-4 py-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              className="h-4 w-4 accent-emerald-500"
            />
            <span>Select all visible captures</span>
          </div>

          {items.map((item) => (
            <Card key={item.id} className="border-border/70 bg-card/80">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelectedId(item.id)}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <p className="text-sm font-semibold">
                        {item.title ?? (item.authorUsername ? `Capture from @${item.authorUsername}` : "Saved capture")}
                      </p>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {item.itemType}
                      </Badge>
                      <Badge variant={item.status === "new" ? "default" : "outline"} className="text-[10px] capitalize">
                        {item.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {sourceLabel(item.source)}
                      </Badge>
                    </div>

                    {(item.authorUsername || item.authorDisplayName) ? (
                      <p className="text-xs text-muted-foreground">
                        {item.authorDisplayName ?? "Unknown author"}
                        {item.authorUsername ? ` · @${item.authorUsername}` : ""}
                      </p>
                    ) : null}

                    {item.text ? (
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {item.text}
                      </p>
                    ) : null}

                    {item.note ? (
                      <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-sm text-muted-foreground">
                        {item.note}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      {item.labels.map((label) => (
                        <Badge key={`${item.id}-${label}`} variant="outline" className="text-[10px]">
                          {label}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid gap-3 xl:grid-cols-2">
                      {item.generatedReply ? (
                        <div className="rounded-xl border border-border/70 bg-background/20 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">Reply assist</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={async () => {
                                await navigator.clipboard?.writeText(item.generatedReply ?? "");
                                toast({
                                  title: "Reply copied",
                                  description: "Reply assist is ready to paste into X.",
                                });
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </Button>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{item.generatedReply}</p>
                        </div>
                      ) : null}

                      {item.generatedRemix ? (
                        <div className="rounded-xl border border-border/70 bg-background/20 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">Remix</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={async () => {
                                await navigator.clipboard?.writeText(item.generatedRemix ?? "");
                                toast({
                                  title: "Remix copied",
                                  description: "The remixed post is ready for Draft Studio or X.",
                                });
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </Button>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{item.generatedRemix}</p>
                        </div>
                      ) : null}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Captured {formatRelativeTime(item.updatedAt)}
                      {item.lastActionAt ? ` · last action ${formatRelativeTime(item.lastActionAt)}` : ""}
                    </p>
                  </div>

                  <div className="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[220px]">
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.localStorage.setItem("snipradar:remixDraftSeed", item.generatedRemix ?? item.draftSeed);
                        }
                        patchItemMutation.mutate({ id: item.id, status: "drafted" });
                        trackSnipRadarEvent("snipradar_inbox_seed_draft", { itemType: item.itemType });
                        router.push("/snipradar/create/drafts");
                      }}
                    >
                      <BookOpenText className="h-4 w-4" />
                      Use in Draft Studio
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={replyMutation.isPending}
                      onClick={() => replyMutation.mutate(item.id)}
                    >
                      {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Generate reply
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={remixMutation.isPending}
                      onClick={() => remixMutation.mutate(item.id)}
                    >
                      {remixMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Generate remix
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={!item.authorUsername || trackMutation.isPending}
                      onClick={() => trackMutation.mutate(item.id)}
                    >
                      {trackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      Track author
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        patchItemMutation.mutate({
                          id: item.id,
                          status: item.status === "archived" ? "new" : "archived",
                        })
                      }
                    >
                      <Archive className="h-4 w-4" />
                      {item.status === "archived" ? "Restore" : "Archive"}
                    </Button>

                    {confirmDeleteId === item.id ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          className="flex-1 gap-2"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Confirm delete
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
                        onClick={() => setConfirmDeleteId(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    )}

                    <Button asChild type="button" variant="ghost" className="gap-2 justify-start px-0">
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open on X
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
