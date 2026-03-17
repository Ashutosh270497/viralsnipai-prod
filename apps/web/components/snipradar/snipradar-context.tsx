"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseServerTimingMs } from "@/lib/server-timing";
import {
  deriveSnipRadarRecoveryState,
  parseSnipRadarApiError,
  SnipRadarApiError,
  SnipRadarRecoveryState,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";

export interface SnipRadarDraft {
  id: string;
  text: string;
  hookType: string | null;
  format: string | null;
  emotionalTrigger: string | null;
  viralPrediction: number | null;
  aiReasoning: string | null;
  threadGroupId?: string | null;
  threadOrder?: number | null;
  status: string;
  scheduledFor: string | null;
  postedAt?: string | null;
  postedTweetId?: string | null;
  createdAt: string;
}

export interface SnipRadarTrackedAccount {
  id: string;
  trackedUsername: string;
  trackedDisplayName: string;
  profileImageUrl: string | null;
  followerCount: number;
  niche: string | null;
  viralTweetCount: number;
}

export interface SnipRadarViralTweet {
  id: string;
  trackedAccountId?: string;
  tweetId: string;
  text: string;
  authorUsername: string;
  authorDisplayName: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  hookType: string | null;
  format: string | null;
  emotionalTrigger: string | null;
  viralScore: number | null;
  whyItWorked: string | null;
  lessonsLearned: string[];
  publishedAt: string;
  isAnalyzed: boolean;
}

export interface SnipRadarDashboardData {
  profile?: {
    name: string | null;
    selectedNiche: string | null;
    onboardingCompleted: boolean;
  };
  account: {
    id: string;
    xUsername: string;
    xDisplayName: string;
    profileImageUrl: string | null;
    followerCount: number;
    followingCount: number;
    isActive: boolean;
  } | null;
  auth?: {
    reauthRequired: boolean;
    message: string | null;
    refreshedToken: boolean;
  } | null;
  stats: {
    periodDays: number;
    followerCount: number;
    followerGrowth7d: number;
    tweetsPosted: number;
    actualTweetCount: number;
    avgEngagementRate: number;
    avgImpressionsPerPost: number;
    impressionsTrend: Array<{ date: string; impressions: number }>;
  };
  counts: {
    trackedAccounts: number;
    drafts: number;
    scheduledDrafts: number;
    postedDrafts: number;
    dueScheduledDrafts: number;
    viralTweets: number;
    analyzedViralTweets: number;
    activeAutoDmAutomations: number;
  };
  activation?: {
    ecosystemLabel: string;
    activated: boolean;
    activationEventLabel: string;
    activationCompletedAt: string | null;
    ahaMoment: string;
    successThreshold: string;
    progressPct: number;
    nextStep: {
      id: string;
      label: string;
      url?: string;
    } | null;
    steps: Array<{
      id: string;
      label: string;
      description: string;
      completed: boolean;
      completedAt: string | null;
      kind: "milestone" | "aha" | "activation";
      url?: string;
    }>;
  };
  unitEconomics?: {
    estimatedDailyReadCalls: number;
    estimatedDailyWriteCalls: number;
    trackedAccounts: number;
    hydrationCandidates: number;
    guardrailState: "healthy" | "watch" | "high";
    reasons: string[];
    packagingRecommendation: string;
    model: {
      viralFetchRunsPerDay: number;
      accountSummaryRefreshCallsPerDay: number;
      metricsHydrationBatchCap: number;
      readCallsPerTrackedAccountPerDay: number;
      trackedAccountsWatchThreshold: number;
      trackedAccountsHighThreshold: number;
    };
  };
  trackedAccounts?: SnipRadarTrackedAccount[];
  drafts?: SnipRadarDraft[];
  scheduledDrafts?: SnipRadarDraft[];
  postedDrafts?: SnipRadarDraft[];
  recentDrafts?: SnipRadarDraft[];
  viralTweets?: SnipRadarViralTweet[];
}

interface SnipRadarContextValue {
  data: SnipRadarDashboardData | null;
  isLoading: boolean;
  error: Error | null;
  apiError: SnipRadarApiError | null;
  recovery: SnipRadarRecoveryState | null;
  isConnected: boolean;
  account: SnipRadarDashboardData["account"];
  auth: SnipRadarDashboardData["auth"];
  profile: NonNullable<SnipRadarDashboardData["profile"]>;
  stats: SnipRadarDashboardData["stats"];
  counts: SnipRadarDashboardData["counts"];
  activation: NonNullable<SnipRadarDashboardData["activation"]>;
  unitEconomics: NonNullable<SnipRadarDashboardData["unitEconomics"]>;
  trackedAccounts: SnipRadarTrackedAccount[];
  drafts: SnipRadarDraft[];
  scheduledDrafts: SnipRadarDraft[];
  postedDrafts: SnipRadarDraft[];
  viralTweets: SnipRadarViralTweet[];
  perf: Record<string, { clientMs: number; serverMs?: number; at: number }>;
  reportPerf: (
    key: string,
    metric: { clientMs: number; serverMs?: number; at?: number }
  ) => void;
  statsPeriodDays: 7 | 30;
  setStatsPeriodDays: (period: 7 | 30) => void;
  invalidate: () => void;
}

const SnipRadarContext = createContext<SnipRadarContextValue | undefined>(undefined);

function sortScheduledAsc(a: SnipRadarDraft, b: SnipRadarDraft) {
  if (!a.scheduledFor || !b.scheduledFor) return 0;
  return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
}

function sortPostedDesc(a: SnipRadarDraft, b: SnipRadarDraft) {
  const aTime = new Date(a.postedAt ?? a.createdAt).getTime();
  const bTime = new Date(b.postedAt ?? b.createdAt).getTime();
  return bTime - aTime;
}

export function SnipRadarProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const lastRefreshAtRef = useRef<number>(0);
  const refreshInFlightRef = useRef(false);
  const [perf, setPerf] = useState<
    Record<string, { clientMs: number; serverMs?: number; at: number }>
  >({});
  const [statsPeriodDays, setStatsPeriodDays] = useState<7 | 30>(7);
  const [refreshError, setRefreshError] = useState<SnipRadarApiError | null>(null);

  const reportPerf = (
    key: string,
    metric: { clientMs: number; serverMs?: number; at?: number }
  ) => {
    setPerf((prev) => ({
      ...prev,
      [key]: {
        clientMs: metric.clientMs,
        serverMs: metric.serverMs,
        at: metric.at ?? Date.now(),
      },
    }));
  };

  const { data, isLoading, error } = useQuery<SnipRadarDashboardData>({
    queryKey: ["snipradar-summary", statsPeriodDays],
    queryFn: async () => {
      const startedAt = performance.now();
      const res = await fetch(`/api/snipradar?scope=summary&periodDays=${statsPeriodDays}`);
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to fetch SnipRadar data");
      }
      const json = await res.json();
      reportPerf("summary", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      setRefreshError(null);
      return json;
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  const drafts = data
    ? (data.drafts ?? data.recentDrafts?.filter((d) => d.status === "draft") ?? [])
    : [];

  const scheduledDrafts = data
    ? (
        data.scheduledDrafts ??
        data.recentDrafts?.filter((d) => d.status === "scheduled").sort(sortScheduledAsc) ??
        []
      )
    : [];

  const postedDrafts = data
    ? (
        data.postedDrafts ??
        data.recentDrafts?.filter((d) => d.status === "posted").sort(sortPostedDesc) ??
        []
      )
    : [];

  const apiError = error
    ? toSnipRadarApiError(error, "Failed to load SnipRadar data")
    : refreshError;
  const recovery = deriveSnipRadarRecoveryState(apiError);

  const value: SnipRadarContextValue = {
    data: data ?? null,
    isLoading,
    error: (error as Error | null) ?? null,
    apiError,
    recovery,
    isConnected: !!data?.account,
    account: data?.account ?? null,
    auth: data?.auth ?? null,
    profile: data?.profile ?? {
      name: null,
      selectedNiche: null,
      onboardingCompleted: false,
    },
    stats: data?.stats ?? {
      periodDays: statsPeriodDays,
      followerCount: 0,
      followerGrowth7d: 0,
      tweetsPosted: 0,
      actualTweetCount: 0,
      avgEngagementRate: 0,
      avgImpressionsPerPost: 0,
      impressionsTrend: [],
    },
    counts: data?.counts ?? {
      trackedAccounts: 0,
      drafts: 0,
      scheduledDrafts: 0,
      postedDrafts: 0,
      dueScheduledDrafts: 0,
      viralTweets: 0,
      analyzedViralTweets: 0,
      activeAutoDmAutomations: 0,
    },
    activation: data?.activation ?? {
      ecosystemLabel: "SnipRadar",
      activated: false,
      activationEventLabel: "First scheduled post",
      activationCompletedAt: null,
      ahaMoment:
        "The first real value moment is moving from connected data to a scheduled post in the X workflow.",
      successThreshold:
        "Activation requires an X connection, a tracked account, and a first scheduled post.",
      progressPct: 0,
      nextStep: null,
      steps: [],
    },
    unitEconomics: data?.unitEconomics ?? {
      estimatedDailyReadCalls: 0,
      estimatedDailyWriteCalls: 0,
      trackedAccounts: 0,
      hydrationCandidates: 0,
      guardrailState: "healthy",
      reasons: [],
      packagingRecommendation:
        "Current tracked-account volume is within the efficient operating envelope for the existing SnipRadar fetch cadence.",
      model: {
        viralFetchRunsPerDay: 4,
        accountSummaryRefreshCallsPerDay: 4,
        metricsHydrationBatchCap: 15,
        readCallsPerTrackedAccountPerDay: 4,
        trackedAccountsWatchThreshold: 12,
        trackedAccountsHighThreshold: 25,
      },
    },
    trackedAccounts: data?.trackedAccounts ?? [],
    drafts,
    scheduledDrafts,
    postedDrafts,
    viralTweets: data?.viralTweets ?? [],
    perf,
    reportPerf,
    statsPeriodDays,
    setStatsPeriodDays,
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-discover-data"] });
      queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
    },
  };

  useEffect(() => {
    const accountId = data?.account?.id;
    if (!accountId) return;

    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    const runRefresh = async () => {
      if (refreshInFlightRef.current) return;
      const now = Date.now();
      if (now - lastRefreshAtRef.current < REFRESH_INTERVAL_MS) return;

      refreshInFlightRef.current = true;
      try {
        const res = await fetch("/api/snipradar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "refresh" }),
        });
        if (!res.ok) {
          throw await parseSnipRadarApiError(res, "Failed to refresh SnipRadar");
        }
        const payload = (await res.json()) as {
          refreshed?: boolean;
          hydratedMetrics?: number;
          durationMs?: number;
        };
        reportPerf("refresh", {
          clientMs: payload.durationMs ?? 0,
          serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
        });
        setRefreshError(null);
        if (payload.refreshed || (payload.hydratedMetrics ?? 0) > 0) {
          queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] });
          queryClient.invalidateQueries({ queryKey: ["snipradar-create-data"] });
        }
        lastRefreshAtRef.current = Date.now();
      } catch (refreshError) {
        setRefreshError(toSnipRadarApiError(refreshError, "Failed to refresh SnipRadar"));
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    runRefresh();
    const interval = setInterval(runRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [data?.account?.id, queryClient]);

  return <SnipRadarContext.Provider value={value}>{children}</SnipRadarContext.Provider>;
}

export function useSnipRadar() {
  const ctx = useContext(SnipRadarContext);
  if (!ctx) {
    throw new Error("useSnipRadar must be used within SnipRadarProvider");
  }
  return ctx;
}
