"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface AuditResponse {
  audit: {
    score: number;
    grade: "A" | "B" | "C" | "D";
    confidence: "none" | "low" | "medium" | "high";
    headline: string;
    summary: string;
    quickWins: string[];
    stats: {
      followerCount: number;
      bioLength: number;
      recentPosts14d: number;
      avgEngagementRate: number;
      avgImpressions: number;
      replySharePct: number;
      hasPinnedTweet: boolean;
      hasProfileImage: boolean;
      hasUrl: boolean;
    };
    pillars: Array<{
      id: string;
      label: string;
      score: number;
      maxScore: number;
      status: "strong" | "watch" | "needs-work";
      summary: string;
      recommendations: string[];
    }>;
    ai?: {
      source: "ai" | "heuristic_fallback";
      executiveSummary: string;
      positioningAssessment: string;
      conversionAssessment: string;
      contentAssessment: string;
      strengths: string[];
      risks: string[];
      priorityFixes: string[];
      bioRewrites: Array<{
        label: string;
        text: string;
        rationale: string;
      }>;
      pinnedTweetAssessment: string;
      pinnedTweetRecommendation: {
        headline: string;
        bullets: string[];
        cta: string;
        rationale: string;
      };
      contentPillars: string[];
      next7DaysPlan: string[];
    } | null;
  } | null;
  auth?: {
    reauthRequired: boolean;
    message: string | null;
    refreshedToken: boolean;
  } | null;
  message?: string;
  history?: {
    points: Array<{
      id: string;
      score: number;
      grade: "A" | "B" | "C" | "D";
      confidence: "none" | "low" | "medium" | "high";
      createdAt: string;
      deltaFromPrevious: number | null;
      pillars: {
        profile: number;
        positioning: number;
        cadence: number;
        engagement: number;
      };
    }>;
    latestDelta: number | null;
    bestScore: number | null;
    snapshotCount: number;
  };
  meta?: {
    generatedAt?: string;
    sampleCount?: number;
    pinnedTweetId?: string | null;
    snapshotSource?: "db_cache" | "db_persisted" | "live";
  };
}

