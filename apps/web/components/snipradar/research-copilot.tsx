"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  Lightbulb,
  Loader2,
  MessagesSquare,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { Input } from "@/components/ui/input";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";
import { useToast } from "@/components/ui/use-toast";
import { getSnipRadarBillingGateDetails } from "@/lib/snipradar/billing-gates";
import {
  parseSnipRadarApiError,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import { cn } from "@/lib/utils";

type ResearchItem = {
  id: string;
  source:
    | "viral_tweet"
    | "opportunity"
    | "draft"
    | "template"
    | "hooksmith_script"
    | "content_idea"
    | "inbox_capture";
  title: string;
  body: string;
  meta: string[];
  score: number;
  matchReasons: string[];
  draftSeed: string;
  sourceUpdatedAt: string | null;
};

type ResearchSynthesis = {
  source: "ai" | "heuristic_fallback";
  answer: string;
  keyThemes: string[];
  recommendedAngles: string[];
  suggestedFormats: string[];
  draftStarter: string;
  citations: Array<{
    id: string;
    source: ResearchItem["source"];
    title: string;
    reason: string;
  }>;
};

type ResearchIndexStatus = {
  state: "empty" | "ready" | "stale" | "error";
  isStale: boolean;
  totalDocuments: number;
  counts: {
    viralTweets: number;
    opportunities: number;
    drafts: number;
    templates: number;
    hooksmithScripts: number;
    contentIdeas: number;
    inboxCaptures: number;
    total: number;
  };
  embeddedDocuments: number;
  usingEmbeddings: boolean;
  lastIndexedAt: string | null;
  lastRunStatus: "success" | "partial" | "failed" | null;
  lastErrorSummary: string | null;
  staleAfterMs: number;
};

type ResearchResponse = {
  query: string;
  summary: string;
  synthesis: ResearchSynthesis | null;
  resultCounts: {
    viralTweets: number;
    opportunities: number;
    drafts: number;
    templates: number;
    hooksmithScripts: number;
    contentIdeas: number;
    inboxCaptures: number;
    total: number;
  };
  indexStatus: ResearchIndexStatus;
  groups: {
    viralTweets: ResearchItem[];
    opportunities: ResearchItem[];
    drafts: ResearchItem[];
    templates: ResearchItem[];
    hooksmithScripts: ResearchItem[];
    contentIdeas: ResearchItem[];
    inboxCaptures: ResearchItem[];
  };
};

const SOURCE_CONFIG = {
  viralTweets: {
    label: "Viral Tweets",
    icon: Sparkles,
  },
  opportunities: {
    label: "Opportunities",
    icon: MessagesSquare,
  },
  drafts: {
    label: "Your Drafts",
    icon: FileText,
  },
  templates: {
    label: "Templates",
    icon: Lightbulb,
  },
  hooksmithScripts: {
    label: "Hooksmith Scripts",
    icon: BookOpenText,
  },
  contentIdeas: {
    label: "Content Ideas",
    icon: Sparkles,
  },
  inboxCaptures: {
    label: "Inbox Captures",
    icon: MessagesSquare,
  },
} as const;

function formatRelativeTime(isoDate?: string | null) {
  if (!isoDate) return "Never";
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

function statusBadgeVariant(status: ResearchIndexStatus["state"]) {
  if (status === "ready") return "default";
  if (status === "stale") return "secondary";
  if (status === "error") return "warning";
  return "outline";
}

function sourceLabel(source: ResearchItem["source"]) {
  return source.replace(/_/g, " ");
}

export function ResearchCopilot({
  onUseDraftSeed,
}: {
  onUseDraftSeed: (seed: string, source: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { counts, profile } = useSnipRadar();

  const statusQuery = useQuery<ResearchIndexStatus>({
    queryKey: ["snipradar-research-index-status"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/research/index");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load corpus status");
      }
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const searchMutation = useMutation({
    mutationFn: async (rawQuery: string) => {
      const res = await fetch("/api/snipradar/research/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: rawQuery }),
      });
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to search research");
      }
      return res.json() as Promise<ResearchResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["snipradar-research-index-status"], data.indexStatus);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/research/index", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to refresh research corpus");
      }
      return res.json() as Promise<ResearchIndexStatus>;
    },
    onSuccess: (status) => {
      queryClient.setQueryData(["snipradar-research-index-status"], status);
      toast({
        title: "Research corpus refreshed",
        description: `${status.counts.total} indexed items are ready for search.`,
      });
      trackSnipRadarEvent("snipradar_research_index_refresh", {
        totalDocuments: status.totalDocuments,
        usingEmbeddings: status.usingEmbeddings,
      });
    },
    onError: (error) => {
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Could not refresh the research corpus.",
        variant: "destructive",
      });
    },
  });

  const activeStatus = searchMutation.data?.indexStatus ?? statusQuery.data;
  const hasResults = Boolean(searchMutation.data?.resultCounts.total);
  const gateDetails = getSnipRadarBillingGateDetails(
    searchMutation.error ? toSnipRadarApiError(searchMutation.error, "Failed to search research") : null
  );

  const statusHighlights = useMemo(
    () =>
      activeStatus
        ? [
            {
              label: "Corpus",
              value: `${activeStatus.counts.total}`,
              hint: "Indexed items",
            },
            {
              label: "Embeddings",
              value: `${activeStatus.embeddedDocuments}`,
              hint: activeStatus.usingEmbeddings ? "Hybrid search ready" : "Lexical only",
            },
            {
              label: "Scripts",
              value: `${activeStatus.counts.hooksmithScripts}`,
              hint: "Hooksmith",
            },
            {
              label: "Ideas",
              value: `${activeStatus.counts.contentIdeas}`,
              hint: "Calendar-ready",
            },
          ]
        : [],
    [activeStatus]
  );

  const showPrimer = useMemo(() => {
    if (!activeStatus) return false;
    if (searchMutation.data) return false;
    return activeStatus.totalDocuments < 25;
  }, [activeStatus, searchMutation.data]);

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenText className="h-4.5 w-4.5 text-emerald-500" />
                Research Copilot
              </CardTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Search a persistent SnipRadar corpus across viral tweets, engagement opportunities, drafts, templates,
                Hooksmith scripts, and content ideas. Results use hybrid retrieval plus an AI brief when available.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeStatus ? (
                <>
                  <Badge variant={statusBadgeVariant(activeStatus.state)} className="capitalize">
                    {activeStatus.state}
                  </Badge>
                  <Badge variant="outline">
                    {activeStatus.usingEmbeddings ? "Hybrid retrieval" : "Lexical retrieval"}
                  </Badge>
                </>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={refreshMutation.isPending}
                onClick={() => refreshMutation.mutate()}
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {activeStatus?.totalDocuments ? "Refresh corpus" : "Build corpus"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showPrimer ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    Prime your research corpus before you search deeply
                  </div>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Research becomes useful after SnipRadar has some signal to work with. {profile.selectedNiche ? `Start with ${profile.selectedNiche}-focused radar,` : "Start with your niche radar,"} generate a few drafts, save a couple of extension captures, then refresh the corpus.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    disabled={refreshMutation.isPending}
                    onClick={() => refreshMutation.mutate()}
                  >
                    {refreshMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    {activeStatus?.totalDocuments ? "Refresh corpus" : "Build corpus"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => router.push("/snipradar/discover")}>
                    Open Discover
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => router.push("/snipradar/create/drafts")}>
                    Open Draft Studio
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => router.push("/snipradar/inbox")}>
                    Open Inbox
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-background/35 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Confirm the seeded radar</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {counts.trackedAccounts > 0
                      ? `${counts.trackedAccounts} tracked accounts are ready. Fetch a first batch of viral examples if the feed still feels thin.`
                      : "No tracked accounts are ready yet. Connect X and let starter accounts seed first."}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/35 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Create a few artifacts</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Drafts, saved templates, and inbox captures give Research more material to synthesize into briefs.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/35 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Search for reusable angles</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Try queries like “contrarian hooks”, “waitlist CTA”, or “reply strategy” once the corpus has a few fresh items.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {statusHighlights.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/70 bg-background/40 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/30 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4 text-emerald-500" />
                Corpus health
              </div>
              <p className="text-sm text-muted-foreground">
                {activeStatus
                  ? activeStatus.totalDocuments === 0
                    ? "Build the corpus once, then search it instantly across every create session."
                    : activeStatus.isStale
                      ? "The corpus is still searchable, but refresh it to pull in the latest tweets, drafts, scripts, ideas, and opportunities."
                      : "The corpus is up to date and ready for search."
                  : "Loading corpus status..."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                Last indexed {formatRelativeTime(activeStatus?.lastIndexedAt)}
              </span>
              {activeStatus?.lastRunStatus ? <Badge variant="outline">Last run {activeStatus.lastRunStatus}</Badge> : null}
            </div>
          </div>

          {activeStatus?.lastErrorSummary ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {activeStatus.lastErrorSummary}
            </div>
          ) : null}

          {statusQuery.error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {(statusQuery.error as Error).message}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && query.trim().length >= 2) {
                    searchMutation.mutate(query.trim());
                  }
                }}
                placeholder="Search hooks, audience pain points, niches, formats, proof angles..."
                className="pl-9"
              />
            </div>
            <Button
              className="gap-2"
              disabled={searchMutation.isPending || query.trim().length < 2}
              onClick={() => {
                trackSnipRadarEvent("snipradar_research_query_submit", { queryLength: query.trim().length });
                searchMutation.mutate(query.trim());
              }}
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {["contrarian hooks", "creator growth", "AI founders", "waitlist CTA", "reply strategy"].map((idea) => (
              <Button
                key={idea}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setQuery(idea);
                  searchMutation.mutate(idea);
                }}
              >
                {idea}
              </Button>
            ))}
          </div>

          {gateDetails ? <SnipRadarBillingGateCard details={gateDetails} compact /> : null}

          {searchMutation.error && !gateDetails ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {(searchMutation.error as Error).message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {searchMutation.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching your indexed research corpus and assembling a brief...
          </CardContent>
        </Card>
      ) : null}

      {searchMutation.data ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Search summary</p>
                <p className="text-sm text-muted-foreground">{searchMutation.data.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{searchMutation.data.resultCounts.viralTweets} viral</Badge>
                <Badge variant="outline">{searchMutation.data.resultCounts.opportunities} opportunities</Badge>
                <Badge variant="outline">{searchMutation.data.resultCounts.drafts} drafts</Badge>
                <Badge variant="outline">{searchMutation.data.resultCounts.templates} templates</Badge>
                <Badge variant="outline">{searchMutation.data.resultCounts.hooksmithScripts} scripts</Badge>
                <Badge variant="outline">{searchMutation.data.resultCounts.contentIdeas} ideas</Badge>
                <Badge variant="outline">{searchMutation.data.resultCounts.inboxCaptures} inbox</Badge>
              </div>
            </CardContent>
          </Card>

          {searchMutation.data.synthesis ? (
            <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4.5 w-4.5 text-emerald-500" />
                      AI Brief
                    </CardTitle>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {searchMutation.data.synthesis.answer}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={searchMutation.data.synthesis.source === "ai" ? "default" : "secondary"}>
                      {searchMutation.data.synthesis.source === "ai" ? "Live AI" : "Fallback brief"}
                    </Badge>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        trackSnipRadarEvent("snipradar_research_brief_seed_draft", {
                          citationCount: searchMutation.data?.synthesis?.citations.length ?? 0,
                          source: searchMutation.data?.synthesis?.source ?? "unknown",
                        });
                        onUseDraftSeed(
                          searchMutation.data?.synthesis?.draftStarter ?? "",
                          "research brief"
                        );
                        toast({
                          title: "Brief starter loaded",
                          description: "The AI brief starter is ready in Draft Studio.",
                        });
                      }}
                    >
                      Use starter draft
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 xl:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                    <p className="text-sm font-medium">Key themes</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {searchMutation.data.synthesis.keyThemes.map((theme) => (
                        <Badge key={theme} variant="outline" className="text-[10px]">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                    <p className="text-sm font-medium">Recommended angles</p>
                    <div className="mt-3 space-y-2">
                      {searchMutation.data.synthesis.recommendedAngles.map((angle) => (
                        <p key={angle} className="text-sm text-muted-foreground">
                          {angle}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                    <p className="text-sm font-medium">Suggested formats</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {searchMutation.data.synthesis.suggestedFormats.map((format) => (
                        <Badge key={format} variant="outline" className="text-[10px]">
                          {format}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {searchMutation.data.synthesis.citations.length > 0 ? (
                  <div className="rounded-xl border border-border/70 bg-background/20 p-4">
                    <p className="text-sm font-medium">Why this brief was generated</p>
                    <div className="mt-3 grid gap-2 xl:grid-cols-2">
                      {searchMutation.data.synthesis.citations.map((citation) => (
                        <div
                          key={citation.id}
                          className="rounded-lg border border-border/60 bg-background/30 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{citation.title}</p>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {sourceLabel(citation.source)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{citation.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {(
            Object.entries(SOURCE_CONFIG) as Array<
              [keyof ResearchResponse["groups"], (typeof SOURCE_CONFIG)[keyof typeof SOURCE_CONFIG]]
            >
          ).map(([groupKey, config]) => {
            const items = searchMutation.data.groups[groupKey];
            if (!items.length) return null;
            const Icon = config.icon;

            return (
              <Card key={groupKey}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4.5 w-4.5 text-emerald-500" />
                    {config.label}
                    <Badge variant="secondary" className="text-xs">
                      {items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-emerald-500/30"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{item.title}</p>
                            <Badge variant="outline" className="text-[10px]">
                              relevance {item.score}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {sourceLabel(item.source)}
                            </Badge>
                          </div>

                          <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>

                          <div className="flex flex-wrap gap-1.5">
                            {item.meta.map((meta) => (
                              <Badge key={`${item.id}-${meta}`} variant="outline" className="text-[10px]">
                                {meta}
                              </Badge>
                            ))}
                          </div>

                          {item.matchReasons.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {item.matchReasons.map((reason) => (
                                <Badge
                                  key={`${item.id}-${reason}`}
                                  className={cn(
                                    "border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-100 hover:bg-emerald-500/10"
                                  )}
                                  variant="outline"
                                >
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          ) : null}

                          <p className="text-[11px] text-muted-foreground">
                            Last source update {formatRelativeTime(item.sourceUpdatedAt)}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 self-start"
                          onClick={() => {
                            trackSnipRadarEvent("snipradar_research_seed_draft", {
                              source: item.source,
                              score: item.score,
                            });
                            onUseDraftSeed(item.draftSeed, item.source);
                            toast({
                              title: "Seed loaded into Draft Studio",
                              description: `${item.title} is ready to remix.`,
                            });
                          }}
                        >
                          Use in Draft Studio
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {!hasResults ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No strong matches yet. Try a more specific query, switch to a different pain point, or refresh the
                corpus if your latest content is missing.
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
