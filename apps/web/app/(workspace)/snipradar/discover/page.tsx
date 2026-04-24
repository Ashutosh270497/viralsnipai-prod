"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Rss,
  Users,
  MessageSquare,
  SlidersHorizontal,
  X as XIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { cn } from "@/lib/utils";
import { parseServerTimingMs } from "@/lib/server-timing";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";
import { ViralTweetCard } from "@/components/snipradar/viral-tweet-card";
import { EngagementFinder } from "@/components/snipradar/engagement-finder";
import { useBillingSubscriptionState } from "@/hooks/use-billing-subscription";
import { getNextBillingPlan, getSnipRadarBillingGateDetails } from "@/lib/snipradar/billing-gates";
import {
  parseSnipRadarApiError,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";
import { isDiscoverTab, type DiscoverTab } from "@/lib/snipradar-tabs";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";

const AddTrackedAccountDialog = dynamic(
  () =>
    import("@/components/snipradar/add-tracked-account-dialog").then((m) => ({
      default: m.AddTrackedAccountDialog,
    })),
  { ssr: false },
);
const TrackedAccountDetailDialog = dynamic(
  () =>
    import("@/components/snipradar/tracked-account-detail-dialog").then((m) => ({
      default: m.TrackedAccountDetailDialog,
    })),
  { ssr: false },
);

interface FetchViralResponse {
  success: boolean;
  fetched: number;
  processedAccounts?: number;
  accountResults?: Array<{
    accountId: string;
    username: string;
    fetchedTweets: number;
    viralDetected: number;
    savedTweets: number;
    fallbackSaved?: number;
    error: string | null;
  }>;
}

function useUrlTab(defaultTab: DiscoverTab, tabOverride?: DiscoverTab) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabOverride ?? (isDiscoverTab(tabParam) ? tabParam : defaultTab);

  const setTab = (nextTab: DiscoverTab) => {
    router.replace(`/snipradar/discover/${nextTab}`, { scroll: false });
  };

  return { tab, setTab };
}

