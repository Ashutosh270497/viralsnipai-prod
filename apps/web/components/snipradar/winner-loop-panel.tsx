"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, RefreshCcw, Sparkles, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import { cn } from "@/lib/utils";

type WinnerAction = "expand_thread" | "repost_variant" | "spin_off_post";

type WinnerCandidate = {
  id: string;
  tweetId: string | null;
  tweetUrl: string | null;
  text: string;
  hookType: string | null;
  format: string | null;
  emotionalTrigger: string | null;
  postedAt: string | null;
  actualLikes: number;
  actualRetweets: number;
  actualReplies: number;
  actualImpressions: number;
  engagementRate: number;
  winnerScore: number;
  whyWon: string[];
  recommendedActions: Array<{
    id: WinnerAction;
    label: string;
    description: string;
  }>;
};

type WinnersPayload = {
  summary: string;
  baseline: {
    avgImpressions: number;
    avgEngagementRate: number;
  };
  winners: WinnerCandidate[];
};

function formatRelativeTime(isoDate?: string | null) {
  if (!isoDate) return "Unknown";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function WinnerLoopPanel({
  mode,
}: {
  mode: "analytics" | "publish";
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const showActions = mode === "publish";

  const winnersQuery = useQuery<WinnersPayload>({
    queryKey: ["snipradar-winners", 30],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/winners?periodDays=30");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load winners");
      }
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const automationMutation = useMutation({
    mutationFn: async ({ winnerDraftId, action }: { winnerDraftId: string; action: WinnerAction }) => {
      const res = await fetch("/api/snipradar/winners/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerDraftId, action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to execute automation");
      }
      return payload as { createdCount: number; action: WinnerAction };
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-winners"] });
      toast({
        title: "Winner automation created",
        description: `${payload.createdCount} draft${payload.createdCount > 1 ? "s" : ""} added to the pipeline.`,
      });
    },
  });

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4.5 w-4.5 text-amber-500" />
            {mode === "analytics" ? "Winners" : "Winner Automations"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Detect posts that outperformed your baseline and turn them into follow-up assets.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => winnersQuery.refetch()}
          disabled={winnersQuery.isFetching}
        >
          {winnersQuery.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {winnersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Scanning posted drafts for winners...</p>
        ) : winnersQuery.error ? (
          <p className="text-sm text-destructive">{(winnersQuery.error as Error).message}</p>
        ) : winnersQuery.data ? (
          <>
            <div className="rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm text-muted-foreground">{winnersQuery.data.summary}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    avg impr. {winnersQuery.data.baseline.avgImpressions}
                  </Badge>
                  <Badge variant="outline">
                    avg ER {winnersQuery.data.baseline.avgEngagementRate}%
                  </Badge>
                </div>
              </div>
            </div>

            {winnersQuery.data.winners.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
                No winners yet. Post more drafts and let metrics accumulate before the automation loop can trigger.
              </div>
            ) : (
              <div className="space-y-3">
                {winnersQuery.data.winners.map((winner) => (
                  <div key={winner.id} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="success">Winner score {winner.winnerScore}</Badge>
                          <Badge variant="outline">{winner.actualImpressions.toLocaleString()} impr.</Badge>
                          <Badge variant="outline">{winner.engagementRate}% ER</Badge>
                          <Badge variant="outline">{formatRelativeTime(winner.postedAt)}</Badge>
                        </div>
                        <p className="text-sm leading-relaxed">{winner.text}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {winner.whyWon.map((reason) => (
                            <Badge key={`${winner.id}-${reason}`} variant="outline" className="text-[10px]">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {winner.tweetUrl ? (
                        <Button variant="outline" size="sm" asChild className="self-start">
                          <a href={winner.tweetUrl} target="_blank" rel="noreferrer">
                            View post
                          </a>
                        </Button>
                      ) : null}
                    </div>

                    <div className={cn("mt-4 grid gap-2", showActions ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
                      {winner.recommendedActions.map((action) => (
                        <div key={`${winner.id}-${action.id}`} className="rounded-xl border border-border/70 bg-card/40 p-3">
                          <p className="text-sm font-medium">{action.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                          {showActions ? (
                            <Button
                              size="sm"
                              className="mt-3 gap-1.5"
                              disabled={automationMutation.isPending}
                              onClick={() => {
                                trackSnipRadarEvent("snipradar_winner_automation_execute", { action: action.id });
                                automationMutation.mutate({ winnerDraftId: winner.id, action: action.id });
                              }}
                            >
                              {automationMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                              Run automation
                            </Button>
                          ) : (
                            <div className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarClock className="h-3.5 w-3.5" />
                              Available in Publish
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {automationMutation.error ? (
          <p className="text-sm text-destructive">{(automationMutation.error as Error).message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