function statusTone(status: "strong" | "watch" | "needs-work") {
  if (status === "strong") return "text-emerald-600 dark:text-emerald-400";
  if (status === "watch") return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function confidenceBadge(confidence: "none" | "low" | "medium" | "high") {
  if (confidence === "high") return { label: "High confidence", variant: "success" as const };
  if (confidence === "medium") return { label: "Medium confidence", variant: "secondary" as const };
  if (confidence === "low") return { label: "Low confidence", variant: "warning" as const };
  return { label: "Setup only", variant: "outline" as const };
}

export function ProfileAuditCard() {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, isLoading, error, isFetching } = useQuery<AuditResponse>({
    queryKey: ["snipradar-profile-audit", refreshNonce],
    queryFn: async () => {
      const query = refreshNonce > 0 ? "?refresh=true" : "";
      const res = await fetch(`/api/snipradar/profile-audit${query}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load profile audit");
      }
      return res.json();
    },
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  const audit = data?.audit ?? null;
  const ai = audit?.ai ?? null;
  const history = data?.history ?? null;
  const confidence = confidenceBadge(audit?.confidence ?? "none");
  const generatedAt = data?.meta?.generatedAt
    ? new Date(data.meta.generatedAt).toLocaleString()
    : null;
  const latestDelta = history?.latestDelta ?? null;

  return (
    <Card className="border-border/70 bg-gradient-to-br from-emerald-50/70 via-background to-background dark:from-emerald-500/[0.06] dark:via-background dark:to-background">
      <CardHeader className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">AI Profile Audit</CardTitle>
                {ai?.source === "ai" ? (
                  <Badge variant="success" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Live AI
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Real X profile audit with AI diagnosis, bio rewrites, and pinned-post strategy
              </p>
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={isFetching}
          onClick={() => setRefreshNonce((value) => value + 1)}
          className="gap-1.5 self-start sm:self-auto"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating AI profile audit…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-300/50 bg-red-50/70 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {(error as Error).message}
          </div>
        ) : !audit ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
            {data?.message ?? "Connect your X account to unlock profile audit."}
          </div>
        ) : (
          <>
            <div className="grid gap-4 2xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Health Score
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-5xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                        {audit.score}
                      </span>
                      <span className="pb-1 text-lg font-semibold text-muted-foreground">/100</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-sm font-semibold">
                    {audit.grade}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant={confidence.variant}>{confidence.label}</Badge>
                  {data?.auth?.reauthRequired ? <Badge variant="warning">Reconnect X</Badge> : null}
                  {ai?.source === "heuristic_fallback" ? (
                    <Badge variant="outline">AI unavailable</Badge>
                  ) : null}
                  {latestDelta !== null ? (
                    <Badge variant={latestDelta >= 0 ? "success" : "warning"}>
                      {latestDelta >= 0 ? "+" : ""}
                      {latestDelta} since last audit
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-3 text-sm font-medium">{audit.headline}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {ai?.executiveSummary ?? audit.summary}
                </p>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-2">
                  <StatChip label="Posts (14d)" value={String(audit.stats.recentPosts14d)} />
                  <StatChip label="Avg ER" value={`${audit.stats.avgEngagementRate}%`} />
                  <StatChip label="Avg Impr." value={audit.stats.avgImpressions.toLocaleString()} />
                  <StatChip label="Reply Share" value={`${audit.stats.replySharePct}%`} />
                </div>

                {history ? (
                  <div className="mt-4 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                    {history.snapshotCount} snapshot{history.snapshotCount === 1 ? "" : "s"} saved
                    {data?.meta?.snapshotSource === "db_cache" ? " • loaded from recent history" : ""}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm font-semibold">Priority Fixes</p>
                    </div>
                    {generatedAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        Generated {generatedAt}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2 xl:grid-cols-3">
                    {(ai?.priorityFixes?.length ? ai.priorityFixes : audit.quickWins).map((item) => (
                      <div
                        key={item}
                        className="flex h-full items-start gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="leading-relaxed text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  {data?.auth?.message ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-50/70 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{data.auth.message}</span>
                    </div>
                  ) : null}
                </div>

                {history ? <TrendHistoryPanel history={history} /> : null}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
                  {audit.pillars.map((pillar) => {
                    const ratio = pillar.maxScore > 0 ? Math.round((pillar.score / pillar.maxScore) * 100) : 0;
                    return (
                      <div key={pillar.id} className="flex h-full flex-col rounded-2xl border border-border/70 bg-background/70 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{pillar.label}</p>
                          <span className={cn("text-xs font-semibold", statusTone(pillar.status))}>
                            {pillar.score}/{pillar.maxScore}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pillar.status === "strong"
                                ? "bg-emerald-500"
                                : pillar.status === "watch"
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            )}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pillar.summary}</p>
                        {pillar.recommendations[0] ? (
                          <p className="mt-auto pt-3 text-xs font-medium leading-relaxed text-foreground/80">
                            Next: {pillar.recommendations[0]}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {ai ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="h-auto w-auto max-w-full justify-start overflow-x-auto rounded-2xl bg-muted/40 p-1">
                  <TabsTrigger value="overview">AI Diagnosis</TabsTrigger>
                  <TabsTrigger value="rewrites">Bio & Pin</TabsTrigger>
                  <TabsTrigger value="plan">7-Day Plan</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 border-0 bg-transparent p-0 shadow-none">
                  <div className="grid gap-4 xl:grid-cols-3">
                    <InsightBlock title="Positioning" body={ai.positioningAssessment} />
                    <InsightBlock title="Conversion" body={ai.conversionAssessment} />
                    <InsightBlock title="Content" body={ai.contentAssessment} />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <ListBlock
                      title="Strengths"
                      items={ai.strengths}
                      tone="emerald"
                      emptyLabel="No strengths captured yet."
                    />
                    <ListBlock
                      title="Risks"
                      items={ai.risks}
                      tone="amber"
                      emptyLabel="No major risks identified."
                    />
                  </div>
                </TabsContent>

                <TabsContent value="rewrites" className="space-y-4 border-0 bg-transparent p-0 shadow-none">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Bio Rewrite Options</p>
                      {ai.bioRewrites.length > 0 ? (
                        ai.bioRewrites.map((rewrite) => (
                          <div key={rewrite.label} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">{rewrite.label}</p>
                              <Badge variant="outline">{rewrite.text.length}/160</Badge>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed">{rewrite.text}</p>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{rewrite.rationale}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                          AI bio rewrites were not available for this run.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <p className="text-sm font-semibold">Pinned Tweet Strategy</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ai.pinnedTweetAssessment}</p>
                      <Separator className="my-4" />
                      <p className="text-sm font-semibold">{ai.pinnedTweetRecommendation.headline}</p>
                      <div className="mt-3 space-y-2">
                        {ai.pinnedTweetRecommendation.bullets.map((bullet) => (
                          <div key={bullet} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span className="leading-relaxed">{bullet}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">CTA</p>
                        <p className="mt-1 text-sm">{ai.pinnedTweetRecommendation.cta}</p>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{ai.pinnedTweetRecommendation.rationale}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="plan" className="space-y-4 border-0 bg-transparent p-0 shadow-none">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ListBlock
                      title="Content Pillars"
                      items={ai.contentPillars}
                      tone="emerald"
                      emptyLabel="No pillars suggested."
                    />
                    <ListBlock
                      title="Next 7 Days"
                      items={ai.next7DaysPlan}
                      tone="cyan"
                      emptyLabel="No execution plan suggested."
                    />
                  </div>
                </TabsContent>
              </Tabs>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TrendHistoryPanel({
  history,
}: {
  history: NonNullable<AuditResponse["history"]>;
}) {
  const points = history.points;
  const latestPoint = points[points.length - 1] ?? null;
  const previousPoint = points.length >= 2 ? points[points.length - 2] : null;

  const pillarDeltas = latestPoint && previousPoint
    ? [
        { label: "Profile", delta: latestPoint.pillars.profile - previousPoint.pillars.profile },
        { label: "Positioning", delta: latestPoint.pillars.positioning - previousPoint.pillars.positioning },
        { label: "Cadence", delta: latestPoint.pillars.cadence - previousPoint.pillars.cadence },
        { label: "Engagement", delta: latestPoint.pillars.engagement - previousPoint.pillars.engagement },
      ]
    : [];

  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-semibold">Trend History</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Track score movement across saved audit snapshots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Best {history.bestScore ?? "--"}</Badge>
          <Badge variant="outline">{history.snapshotCount} runs</Badge>
        </div>
      </div>

      {points.length > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {points.map((point) => (
              <div key={point.id} className="space-y-2">
                <div className="flex h-24 items-end rounded-xl border border-border/60 bg-muted/20 p-1.5">
                  <div
                    className="w-full rounded-lg bg-emerald-500/80"
                    style={{ height: `${Math.max(12, point.score)}%` }}
                  />
                </div>
                <div className="space-y-0.5 text-center">
                  <p className="text-xs font-semibold">{point.score}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(point.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {pillarDeltas.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {pillarDeltas.map((item) => (
                <div key={item.label} className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-semibold",
                      item.delta > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : item.delta < 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {item.delta > 0 ? "+" : ""}
                    {item.delta}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
              Run at least two audits to unlock score delta and pillar movement.
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
          No saved snapshots yet. Run an audit to start history tracking.
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function InsightBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function ListBlock({
  title,
  items,
  tone,
  emptyLabel,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber" | "cyan";
  emptyLabel: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-cyan-600 dark:text-cyan-400";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass)} />
              <span className="leading-relaxed text-muted-foreground">{item}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