export default function SnipRadarDiscoverPage({
  tabOverride,
}: {
  tabOverride?: DiscoverTab;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingQuery = useBillingSubscriptionState();
  const { invalidate, reportPerf, profile } = useSnipRadar();
  const flags = useFeatureFlags();
  const {
    data: discoverData,
    isLoading: discoverLoading,
    refetch: refetchDiscover,
  } = useQuery<{
    trackedAccounts: Array<{
      id: string;
      trackedUsername: string;
      trackedDisplayName: string;
      profileImageUrl: string | null;
      followerCount: number;
      niche: string | null;
      viralTweetCount: number;
    }>;
    viralTweets: Array<{
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
    }>;
  }>({
    queryKey: ["snipradar-discover-data"],
    queryFn: async () => {
      const startedAt = performance.now();
      const res = await fetch("/api/snipradar/discover-data");
      if (!res.ok) throw new Error("Failed to fetch discover data");
      reportPerf("discover_data", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json();
    },
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
  const trackedAccounts = useMemo(
    () => discoverData?.trackedAccounts ?? [],
    [discoverData?.trackedAccounts],
  );
  const viralTweets = useMemo(() => discoverData?.viralTweets ?? [], [discoverData?.viralTweets]);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedTrackedIds, setSelectedTrackedIds] = useState<string[]>([]);
  const [selectedFeedAccountId, setSelectedFeedAccountId] = useState<string>("all");
  const [feedSearch, setFeedSearch] = useState("");
  const [feedAnalysisFilter, setFeedAnalysisFilter] = useState<"all" | "analyzed" | "unanalyzed">(
    "all",
  );
  const [feedSort, setFeedSort] = useState<"score" | "recent" | "likes">("score");
  // Advanced filters
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [feedMinLikes, setFeedMinLikes] = useState<number>(0);
  const [feedMinReposts, setFeedMinReposts] = useState<number>(0);
  const [feedDateRange, setFeedDateRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [feedHookType, setFeedHookType] = useState<string>("all");
  const [feedFormat, setFeedFormat] = useState<string>("all");
  const [trackerNicheFilter, setTrackerNicheFilter] = useState<string>("all");
  const [trackerFollowerFilter, setTrackerFollowerFilter] = useState<
    "all" | "lt50k" | "50k-250k" | "250kplus"
  >("all");
  const [trackerOnlyActive, setTrackerOnlyActive] = useState(false);
  const [lastFetchSummary, setLastFetchSummary] = useState<
    FetchViralResponse["accountResults"] | null
  >(null);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const [lastFetchInfo, setLastFetchInfo] = useState<string | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<{
    id: string;
    username: string;
    viralTweetCount: number;
  } | null>(null);
  const [didAutoFetchStarterFeed, setDidAutoFetchStarterFeed] = useState(false);

  const { tab, setTab } = useUrlTab("tracker", tabOverride);
  const justConnected = searchParams.get("connected") === "true";
  const seededCount = Number(searchParams.get("seeded") ?? "0");
  const showStarterBanner = searchParams.get("welcome") === "1" || justConnected;

  const fetchViralMutation = useMutation<
    FetchViralResponse,
    Error,
    { trackedAccountIds?: string[] } | undefined
  >({
    mutationFn: async (vars) => {
      const startedAt = performance.now();
      const res = await fetch("/api/snipradar/viral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          vars?.trackedAccountIds?.length ? { trackedAccountIds: vars.trackedAccountIds } : {},
        ),
      });
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to fetch tweets");
      }
      reportPerf("discover_fetch_viral", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json();
    },
    onMutate: () => {
      setLastFetchSummary(null);
      setLastFetchError(null);
      setLastFetchInfo(null);
    },
    onSuccess: (result) => {
      setLastFetchSummary(result.accountResults ?? null);
      if ((result.fetched ?? 0) === 0) {
        setLastFetchInfo(
          "No new tweets were saved from this fetch. Try a different account set or click Analyze after fetch.",
        );
      } else {
        setLastFetchInfo(
          `Fetch complete: ${result.fetched} tweets saved across ${result.processedAccounts ?? 0} account(s).`,
        );
      }
      invalidate();
      refetchDiscover();
    },
    onError: (error) => {
      setLastFetchError(error.message);
    },
  });

  const analyzeMutation = useMutation<
    { success: boolean; analyzed: number; total?: number; message?: string },
    Error,
    { trackedAccountIds?: string[] } | undefined
  >({
    mutationFn: async (vars) => {
      const startedAt = performance.now();
      const res = await fetch("/api/snipradar/viral/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          vars?.trackedAccountIds?.length ? { trackedAccountIds: vars.trackedAccountIds } : {},
        ),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to analyze tweets");
      }
      reportPerf("discover_analyze_viral", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json();
    },
    onSuccess: () => {
      trackSnipRadarEvent("snipradar_discover_analyze_all", {
        trackedScope: selectedTrackedIds.length > 0 ? "selected" : "all",
        trackedCount: selectedOrAll.length,
      });
      invalidate();
      refetchDiscover();
    },
  });

  useEffect(() => {
    if (
      !justConnected ||
      didAutoFetchStarterFeed ||
      trackedAccounts.length === 0 ||
      viralTweets.length > 0 ||
      fetchViralMutation.isPending
    ) {
      return;
    }

    setDidAutoFetchStarterFeed(true);
    fetchViralMutation.mutate(undefined);
  }, [
    didAutoFetchStarterFeed,
    fetchViralMutation,
    justConnected,
    trackedAccounts.length,
    viralTweets.length,
  ]);

  const remixMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/snipradar/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to remix tweet");
      }
      return res.json() as Promise<{ rewritten: string }>;
    },
    onSuccess: (payload) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("snipradar:remixDraftSeed", payload.rewritten);
        void navigator.clipboard?.writeText(payload.rewritten);
      }
      setLastFetchInfo("Remixed draft copied and opened in Create.");
      router.push("/snipradar/create/drafts");
    },
    onError: (error) => {
      setLastFetchError(error.message);
    },
  });

  const clearViralMutation = useMutation({
    mutationFn: async () => {
      const startedAt = performance.now();
      const res = await fetch("/api/snipradar/viral", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to clear feed");
      }
      reportPerf("discover_clear_viral", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      refetchDiscover();
    },
  });

  const deleteTrackedMutation = useMutation({
    mutationFn: async (id: string) => {
      const startedAt = performance.now();
      const res = await fetch(`/api/snipradar/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");
      reportPerf("discover_delete_account", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      refetchDiscover();
    },
  });

  const hasAnalyzedTweets = viralTweets.some((tweet) => tweet.isAnalyzed);

  const trackerNiches = useMemo(
    () =>
      Array.from(
        new Set(trackedAccounts.map((account) => account.niche).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [trackedAccounts],
  );

  const filteredTrackedAccounts = useMemo(() => {
    return trackedAccounts.filter((account) => {
      if (trackerNicheFilter !== "all" && (account.niche ?? "") !== trackerNicheFilter) {
        return false;
      }
      if (trackerFollowerFilter === "lt50k" && account.followerCount >= 50_000) {
        return false;
      }
      if (
        trackerFollowerFilter === "50k-250k" &&
        (account.followerCount < 50_000 || account.followerCount > 250_000)
      ) {
        return false;
      }
      if (trackerFollowerFilter === "250kplus" && account.followerCount < 250_000) {
        return false;
      }
      if (trackerOnlyActive && account.viralTweetCount <= 0) {
        return false;
      }
      return true;
    });
  }, [trackedAccounts, trackerFollowerFilter, trackerNicheFilter, trackerOnlyActive]);

  const allTrackedSelected =
    filteredTrackedAccounts.length > 0 &&
    filteredTrackedAccounts.every((account) => selectedTrackedIds.includes(account.id));
  const selectedOrAll =
    selectedTrackedIds.length > 0 ? selectedTrackedIds : trackedAccounts.map((a) => a.id);

  const filteredViralTweets = useMemo(() => {
    const searchTerm = feedSearch.trim().toLowerCase();
    const accountHandleById = new Map(
      trackedAccounts.map((account) => [account.id, account.trackedUsername.toLowerCase()]),
    );

    const filtered = viralTweets.filter((tweet) => {
      if (
        selectedFeedAccountId !== "all" &&
        tweet.trackedAccountId &&
        tweet.trackedAccountId !== selectedFeedAccountId
      ) {
        return false;
      }

      if (selectedFeedAccountId !== "all" && !tweet.trackedAccountId) {
        const expectedHandle = accountHandleById.get(selectedFeedAccountId);
        if (expectedHandle && tweet.authorUsername.toLowerCase() !== expectedHandle) {
          return false;
        }
      }

      if (feedAnalysisFilter === "analyzed" && !tweet.isAnalyzed) return false;
      if (feedAnalysisFilter === "unanalyzed" && tweet.isAnalyzed) return false;

      // Advanced filters
      if (feedMinLikes > 0 && tweet.likes < feedMinLikes) return false;
      if (feedMinReposts > 0 && tweet.retweets < feedMinReposts) return false;
      if (feedHookType !== "all" && tweet.hookType !== feedHookType) return false;
      if (feedFormat !== "all" && tweet.format !== feedFormat) return false;
      if (feedDateRange !== "all") {
        const cutoff = new Date();
        if (feedDateRange === "today") cutoff.setHours(0, 0, 0, 0);
        else if (feedDateRange === "7d") cutoff.setDate(cutoff.getDate() - 7);
        else if (feedDateRange === "30d") cutoff.setDate(cutoff.getDate() - 30);
        if (new Date(tweet.publishedAt) < cutoff) return false;
      }

      if (!searchTerm) return true;
      return (
        tweet.text.toLowerCase().includes(searchTerm) ||
        tweet.authorUsername.toLowerCase().includes(searchTerm) ||
        tweet.authorDisplayName.toLowerCase().includes(searchTerm)
      );
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (feedSort === "recent") {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
      if (feedSort === "likes") {
        return b.likes - a.likes;
      }
      const scoreDelta = (b.viralScore ?? 0) - (a.viralScore ?? 0);
      if (scoreDelta !== 0) return scoreDelta;
      return b.likes - a.likes;
    });

    return sorted;
  }, [
    viralTweets,
    trackedAccounts,
    selectedFeedAccountId,
    feedAnalysisFilter,
    feedSearch,
    feedSort,
    feedMinLikes,
    feedMinReposts,
    feedDateRange,
    feedHookType,
    feedFormat,
  ]);

  const activeAdvancedFilterCount = [
    feedMinLikes > 0,
    feedMinReposts > 0,
    feedDateRange !== "all",
    feedHookType !== "all",
    feedFormat !== "all",
  ].filter(Boolean).length;

  function resetAdvancedFilters() {
    setFeedMinLikes(0);
    setFeedMinReposts(0);
    setFeedDateRange("all");
    setFeedHookType("all");
    setFeedFormat("all");
  }

  const topPatternSummary = useMemo(() => {
    const analyzed = filteredViralTweets.filter((tweet) => tweet.isAnalyzed);
    if (analyzed.length === 0) return null;

    const counts = analyzed.reduce(
      (acc, tweet) => {
        if (tweet.hookType) acc.hooks[tweet.hookType] = (acc.hooks[tweet.hookType] ?? 0) + 1;
        if (tweet.format) acc.formats[tweet.format] = (acc.formats[tweet.format] ?? 0) + 1;
        return acc;
      },
      { hooks: {} as Record<string, number>, formats: {} as Record<string, number> },
    );
    const topHook = Object.entries(counts.hooks).sort((a, b) => b[1] - a[1])[0];
    const topFormat = Object.entries(counts.formats).sort((a, b) => b[1] - a[1])[0];
    if (!topHook && !topFormat) return null;

    const hookPart = topHook ? `${topHook[0]} hooks` : "";
    const formatPart = topFormat ? `${topFormat[0]} formats` : "";
    return `Top pattern from ${analyzed.length} analyzed tweets: ${[hookPart, formatPart]
      .filter(Boolean)
      .join(" + ")} drive the strongest viral signals.`;
  }, [filteredViralTweets]);

  useEffect(() => {
    setSelectedTrackedIds((prev) => prev.filter((id) => trackedAccounts.some((a) => a.id === id)));

    if (
      selectedFeedAccountId !== "all" &&
      !trackedAccounts.some((a) => a.id === selectedFeedAccountId)
    ) {
      setSelectedFeedAccountId("all");
    }
  }, [trackedAccounts, selectedFeedAccountId]);

  /* ── shared select className ──────────────────────────────── */
  const glassSelect =
    "h-8 appearance-none rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] pl-2.5 pr-7 text-[11px] text-foreground/70 outline-none focus:ring-1 focus:ring-violet-500/40 transition-colors cursor-pointer";
  const trackedAccountsLimit =
    billingQuery.data?.limits.trackedAccounts === "unlimited"
      ? "unlimited"
      : billingQuery.data?.limits.trackedAccounts ?? null;
  const trackedAccountsRemaining =
    trackedAccountsLimit === "unlimited" || trackedAccountsLimit === null
      ? trackedAccountsLimit
      : Math.max(0, trackedAccountsLimit - (billingQuery.data?.usage.trackedAccounts ?? 0));
  const viralFetchRemaining =
    billingQuery.data?.limits.viralFeedFetches === "unlimited"
      ? "unlimited"
      : billingQuery.data
        ? Math.max(0, billingQuery.data.limits.viralFeedFetches - billingQuery.data.usage.viralFeedFetches)
        : null;
  const trackerGateDetails =
    billingQuery.data &&
    trackedAccountsRemaining === 0
      ? {
          kind: "usage_limit_reached" as const,
          feature: "tracker" as const,
          currentPlan: billingQuery.data.plan.id,
          requiredPlan: getNextBillingPlan(billingQuery.data.plan.id),
          upgradePlan: getNextBillingPlan(billingQuery.data.plan.id),
          remaining: 0,
          limit: billingQuery.data.limits.trackedAccounts,
        }
      : null;
  const viralGateDetails =
    billingQuery.data &&
    viralFetchRemaining === 0
      ? {
          kind: "usage_limit_reached" as const,
          feature: "viralFeed" as const,
          action: "viral_fetch" as const,
          currentPlan: billingQuery.data.plan.id,
          requiredPlan: getNextBillingPlan(billingQuery.data.plan.id),
          upgradePlan: getNextBillingPlan(billingQuery.data.plan.id),
          remaining: 0,
          limit: billingQuery.data.limits.viralFeedFetches,
        }
      : getSnipRadarBillingGateDetails(
          fetchViralMutation.error
            ? toSnipRadarApiError(fetchViralMutation.error, "Failed to fetch tweets")
            : null
        );
  const engagementLocked =
    billingQuery.data ? billingQuery.data.limits.engagementFinder === false : false;

  return (
    <>
      <Tabs value={tab} onValueChange={(value) => setTab(value as DiscoverTab)}>
        {/* ── Pill Tab Bar ──────────────────────────────────────── */}
        <TabsList className="mb-5 h-auto w-auto gap-0.5 rounded-xl border border-border/50 dark:border-white/[0.07] bg-muted/30 dark:bg-white/[0.03] p-1">
          {[
            { value: "tracker", label: "Tracker", icon: Users },
            { value: "viral", label: "Viral Feed", icon: Rss },
            { value: "engagement", label: "Engagement", icon: MessageSquare },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex h-8 items-center gap-1.5 rounded-lg px-4 text-[12px] font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-muted/80 dark:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground/60 data-[state=inactive]:hover:text-muted-foreground dark:data-[state=inactive]:text-muted-foreground/50"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ══════════════════════════════════════════════════════ */}
        {/*  TRACKER TAB                                           */}
        {/* ══════════════════════════════════════════════════════ */}
        <TabsContent value="tracker" className="mt-0 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border/50 dark:border-white/[0.07] bg-gradient-to-br from-muted/30 dark:from-white/[0.03] to-transparent">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 dark:border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15">
                  <Users className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
                    Tracked Accounts
                  </p>
                  <p className="text-[11px] text-muted-foreground/50">
                    {trackedAccounts.length} account{trackedAccounts.length !== 1 ? "s" : ""} being tracked
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Fetch button */}
                <button
                  type="button"
                  disabled={
                    fetchViralMutation.isPending ||
                    trackedAccounts.length === 0 ||
                    viralFetchRemaining === 0
                  }
                  onClick={() => fetchViralMutation.mutate({ trackedAccountIds: selectedOrAll })}
                  className="flex items-center gap-1.5 rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-foreground/70 transition-all hover:bg-muted/60 dark:bg-white/[0.07] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {fetchViralMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {selectedTrackedIds.length > 0 ? "Fetch Selected" : "Fetch All"}
                </button>

                {/* Analyze button */}
                <button
                  type="button"
                  disabled={analyzeMutation.isPending || trackedAccounts.length === 0}
                  onClick={() => analyzeMutation.mutate({ trackedAccountIds: selectedOrAll })}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[12px] font-medium text-violet-400 transition-all hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {analyzeMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  {selectedTrackedIds.length > 0 ? "Analyze Selected" : "Analyze All"}
                </button>

                {/* Add Account button */}
                <button
                  type="button"
                  disabled={trackedAccountsRemaining === 0}
                  onClick={() => setAddAccountOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-all hover:from-purple-600 hover:to-pink-600 hover:shadow-lg hover:shadow-purple-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Account
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-4 px-5 py-4">
              {/* Status banners */}
              {discoverLoading && (
                <div className="flex items-center gap-2 rounded-xl border border-border/40 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] px-3.5 py-2.5 text-xs text-muted-foreground/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  Loading tracked accounts…
                </div>
              )}
              {lastFetchError && !viralGateDetails && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3.5 py-2.5 text-xs text-red-400">
                  {lastFetchError}
                </div>
              )}
              {lastFetchInfo && (
                <div className="flex items-start gap-2 rounded-xl border border-border/40 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] px-3.5 py-2.5 text-xs text-muted-foreground/60">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  {lastFetchInfo}
                </div>
              )}
              {showStarterBanner ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.07] px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                      Activation
                    </p>
                    <p className="text-sm font-medium text-cyan-100">
                      {justConnected
                        ? seededCount > 0
                          ? `Connected. Seeded ${seededCount} starter accounts for ${profile.selectedNiche ?? "your niche"}.`
                          : "Connected. Your radar is ready for the first fetch."
                        : `Welcome to SnipRadar${profile.selectedNiche ? ` for ${profile.selectedNiche}` : ""}.`}
                    </p>
                    <p className="text-xs text-cyan-100/75">
                      {trackedAccounts.length > 0
                        ? viralTweets.length > 0
                          ? "Your starter feed is live. Review patterns here, then move into Create."
                          : "We’ll fetch the first set of tweets from your starter accounts so the feed is not empty."
                        : "Connect and track a few strong accounts to start building your radar."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => router.push("/snipradar/create/drafts")}
                      className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      Open Create
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/snipradar/publish/calendar")}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-cyan-50/90 transition hover:bg-white/[0.06]"
                    >
                      Open Publish
                    </button>
                  </div>
                </div>
              ) : null}
              {trackerGateDetails ? <SnipRadarBillingGateCard details={trackerGateDetails} compact /> : null}
              {viralGateDetails ? <SnipRadarBillingGateCard details={viralGateDetails} compact /> : null}

              {trackedAccounts.length === 0 ? (
                <SnipRadarEmptyState
                  icon={Users}
                  eyebrow="Tracker"
                  title="Your radar has no signal sources yet"
                  description="Track a few niche leaders first. SnipRadar will fetch their best-performing posts, analyze the patterns, and feed the rest of the workflow."
                  hint="Start with 3 to 5 accounts in one niche for the cleanest viral pattern detection."
                  primaryAction={{
                    label: "Add first account",
                    onClick: () => setAddAccountOpen(true),
                  }}
                />
              ) : (
                <>
                  {/* Select-all row */}
                  <div className="flex items-center justify-between rounded-xl border border-border/40 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] px-3.5 py-2">
                    <label className="flex cursor-pointer items-center gap-2.5 text-xs text-muted-foreground/60">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-violet-500"
                        checked={allTrackedSelected}
                        onChange={(e) =>
                          setSelectedTrackedIds((current) => {
                            if (!e.target.checked) {
                              return current.filter(
                                (id) =>
                                  !filteredTrackedAccounts.some((account) => account.id === id),
                              );
                            }
                            const additions = filteredTrackedAccounts
                              .map((account) => account.id)
                              .filter((id) => !current.includes(id));
                            return [...current, ...additions];
                          })
                        }
                      />
                      Select all accounts
                    </label>
                    {selectedTrackedIds.length > 0 && (
                      <span className="text-[11px] font-semibold text-violet-400">
                        {selectedTrackedIds.length} selected
                      </span>
                    )}
                    {selectedTrackedIds.length === 0 && (
                      <span className="text-[11px] text-muted-foreground/30">0 selected</span>
                    )}
                  </div>

                  {/* Filters (v2 flag) */}
                  {flags.snipRadarDiscoverV2Enabled && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Niche select */}
                      <div className="relative flex-1" style={{ minWidth: 140 }}>
                        <select
                          value={trackerNicheFilter}
                          onChange={(e) => setTrackerNicheFilter(e.target.value)}
                          className={cn(glassSelect, "w-full")}
                        >
                          <option value="all">Niche: All</option>
                          {trackerNiches.map((niche) => (
                            <option key={niche} value={niche}>
                              {niche}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/40" />
                      </div>

                      {/* Follower range select */}
                      <div className="relative flex-1" style={{ minWidth: 160 }}>
                        <select
                          value={trackerFollowerFilter}
                          onChange={(e) =>
                            setTrackerFollowerFilter(
                              e.target.value as "all" | "lt50k" | "50k-250k" | "250kplus",
                            )
                          }
                          className={cn(glassSelect, "w-full")}
                        >
                          <option value="all">Follower range: All</option>
                          <option value="lt50k">Less than 50k</option>
                          <option value="50k-250k">50k to 250k</option>
                          <option value="250kplus">250k+</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/40" />
                      </div>

                      {/* Active only toggle */}
                      <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-3 text-[11px] text-foreground/60 transition-colors hover:bg-muted/60 dark:bg-white/[0.07]">
                        <input
                          type="checkbox"
                          checked={trackerOnlyActive}
                          onChange={(e) => setTrackerOnlyActive(e.target.checked)}
                          className="h-3.5 w-3.5 accent-emerald-500"
                        />
                        Active only
                      </label>
                    </div>
                  )}

                  {/* AI pattern callout */}
                  {flags.snipRadarDiscoverV2Enabled && topPatternSummary && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-violet-500/15 bg-violet-500/[0.06] px-3.5 py-2.5">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                      <p className="text-xs leading-relaxed text-violet-300/90">
                        {topPatternSummary}
                      </p>
                    </div>
                  )}

                  {/* Account cards grid */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredTrackedAccounts.map((account) => (
                      <div
                        key={account.id}
                        className={cn(
                          "group cursor-pointer rounded-2xl border bg-gradient-to-br from-muted/40 dark:from-white/[0.04] to-transparent p-4 transition-all hover:from-muted/60 dark:from-white/[0.06] hover:border-border/70 dark:border-white/15",
                          selectedTrackedIds.includes(account.id)
                            ? "border-violet-500/30 bg-violet-500/[0.04]"
                            : "border-border/50 dark:border-white/[0.07]",
                        )}
                        onClick={() => setSelectedAccountId(account.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 shrink-0 accent-violet-500"
                              checked={selectedTrackedIds.includes(account.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                setSelectedTrackedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, account.id]
                                    : prev.filter((id) => id !== account.id),
                                )
                              }
                            />

                            {/* Avatar */}
                            {account.profileImageUrl ? (
                              <Image
                                src={account.profileImageUrl}
                                alt={account.trackedDisplayName}
                                width={36}
                                height={36}
                                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/[0.07]"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 ring-2 ring-white/[0.07]">
                                <span className="text-xs font-bold text-violet-300">
                                  {account.trackedUsername[0]?.toUpperCase()}
                                </span>
                              </div>
                            )}

                            {/* Name + meta */}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                @{account.trackedUsername}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="text-[11px] text-muted-foreground/50">
                                  {account.followerCount >= 1_000_000
                                    ? `${(account.followerCount / 1_000_000).toFixed(1)}M`
                                    : account.followerCount >= 1_000
                                    ? `${(account.followerCount / 1_000).toFixed(1)}K`
                                    : account.followerCount}{" "}
                                  followers
                                </span>
                                {account.niche && (
                                  <span className="rounded-md border border-violet-500/20 bg-violet-500/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                                    {account.niche}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Delete button */}
                          <button
                            type="button"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent opacity-0 transition-all group-hover:border-red-500/20 group-hover:bg-red-500/[0.07] group-hover:opacity-100 hover:!opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAccountToDelete({
                                id: account.id,
                                username: account.trackedUsername,
                                viralTweetCount: account.viralTweetCount,
                              });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
                          </button>
                        </div>

                        {/* Footer stats */}
                        <div className="mt-3 flex items-center justify-between border-t border-border/30 dark:border-white/[0.05] pt-2.5">
                          <span className="text-xs text-muted-foreground/50">
                            {account.viralTweetCount} viral tweet
                            {account.viralTweetCount !== 1 ? "s" : ""}
                          </span>
                          {account.viralTweetCount > 0 ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/30">No signals</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredTrackedAccounts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border/60 dark:border-white/[0.08] py-10 text-center text-xs text-muted-foreground/40">
                      No tracked accounts match the selected filters.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════ */}
        {/*  VIRAL FEED TAB                                        */}
        {/* ══════════════════════════════════════════════════════ */}
        <TabsContent value="viral" className="mt-0 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border/50 dark:border-white/[0.07] bg-gradient-to-br from-muted/30 dark:from-white/[0.03] to-transparent">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 dark:border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/15">
                  <Rss className="h-4 w-4 text-pink-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-400">
                    Viral Feed
                  </p>
                  <p className="text-[11px] text-muted-foreground/50">
                    {filteredViralTweets.length} tweet{filteredViralTweets.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={fetchViralMutation.isPending}
                  onClick={() =>
                    fetchViralMutation.mutate(
                      selectedFeedAccountId === "all"
                        ? undefined
                        : { trackedAccountIds: [selectedFeedAccountId] },
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-foreground/70 transition-all hover:bg-muted/60 dark:bg-white/[0.07] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {fetchViralMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Fetch
                </button>
                <button
                  type="button"
                  disabled={analyzeMutation.isPending || filteredViralTweets.length === 0}
                  onClick={() =>
                    analyzeMutation.mutate(
                      selectedFeedAccountId === "all"
                        ? undefined
                        : { trackedAccountIds: [selectedFeedAccountId] },
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[12px] font-medium text-violet-400 transition-all hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {analyzeMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Analyze
                </button>
                {viralTweets.length > 0 && (
                  <button
                    type="button"
                    disabled={clearViralMutation.isPending}
                    onClick={() => clearViralMutation.mutate()}
                    className="flex items-center gap-1.5 rounded-lg border border-border/40 dark:border-white/[0.06] bg-transparent px-3 py-1.5 text-[12px] font-medium text-muted-foreground/50 transition-all hover:border-red-500/20 hover:bg-red-500/[0.07] hover:text-red-400 disabled:opacity-40"
                  >
                    {clearViralMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Filter area */}
            {trackedAccounts.length > 0 && (
              <div className="border-b border-border/30 dark:border-white/[0.05] px-5 py-3 space-y-3">
                {/* Account pills */}
                <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedFeedAccountId("all")}
                    className={cn(
                      "rounded-lg px-3 py-1 text-[11px] font-semibold transition-all",
                      selectedFeedAccountId === "all"
                        ? "bg-muted/80 dark:bg-white/10 text-white"
                        : "border border-border/50 dark:border-white/[0.07] text-muted-foreground/50 hover:text-muted-foreground",
                    )}
                  >
                    All Accounts
                  </button>
                  {trackedAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setSelectedFeedAccountId(account.id)}
                      className={cn(
                        "rounded-lg px-3 py-1 text-[11px] font-semibold transition-all",
                        selectedFeedAccountId === account.id
                          ? "bg-pink-500/15 text-pink-400 border border-pink-500/20"
                          : "border border-border/50 dark:border-white/[0.07] text-muted-foreground/50 hover:text-muted-foreground",
                      )}
                    >
                      @{account.trackedUsername}
                    </button>
                  ))}
                </div>

                {/* Search + filter row */}
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground/40" />
                    <input
                      value={feedSearch}
                      onChange={(e) => setFeedSearch(e.target.value)}
                      placeholder="Search tweet text or handle"
                      className="h-8 w-full rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] pl-7 pr-2.5 text-[11px] text-foreground/70 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-pink-500/40 transition-colors"
                    />
                  </div>

                  <div className="relative">
                    <select
                      value={feedAnalysisFilter}
                      onChange={(e) =>
                        setFeedAnalysisFilter(
                          e.target.value as "all" | "analyzed" | "unanalyzed",
                        )
                      }
                      className={cn(glassSelect, "w-full")}
                    >
                      <option value="all">All tweets</option>
                      <option value="analyzed">Analyzed only</option>
                      <option value="unanalyzed">Unanalyzed only</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-muted-foreground/40" />
                  </div>

                  <div className="relative">
                    <select
                      value={feedSort}
                      onChange={(e) =>
                        setFeedSort(e.target.value as "score" | "recent" | "likes")
                      }
                      className={cn(glassSelect, "w-full")}
                    >
                      <option value="score">Sort: Viral score</option>
                      <option value="recent">Sort: Recent</option>
                      <option value="likes">Sort: Likes</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-muted-foreground/40" />
                  </div>
                </div>

                {/* Advanced filters toggle */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setAdvancedFiltersOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Advanced Filters
                    {activeAdvancedFilterCount > 0 && (
                      <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500/20 text-[10px] font-bold text-pink-400">
                        {activeAdvancedFilterCount}
                      </span>
                    )}
                    {advancedFiltersOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  {activeAdvancedFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetAdvancedFilters}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      <XIcon className="h-3 w-3" />
                      Clear filters
                    </button>
                  )}
                </div>

                {/* Advanced filter panel */}
                {advancedFiltersOpen && (
                  <div className="grid gap-2 rounded-xl border border-border/40 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] p-3 md:grid-cols-5">
                    {/* Min likes */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Min Likes
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={feedMinLikes || ""}
                        onChange={(e) => setFeedMinLikes(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0"
                        className="h-8 w-full rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-2.5 text-[11px] text-foreground/70 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-pink-500/40 transition-colors"
                      />
                    </div>

                    {/* Min reposts */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Min Reposts
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={feedMinReposts || ""}
                        onChange={(e) => setFeedMinReposts(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0"
                        className="h-8 w-full rounded-lg border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-2.5 text-[11px] text-foreground/70 placeholder:text-muted-foreground/30 outline-none focus:ring-1 focus:ring-pink-500/40 transition-colors"
                      />
                    </div>

                    {/* Date range */}
                    <div className="space-y-1 relative">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Date Range
                      </label>
                      <select
                        value={feedDateRange}
                        onChange={(e) => setFeedDateRange(e.target.value as "all" | "today" | "7d" | "30d")}
                        className={cn(glassSelect, "w-full")}
                      >
                        <option value="all">All time</option>
                        <option value="today">Today</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 bottom-2 h-3 w-3 text-muted-foreground/40" />
                    </div>

                    {/* Hook type */}
                    <div className="space-y-1 relative">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Hook Type
                      </label>
                      <select
                        value={feedHookType}
                        onChange={(e) => setFeedHookType(e.target.value)}
                        className={cn(glassSelect, "w-full")}
                      >
                        <option value="all">Any hook</option>
                        <option value="question">Question</option>
                        <option value="stat">Stat / Data</option>
                        <option value="contrarian">Contrarian</option>
                        <option value="story">Story</option>
                        <option value="list">List</option>
                        <option value="challenge">Challenge</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 bottom-2 h-3 w-3 text-muted-foreground/40" />
                    </div>

                    {/* Format */}
                    <div className="space-y-1 relative">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Format
                      </label>
                      <select
                        value={feedFormat}
                        onChange={(e) => setFeedFormat(e.target.value)}
                        className={cn(glassSelect, "w-full")}
                      >
                        <option value="all">Any format</option>
                        <option value="one-liner">One-liner</option>
                        <option value="thread">Thread</option>
                        <option value="listicle">Listicle</option>
                        <option value="story">Story</option>
                        <option value="hot-take">Hot-take</option>
                        <option value="how-to">How-to</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 bottom-2 h-3 w-3 text-muted-foreground/40" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="px-5 py-4 space-y-3">
              {/* Fetch summary mini-cards */}
              {lastFetchSummary && lastFetchSummary.length > 0 && (
                <div className="grid gap-1.5 sm:grid-cols-2 rounded-xl border border-border/40 dark:border-white/[0.06] bg-muted/20 dark:bg-white/[0.02] p-3">
                  {lastFetchSummary.map((result) => (
                    <div
                      key={result.accountId}
                      className="flex items-center justify-between rounded-lg bg-muted/20 dark:bg-white/[0.02] px-2.5 py-1.5"
                    >
                      <span className="text-xs font-medium text-foreground/70">
                        @{result.username}
                      </span>
                      {result.error ? (
                        <span className="text-[11px] text-red-400">error</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50">
                          {result.fetchedTweets} fetched · {result.viralDetected} viral
                          {result.fallbackSaved ? ` · ${result.fallbackSaved} fallback` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pattern callout in feed */}
              {flags.snipRadarDiscoverV2Enabled && topPatternSummary && (
                <div className="flex items-start gap-2.5 rounded-xl border border-violet-500/15 bg-violet-500/[0.06] px-3.5 py-2.5">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                  <p className="text-xs leading-relaxed text-violet-300/90">{topPatternSummary}</p>
                </div>
              )}

              {/* Empty state */}
              {filteredViralTweets.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 dark:border-white/[0.08] py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10">
                    <Rss className="h-5 w-5 text-pink-400" />
                  </div>
                  <p className="text-sm font-semibold text-foreground/70">No tweets match this view</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground/50">
                    {viralTweets.length === 0
                      ? trackedAccounts.length === 0
                        ? "Add tracked accounts first."
                        : "Fetch recent tweets from tracked accounts."
                      : activeAdvancedFilterCount > 0 || feedSearch || feedAnalysisFilter !== "all"
                      ? "No tweets match your current filters — try clearing some."
                      : "Try changing filters."}
                  </p>
                  {viralTweets.length > 0 && (activeAdvancedFilterCount > 0 || feedSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFeedSearch("");
                        resetAdvancedFilters();
                      }}
                      className="mt-3 flex items-center gap-1 rounded-lg border border-border/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      <XIcon className="h-3 w-3" />
                      Clear all filters
                    </button>
                  )}
                  {trackedAccounts.length > 0 && viralTweets.length === 0 && (
                    <button
                      type="button"
                      disabled={fetchViralMutation.isPending}
                      onClick={() => fetchViralMutation.mutate(undefined)}
                      className="mt-5 flex items-center gap-1.5 rounded-xl border border-border/60 dark:border-white/[0.08] bg-muted/40 dark:bg-white/[0.04] px-4 py-2 text-xs font-semibold text-foreground/70 transition-all hover:bg-muted/60 dark:bg-white/[0.07] hover:text-foreground disabled:opacity-40"
                    >
                      {fetchViralMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Fetch Tweets
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
                  {filteredViralTweets.map((tweet) => (
                    <ViralTweetCard
                      key={tweet.id}
                      tweet={tweet}
                      remixPending={remixMutation.isPending}
                      onRemix={(tweetData) => {
                        trackSnipRadarEvent("snipradar_discover_remix_click", {
                          tweetId: tweetData.id,
                          author: tweetData.authorUsername,
                        });
                        remixMutation.mutate(tweetData.text);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════ */}
        {/*  ENGAGEMENT TAB                                        */}
        {/* ══════════════════════════════════════════════════════ */}
        <TabsContent value="engagement" className="mt-0 space-y-4">
          {engagementLocked && billingQuery.data ? (
            <SnipRadarBillingGateCard
              details={{
                kind: "upgrade_required",
                feature: "engagementFinder",
                currentPlan: billingQuery.data.plan.id,
                requiredPlan: "plus",
                upgradePlan: "plus",
              }}
            />
          ) : (
            <EngagementFinder />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ──────────────────────────────────────────── */}
      <AddTrackedAccountDialog
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onSuccess={() => {
          invalidate();
          refetchDiscover();
        }}
      />
      <TrackedAccountDetailDialog
        accountId={selectedAccountId}
        onClose={() => setSelectedAccountId(null)}
      />

      <AlertDialog
        open={accountToDelete !== null}
        onOpenChange={(open) => !open && setAccountToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tracked Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop tracking{" "}
              <span className="font-semibold text-foreground">@{accountToDelete?.username}</span>?
              {accountToDelete && accountToDelete.viralTweetCount > 0 && (
                <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive">
                    This will permanently delete:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-destructive/90">
                    <li>
                      {accountToDelete.viralTweetCount} viral tweet
                      {accountToDelete.viralTweetCount > 1 ? "s" : ""} and analysis
                    </li>
                    <li>All tracked data for this account</li>
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTrackedMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteTrackedMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!accountToDelete) return;
                deleteTrackedMutation.mutate(accountToDelete.id);
                setAccountToDelete(null);
              }}
            >
              {deleteTrackedMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete Account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
