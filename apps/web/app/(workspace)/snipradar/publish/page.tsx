"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ActivitySquare,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
// Badge kept for scheduler run status badge above
import { parseServerTimingMs } from "@/lib/server-timing";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";
import type { SnipRadarDraft } from "@/components/snipradar/snipradar-context";
// SnipRadarDraft is used for the createData query type
import { SchedulerCalendar } from "@/components/snipradar/scheduler-calendar";
import { BestTimeChart } from "@/components/snipradar/best-time-chart";
import { AutoDmPanel } from "@/components/snipradar/auto-dm-panel";
import { WinnerLoopPanel } from "@/components/snipradar/winner-loop-panel";
import { ApiWebhooksPanel } from "@/components/snipradar/api-webhooks-panel";
import { SchedulerQueuePanel } from "@/components/snipradar/scheduler-queue-panel";
import {
  SchedulerOpsPanel,
  type SchedulerRunsOpsPayload,
} from "@/components/snipradar/analytics/scheduler-ops-panel";
import { useBillingSubscriptionState } from "@/hooks/use-billing-subscription";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";
import { isPublishTab, type PublishTab } from "@/lib/snipradar-tabs";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";

function useUrlTab(defaultTab: PublishTab, tabOverride?: PublishTab) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabOverride ?? (isPublishTab(tabParam) ? tabParam : defaultTab);

  const setTab = (nextTab: PublishTab) => {
    router.replace(`/snipradar/publish/${nextTab}`, { scroll: false });
  };

  return { tab, setTab };
}

export default function SnipRadarPublishPage({
  tabOverride,
}: {
  tabOverride?: PublishTab;
} = {}) {
  const { tab, setTab } = useUrlTab("calendar", tabOverride);
  const flags = useFeatureFlags();
  const billingQuery = useBillingSubscriptionState();
  const queryClient = useQueryClient();
  const { account, auth, invalidate, reportPerf } = useSnipRadar();
  const {
    data: createData,
    isLoading: draftsLoading,
    refetch: refetchCreateData,
  } = useQuery<{
    drafts: SnipRadarDraft[];
    scheduledDrafts: SnipRadarDraft[];
    postedDrafts: SnipRadarDraft[];
    viralTweetCount: number;
  }>({
    queryKey: ["snipradar-create-data"],
    queryFn: async () => {
      const startedAt = performance.now();
      const res = await fetch("/api/snipradar/create-data");
      if (!res.ok) throw new Error("Failed to fetch publish data");
      reportPerf("publish_data", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json();
    },
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
  const scheduledDrafts = useMemo(
    () => createData?.scheduledDrafts ?? [],
    [createData?.scheduledDrafts],
  );

  const bestTimesQuery = useQuery({
    queryKey: ["snipradar-best-times"],
    queryFn: async () => {
      const startedAt = performance.now();
      const res = await fetch("/api/snipradar/scheduler/best-times");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to fetch best times");
      }
      reportPerf("publish_best_times", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json() as Promise<{
        slots: Array<{ day: string; hour: number; score: number; samples: number }>;
        heatmap: Array<{
          day: string;
          hours: Array<{ hour: number; score: number; samples: number }>;
        }>;
        source?: string;
        confidence?: "none" | "low" | "medium" | "high";
        sampleCount?: number;
        minRequired?: number;
        message?: string;
      }>;
    },
    staleTime: 60_000,
  });

  const processNowMutation = useMutation({
    mutationFn: async () => {
      const startedAt = performance.now();
      const res = await fetch("/api/snipradar/scheduled/process", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to process queue");
      }
      reportPerf("publish_process_queue", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json() as Promise<{ posted: number; failed: number; total: number }>;
    },
    onSuccess: () => {
      invalidate();
      refetchCreateData();
      queryClient.invalidateQueries({ queryKey: ["snipradar-scheduler-runs"] });
    },
  });

  const healthQuery = useQuery<{
    ai: { openRouterActive: boolean; provider: string };
    scheduler: { consecutiveFailures: number; successRatePct: number; lastRunAt: string | null };
  }>({
    queryKey: ["snipradar-health-diagnostics"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/health");
      if (!res.ok) throw new Error("Failed to fetch health");
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const schedulerRunsQuery = useQuery<SchedulerRunsOpsPayload>({
    queryKey: ["snipradar-scheduler-runs"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/scheduled/runs?limit=20&windowHours=48");
      if (!res.ok) throw new Error("Failed to fetch scheduler runs");
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const latestCronRun =
    schedulerRunsQuery.data?.runs?.find((run: { source: string }) => run.source === "api_cron") ?? null;
  const cronRecentMs = latestCronRun
    ? Date.now() - new Date(latestCronRun.createdAt).getTime()
    : Number.POSITIVE_INFINITY;
  const autoPublishActive =
    Boolean(latestCronRun) &&
    cronRecentMs <= 90 * 60 * 1000 &&
    latestCronRun?.status !== "failed";

  const schedulingLocked = billingQuery.data ? billingQuery.data.limits.scheduling === false : false;

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as PublishTab)}>
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
        <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
        <TabsTrigger value="best-times">Best Times</TabsTrigger>
        <TabsTrigger value="automations">Automations</TabsTrigger>
        <TabsTrigger value="api">API</TabsTrigger>
        <TabsTrigger value="diagnostics" className="gap-1.5">
          <ActivitySquare className="h-3.5 w-3.5" />
          Diagnostics
        </TabsTrigger>
      </TabsList>

      {schedulingLocked && billingQuery.data ? (
        <div className="mt-4">
          <SnipRadarBillingGateCard
            details={{
              kind: "upgrade_required",
              feature: "scheduling",
              currentPlan: billingQuery.data.plan.id,
              requiredPlan: "plus",
              upgradePlan: "plus",
            }}
          />
        </div>
      ) : null}

      <TabsContent value="scheduler" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Smart Scheduler</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={processNowMutation.isPending || schedulingLocked}
              onClick={() => {
                processNowMutation.mutate();
                trackSnipRadarEvent("snipradar_publish_process_queue_click", {
                  scheduledDrafts: scheduledDrafts.length,
                });
              }}
            >
              {processNowMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Clock3 className="h-3.5 w-3.5" />
              )}
              Process Queue Now
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Auto-publish mode status */}
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
              <p className="font-medium">
                Auto-publish mode: {autoPublishActive ? "Active" : "Manual / fallback"}
              </p>
              <p className="text-muted-foreground">
                {autoPublishActive
                  ? `Cron dispatcher healthy. Last cron run ${latestCronRun ? new Date(latestCronRun.createdAt).toLocaleString() : "just now"}.`
                  : latestCronRun
                    ? "Cron is configured but not recently healthy. You can still post via Process Queue Now."
                    : "No cron-driven run detected yet. Process Queue Now works as manual backup."}
              </p>
            </div>

            {/* Last scheduler run */}
            {schedulerRunsQuery.data?.runs?.[0] ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Last run:</span>
                  <Badge
                    variant="outline"
                    className={
                      schedulerRunsQuery.data.runs[0].status === "failed"
                        ? "border-red-500/50 text-red-600"
                        : schedulerRunsQuery.data.runs[0].status === "partial"
                          ? "border-amber-500/50 text-amber-600"
                          : "border-emerald-500/50 text-emerald-600"
                    }
                  >
                    {schedulerRunsQuery.data.runs[0].status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {schedulerRunsQuery.data.runs[0].posted}/
                    {schedulerRunsQuery.data.runs[0].attempted} posted
                  </span>
                  {schedulerRunsQuery.data.runs[0].durationMs != null ? (
                    <span className="text-muted-foreground">
                      {schedulerRunsQuery.data.runs[0].durationMs}ms
                    </span>
                  ) : null}
                </div>
                {schedulerRunsQuery.data.runs[0].errorSummary ? (
                  <p className="mt-1 text-red-600 dark:text-red-400">
                    {schedulerRunsQuery.data.runs[0].errorSummary}
                  </p>
                ) : null}
              </div>
            ) : null}

            {processNowMutation.data ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Processed: {processNowMutation.data.total} due · posted{" "}
                {processNowMutation.data.posted}
                {processNowMutation.data.failed > 0
                  ? ` · failed ${processNowMutation.data.failed}`
                  : ""}
              </div>
            ) : null}
            {processNowMutation.error ? (
              <p className="text-xs text-destructive">
                {(processNowMutation.error as Error).message}
              </p>
            ) : null}

            {/* Queue panel — shows all scheduled threads + posts, and ready items */}
            <SchedulerQueuePanel
              onProcessQueue={() => processNowMutation.mutate()}
              isProcessing={processNowMutation.isPending}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="calendar" className="space-y-4">
        <SchedulerCalendar
          scheduledDrafts={scheduledDrafts}
          heatmap={bestTimesQuery.data?.heatmap ?? []}
        />
      </TabsContent>

      <TabsContent value="best-times" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Best Time Predictor</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => bestTimesQuery.refetch()}
              disabled={bestTimesQuery.isFetching}
            >
              {bestTimesQuery.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {bestTimesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Analyzing your posting history...</p>
            ) : bestTimesQuery.error ? (
              <p className="text-sm text-destructive">{(bestTimesQuery.error as Error).message}</p>
            ) : (
              <BestTimeChart
                slots={bestTimesQuery.data?.slots ?? []}
                heatmap={bestTimesQuery.data?.heatmap ?? []}
                source={bestTimesQuery.data?.source}
                confidence={bestTimesQuery.data?.confidence}
                sampleCount={bestTimesQuery.data?.sampleCount}
                minRequired={bestTimesQuery.data?.minRequired}
                message={bestTimesQuery.data?.message}
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="automations" className="space-y-4">
        {flags.autoDmEnabled && <AutoDmPanel billingState={billingQuery.data} />}
        {flags.winnerLoopEnabled && <WinnerLoopPanel mode="publish" />}
        {!flags.autoDmEnabled && !flags.winnerLoopEnabled && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Automation features are not yet available.
          </p>
        )}
      </TabsContent>

      <TabsContent value="api" className="space-y-4">
        {flags.apiWebhooksEnabled ? (
          <ApiWebhooksPanel />
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            API &amp; Webhooks are not yet available.
          </p>
        )}
      </TabsContent>

      <TabsContent value="diagnostics" className="space-y-4">
        {/* Billing Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Billing Status</CardTitle>
          </CardHeader>
          <CardContent>
            {billingQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading billing status…
              </div>
            ) : billingQuery.data ? (
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Plan</p>
                  <p className="font-semibold capitalize">{billingQuery.data.plan.id}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Scheduling</p>
                  <p className={billingQuery.data.limits.scheduling ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-amber-600 dark:text-amber-400"}>
                    {billingQuery.data.limits.scheduling ? "Enabled" : "Upgrade required"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Growth Planner</p>
                  <p className={billingQuery.data.limits.growthPlanAI ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-amber-600 dark:text-amber-400"}>
                    {billingQuery.data.limits.growthPlanAI ? "Enabled" : "Upgrade required"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load billing data.</p>
            )}
          </CardContent>
        </Card>

        {/* X Auth Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">X Account Auth Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!account ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                No X account connected. Connect your account to enable all SnipRadar features.
              </div>
            ) : auth?.reauthRequired ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Re-authentication required
                </div>
                {auth.message ? (
                  <p className="mt-1 text-xs text-muted-foreground">{auth.message}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Go to Settings → X Account and reconnect your account to restore full access.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                X account connected and token is healthy.
                {auth?.refreshedToken ? (
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    Token auto-refreshed this session
                  </Badge>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Provider Routing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI Provider Routing</CardTitle>
          </CardHeader>
          <CardContent>
            {healthQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking AI routing…
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {healthQuery.data?.ai.openRouterActive ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : healthQuery.data?.ai.provider === "openai" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-medium">
                    {healthQuery.data?.ai.openRouterActive
                      ? "OpenRouter active"
                      : healthQuery.data?.ai.provider === "openai"
                        ? "Direct OpenAI (OpenRouter not configured)"
                        : "No AI provider configured"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {healthQuery.data?.ai.openRouterActive
                    ? "All SnipRadar AI features are routed through OpenRouter. Cost-optimized model selection is active."
                    : healthQuery.data?.ai.provider === "openai"
                      ? "Set OPENROUTER_API_KEY to enable OpenRouter routing for 35% cost reduction and model fallbacks."
                      : "Set OPENROUTER_API_KEY or OPENAI_API_KEY to enable SnipRadar AI features."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduler Operations Panel */}
        {schedulerRunsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading scheduler diagnostics…
          </div>
        ) : schedulerRunsQuery.data ? (
          <SchedulerOpsPanel
            data={schedulerRunsQuery.data}
            onRefresh={() => schedulerRunsQuery.refetch()}
            refreshing={schedulerRunsQuery.isFetching}
          />
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No scheduler run data yet. Runs appear here once the scheduler has processed.
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
