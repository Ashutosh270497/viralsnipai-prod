"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import {
  ArrowUpDown,
  BookmarkPlus,
  CalendarDays,
  Copy,
  Eye,
  FileText,
  Filter,
  Globe2,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  ListFilter,
  Loader2,
  Minus,
  PenSquare,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Difficulty = "easy" | "medium" | "hard";
type TrendDirection = "rising" | "stable" | "falling";
type IntentType = "informational" | "commercial" | "transactional" | "navigational";

type KeywordResult = {
  keyword: string;
  searchVolume: number;
  competition: number;
  difficulty: Difficulty;
  recommendation: string;
  opportunityScore: number;
  trendDirection: TrendDirection;
  searchIntent: string;
  estimatedCPM: number | { min: number; max: number };
  relatedKeywords: string[];
  relatedKeywordClusters?: Record<string, string[]>;
  dataQuality?: {
    source: string;
    confidence: "high" | "medium" | "low";
    warnings: string[];
  };
  usage?: KeywordUsageQuota;
};

type KeywordRecommendationResponse = {
  recommendations: Array<{
    keyword: string;
    personalizedScore: number;
    confidence: "high" | "medium" | "low";
    predictedIntent: IntentType;
    sourceType: "history_related" | "pattern_generated";
    rationale: string;
    seedKeywords: string[];
    outcomeFitScore?: number;
  }>;
  profile?: {
    confidence: "high" | "medium" | "low";
    searchedKeywords: number;
    dominantIntent: IntentType;
  };
  message?: string;
  usage?: KeywordUsageQuota;
};

type KeywordUsageQuota = {
  tier: string;
  limit: number;
  used: number;
  remaining: number | null;
  unlimited: boolean;
};

type KeywordUsageSnapshot = {
  tier: string;
  period: {
    startsAt: string;
    endsAt: string;
  };
  features: {
    searches: KeywordUsageQuota;
    recommendations: KeywordUsageQuota;
    savedKeywords: KeywordUsageQuota;
  };
};

type KeywordApiResponseEnvelope = {
  usage?: KeywordUsageQuota;
  message?: string;
  error?: string;
  upgrade?: {
    required?: boolean;
  };
};

type TopKeywordRow = {
  keyword: string;
  volume: number;
  difficultyScore: number;
  cpc: number;
  opportunity: number;
  intent: IntentType;
  trend: TrendDirection;
  questions: number;
  source: "seed" | "cluster" | "recommendation";
};

const INTENT_COLORS: Record<IntentType, string> = {
  informational: "#3b82f6",
  commercial: "#d946ef",
  transactional: "#10b981",
  navigational: "#f59e0b",
};

function normalizeIntent(intent: string): IntentType {
  const normalized = intent.toLowerCase();
  if (normalized.includes("commercial")) return "commercial";
  if (normalized.includes("transaction")) return "transactional";
  if (normalized.includes("navig")) return "navigational";
  return "informational";
}

function difficultyBaseScore(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy":
      return 35;
    case "medium":
      return 55;
    case "hard":
      return 72;
    default:
      return 50;
  }
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function getTimelineLabels(timeline: string): string[] {
  if (timeline === "3m") return ["W1", "W2", "W3", "W4", "W5", "W6"];
  if (timeline === "6m") return ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];
  if (timeline === "24m") return ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"];
  return ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
}

export default function KeywordResearchPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("IN");
  const [language, setLanguage] = useState("en");
  const [timeline, setTimeline] = useState("12m");
  const [packListName, setPackListName] = useState("Keyword Packs");
  const [viewMode, setViewMode] = useState<"table" | "compact">("table");
  const [sortBy, setSortBy] = useState<"opportunity" | "volume">("opportunity");

  const [result, setResult] = useState<KeywordResult | null>(null);
  const [recommendations, setRecommendations] = useState<KeywordRecommendationResponse | null>(
    null,
  );
  const [usageSnapshot, setUsageSnapshot] = useState<KeywordUsageSnapshot | null>(null);

  const [loading, setLoading] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);

  const refreshUsageSnapshot = async () => {
    setUsageLoading(true);
    try {
      const res = await fetch("/api/keywords/usage");
      if (!res.ok) throw new Error("Failed to load usage");
      const data = (await res.json()) as KeywordUsageSnapshot;
      setUsageSnapshot(data);
    } catch {
      // Keep page usable even if telemetry fails.
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    void refreshUsageSnapshot();
  }, []);

  const applyFeatureUsage = (
    feature: keyof KeywordUsageSnapshot["features"],
    usage?: KeywordUsageQuota,
  ) => {
    if (!usage) return;
    setUsageSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tier: usage.tier || prev.tier,
        features: {
          ...prev.features,
          [feature]: usage,
        },
      };
    });
  };

  const clusterEntries = useMemo(() => {
    if (!result?.relatedKeywordClusters) return [] as Array<{ root: string; keywords: string[] }>;
    return Object.entries(result.relatedKeywordClusters)
      .map(([root, keywords]) => ({
        root,
        keywords: Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))),
      }))
      .filter((entry) => entry.keywords.length > 0)
      .sort((a, b) => b.keywords.length - a.keywords.length);
  }, [result?.relatedKeywordClusters]);

  const navigateToAction = (
    destination: "script" | "title" | "thumbnail" | "snipradar",
    seedKeyword: string,
    clusterKeywords: string[],
  ) => {
    const uniqueKeywords = Array.from(
      new Set([seedKeyword, ...clusterKeywords].map((k) => k.trim()).filter(Boolean)),
    ).slice(0, 12);

    if (destination === "script") {
      const params = new URLSearchParams({
        title: seedKeyword,
        keywords: uniqueKeywords.join(","),
      });
      router.push(`/dashboard/script-generator?${params.toString()}`);
      return;
    }

    if (destination === "title") {
      const params = new URLSearchParams({
        topic: seedKeyword,
        keywords: uniqueKeywords.join(","),
      });
      router.push(`/dashboard/title-generator?${params.toString()}`);
      return;
    }

    if (destination === "thumbnail") {
      const params = new URLSearchParams({
        title: seedKeyword,
        niche: result?.keyword ?? seedKeyword,
      });
      router.push(`/dashboard/thumbnail-generator?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({
      keyword: seedKeyword,
    });
    router.push(`/snipradar/create/drafts?${params.toString()}`);
  };

  const runSearch = async (seed: string) => {
    if (!seed.trim() || seed.trim().length < 2) {
      toast({
        title: "Invalid keyword",
        description: "Please enter at least 2 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/keywords/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: seed.trim(),
          country,
          language,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | (KeywordResult & KeywordApiResponseEnvelope)
        | null;

      if (!res.ok) {
        if (payload?.usage) {
          applyFeatureUsage("searches", payload.usage);
          if (payload.upgrade?.required) {
            trackEvent({
              name: "keyword_upgrade_prompt_shown",
              payload: { source: "search", tier: payload.usage.tier },
            });
          }
        }
        throw new Error(payload?.message || payload?.error || "Could not analyze keyword.");
      }

      if (!payload) throw new Error("Empty response from keyword search.");
      setResult(payload);
      applyFeatureUsage("searches", payload.usage);
      setKeyword(seed.trim());

      toast({
        title: "Analysis complete",
        description: `Analyzed "${payload.keyword}" successfully.`,
      });
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Could not analyze keyword.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    void runSearch(keyword);
  };

  const handleLoadRecommendations = async () => {
    setRecommendationsLoading(true);
    try {
      const params = new URLSearchParams({ country, language });
      const res = await fetch(`/api/keywords/recommendations?${params.toString()}`);
      const payload = (await res.json().catch(() => null)) as
        | (KeywordRecommendationResponse & KeywordApiResponseEnvelope)
        | null;

      if (!res.ok) {
        if (payload?.usage) {
          applyFeatureUsage("recommendations", payload.usage);
          if (payload.upgrade?.required) {
            trackEvent({
              name: "keyword_upgrade_prompt_shown",
              payload: { source: "recommendations", tier: payload.usage.tier },
            });
          }
        }
        throw new Error(payload?.message || payload?.error || "Could not load recommendations.");
      }

      if (!payload) throw new Error("Empty recommendations response.");
      setRecommendations(payload);
      applyFeatureUsage("recommendations", payload.usage);

      if (payload.message) {
        toast({ title: "Recommendation note", description: payload.message });
      }
    } catch (error) {
      toast({
        title: "Recommendations unavailable",
        description: error instanceof Error ? error.message : "Could not load recommendations.",
        variant: "destructive",
      });
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const saveSingleKeyword = async (kw: string, sourceLabel: string) => {
    try {
      const response = await fetch("/api/keywords/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: kw.trim().toLowerCase(),
          listName: packListName.trim() || "Keyword Packs",
          tags: [sourceLabel, country, language],
          notes: result
            ? `Saved from ${sourceLabel} (${result.keyword})`
            : `Saved from ${sourceLabel}`,
          searchVolume: result?.searchVolume,
          competition: result?.competition,
          difficulty: result?.difficulty,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as KeywordApiResponseEnvelope | null;

      if (!response.ok) {
        if (payload?.usage) {
          applyFeatureUsage("savedKeywords", payload.usage);
        }
        throw new Error(payload?.message || payload?.error || "Could not save keyword.");
      }

      if (payload?.usage) {
        applyFeatureUsage("savedKeywords", payload.usage);
      }

      toast({
        title: "Saved keyword",
        description: `Added "${kw}" to ${packListName.trim() || "Keyword Packs"}.`,
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save keyword.",
        variant: "destructive",
      });
    }
  };

  const topKeywordRows = useMemo<TopKeywordRow[]>(() => {
    if (!result) return [];

    const baseCpc =
      typeof result.estimatedCPM === "number"
        ? Math.max(0.5, result.estimatedCPM / 5)
        : Math.max(0.5, (result.estimatedCPM.min + result.estimatedCPM.max) / 10);

    const rows: TopKeywordRow[] = [
      {
        keyword: result.keyword,
        volume: result.searchVolume,
        difficultyScore: Math.min(
          99,
          Math.max(1, result.competition || difficultyBaseScore(result.difficulty)),
        ),
        cpc: Number(baseCpc.toFixed(2)),
        opportunity: result.opportunityScore,
        intent: normalizeIntent(result.searchIntent),
        trend: result.trendDirection,
        questions: result.relatedKeywords.length,
        source: "seed",
      },
    ];

    clusterEntries.slice(0, 5).forEach((cluster, idx) => {
      rows.push({
        keyword: cluster.root,
        volume: Math.max(1200, Math.round(result.searchVolume * Math.max(0.25, 0.82 - idx * 0.11))),
        difficultyScore: Math.max(1, Math.min(99, result.competition + idx * 4 - 6)),
        cpc: Number((baseCpc + idx * 0.2).toFixed(2)),
        opportunity: Math.max(
          1,
          Math.min(99, result.opportunityScore - idx * 6 + Math.min(cluster.keywords.length, 7)),
        ),
        intent: normalizeIntent(result.searchIntent),
        trend: idx % 3 === 0 ? "rising" : idx % 3 === 1 ? "stable" : "falling",
        questions: cluster.keywords.length,
        source: "cluster",
      });
    });

    recommendations?.recommendations.slice(0, 6).forEach((rec, idx) => {
      rows.push({
        keyword: rec.keyword,
        volume: Math.max(900, Math.round(result.searchVolume * Math.max(0.2, 0.68 - idx * 0.08))),
        difficultyScore: Math.max(20, Math.min(90, 60 - idx * 3)),
        cpc: Number((baseCpc + idx * 0.16).toFixed(2)),
        opportunity: rec.personalizedScore,
        intent: rec.predictedIntent,
        trend:
          rec.personalizedScore >= 75
            ? "rising"
            : rec.personalizedScore >= 55
              ? "stable"
              : "falling",
        questions: rec.seedKeywords.length * 4,
        source: "recommendation",
      });
    });

    const deduped = Array.from(
      new Map(rows.map((row) => [row.keyword.toLowerCase(), row])).values(),
    );
    deduped.sort((a, b) =>
      sortBy === "volume" ? b.volume - a.volume : b.opportunity - a.opportunity,
    );
    return deduped.slice(0, 12);
  }, [clusterEntries, recommendations?.recommendations, result, sortBy]);

  const statsSummary = useMemo(() => {
    const savedCount = usageSnapshot?.features.savedKeywords.used ?? 0;
    if (!result) {
      return {
        keywordsFound: 0,
        totalVolume: 0,
        highOpportunity: 0,
        savedKeywords: savedCount,
      };
    }

    return {
      keywordsFound: topKeywordRows.length,
      totalVolume: topKeywordRows.reduce((sum, row) => sum + row.volume, 0),
      highOpportunity: topKeywordRows.filter((row) => row.opportunity >= 70).length,
      savedKeywords: savedCount,
    };
  }, [result, topKeywordRows, usageSnapshot?.features.savedKeywords.used]);

  const intentBreakdown = useMemo(() => {
    const counts = topKeywordRows.reduce<Record<IntentType, number>>(
      (acc, row) => {
        acc[row.intent] = (acc[row.intent] || 0) + 1;
        return acc;
      },
      {
        informational: 0,
        commercial: 0,
        transactional: 0,
        navigational: 0,
      },
    );

    const total = Math.max(1, topKeywordRows.length);
    const parts = (Object.keys(counts) as IntentType[])
      .map((intent) => ({
        intent,
        count: counts[intent],
        pct: Math.round((counts[intent] / total) * 100),
        color: INTENT_COLORS[intent],
      }))
      .filter((item) => item.count > 0 || !topKeywordRows.length);

    let cursor = 0;
    const gradient = parts
      .map((part) => {
        const start = cursor;
        cursor += part.pct;
        return `${part.color} ${start}% ${cursor}%`;
      })
      .join(", ");

    return {
      parts,
      gradient: gradient || "#374151 0% 100%",
    };
  }, [topKeywordRows]);

  const trendSeries = useMemo(() => {
    return topKeywordRows.slice(0, 6).map((row) => row.opportunity);
  }, [topKeywordRows]);

  const trendChartData = useMemo(() => {
    const labels = getTimelineLabels(timeline);
    return labels.map((label, idx) => ({
      label,
      score:
        trendSeries[idx] ??
        (trendSeries.length
          ? Math.max(20, trendSeries[trendSeries.length - 1] - (labels.length - idx) * 2)
          : 0),
    }));
  }, [timeline, trendSeries]);

  const intentPieData = useMemo(
    () =>
      intentBreakdown.parts.map((part) => ({
        name: part.intent,
        value: part.count,
        color: part.color,
      })),
    [intentBreakdown.parts],
  );

  const exportTopKeywords = () => {
    if (!topKeywordRows.length) return;

    const headers = ["keyword", "volume", "difficulty", "cpc", "opportunity", "intent", "trend"];
    const rows = topKeywordRows.map((row) => [
      row.keyword,
      String(row.volume),
      String(row.difficultyScore),
      row.cpc.toFixed(2),
      String(row.opportunity),
      row.intent,
      row.trend,
    ]);

    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `keyword-research-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const usageSearch = usageSnapshot?.features.searches;
  const usageRecommendations = usageSnapshot?.features.recommendations;
  const usageSaved = usageSnapshot?.features.savedKeywords;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Keyword Research</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Discover high-performing keywords for your creator workflow
          </p>
        </div>
        <Button
          className="gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
          onClick={handleLoadRecommendations}
          disabled={recommendationsLoading}
        >
          {recommendationsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          AI Suggestions
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.04] to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-violet-100 dark:bg-violet-500/15 p-2.5 text-violet-600 dark:text-violet-300">
              <Search className="h-4 w-4" />
            </div>
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              {result
                ? `${result.trendDirection === "rising" ? "+" : ""}${Math.max(3, Math.round(result.opportunityScore / 8))}%`
                : "--"}
            </span>
          </div>
          <p className="mt-4 text-4xl font-semibold">{statsSummary.keywordsFound}</p>
          <p className="text-sm text-muted-foreground">Keywords Found</p>
        </Card>

        <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.04] to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-300">
              <Target className="h-4 w-4" />
            </div>
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              {result?.dataQuality?.confidence ?? "high"}
            </span>
          </div>
          <p className="mt-4 text-4xl font-semibold">{formatCompact(statsSummary.totalVolume)}</p>
          <p className="text-sm text-muted-foreground">Total Search Volume</p>
        </Card>

        <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.04] to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-pink-100 dark:bg-pink-500/15 p-2.5 text-pink-600 dark:text-pink-300">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-sm text-violet-600 dark:text-violet-300">Top 10%</span>
          </div>
          <p className="mt-4 text-4xl font-semibold">{statsSummary.highOpportunity}</p>
          <p className="text-sm text-muted-foreground">High Opportunity</p>
        </Card>

        <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/50 dark:from-white/[0.04] to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-amber-100 dark:bg-amber-500/15 p-2.5 text-amber-600 dark:text-amber-300">
              <BookmarkPlus className="h-4 w-4" />
            </div>
            <span className="text-sm text-muted-foreground">
              {usageSaved?.used ?? statsSummary.savedKeywords} /{" "}
              {usageSaved?.unlimited ? "∞" : (usageSaved?.limit ?? "75")}
            </span>
          </div>
          <p className="mt-4 text-4xl font-semibold">{statsSummary.savedKeywords}</p>
          <p className="text-sm text-muted-foreground">Saved Keywords</p>
        </Card>
      </div>

      <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-b from-muted/40 dark:from-white/[0.03] to-transparent p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Enter seed keyword or topic..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-14 rounded-2xl pl-11 text-base"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="h-14 min-w-[150px] rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-base text-white hover:from-violet-400 hover:to-fuchsia-400"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Analyze
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-border dark:border-white/10 bg-muted/40 dark:bg-black/30 px-3 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filters
          </div>

          <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-border dark:border-white/10 bg-muted/40 dark:bg-black/30 px-3">
            <Globe2 className="h-4 w-4 text-muted-foreground" />
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="IN">India</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
            </select>
          </div>

          <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-border dark:border-white/10 bg-muted/40 dark:bg-black/30 px-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <select
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="12m">Last 12 months</option>
              <option value="24m">Last 24 months</option>
            </select>
          </div>

          <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-border dark:border-white/10 bg-muted/40 dark:bg-black/30 px-3">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>

          <div className="ml-auto inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`h-9 rounded-lg border px-3 text-xs ${viewMode === "table" ? "border-violet-400/50 bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200" : "border-border dark:border-white/10 text-muted-foreground"}`}
              aria-label="Table view"
            >
              <ListFilter className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compact")}
              className={`h-9 rounded-lg border px-3 text-xs ${viewMode === "compact" ? "border-violet-400/50 bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200" : "border-border dark:border-white/10 text-muted-foreground"}`}
              aria-label="Compact view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Keyword pack list name"
            value={packListName}
            onChange={(e) => setPackListName(e.target.value)}
            className="h-9"
          />
          <div className="self-center text-xs text-muted-foreground">
            {usageLoading
              ? "Refreshing usage..."
              : usageSnapshot
                ? `${usageSnapshot.tier} plan active`
                : "Saved keywords use this pack"}
          </div>
        </div>
      </Card>

      {!result && !loading ? (
        <Card className="border border-border dark:border-white/[0.07] p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-500/10">
            <Target className="h-7 w-7 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Start Your Research</h3>
          <p className="text-sm text-muted-foreground">
            Enter a keyword to analyze demand, competition, and opportunities.
          </p>
        </Card>
      ) : null}

      {result ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            {result.dataQuality?.warnings?.length ? (
              <Card className="border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                {result.dataQuality.warnings[0]}
              </Card>
            ) : null}

            <Card className="overflow-hidden border border-border dark:border-white/[0.07]">
              <div className="flex items-center justify-between border-b border-border dark:border-white/[0.07] px-5 py-4">
                <h3 className="text-lg font-semibold">Top Keywords ({topKeywordRows.length})</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={exportTopKeywords}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      setSortBy((prev) => (prev === "opportunity" ? "volume" : "opportunity"))
                    }
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Sort: {sortBy}
                  </Button>
                </div>
              </div>

              {viewMode === "table" ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-border dark:border-white/[0.07] text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Keyword</th>
                        <th className="px-4 py-3">Volume</th>
                        <th className="px-4 py-3">Difficulty</th>
                        <th className="px-4 py-3">CPC</th>
                        <th className="px-4 py-3">Opportunity</th>
                        <th className="px-4 py-3">Intent</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topKeywordRows.map((row, idx) => {
                        const progressClass =
                          row.opportunity >= 80
                            ? "bg-emerald-400"
                            : row.opportunity >= 60
                              ? "bg-amber-400"
                              : "bg-slate-400";
                        const intentColor = INTENT_COLORS[row.intent];

                        return (
                          <tr
                            key={`${row.keyword}-${idx}`}
                            className="border-b border-border/50 dark:border-white/5 last:border-b-0 hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-start gap-2">
                                <span className="mt-1 text-xs text-muted-foreground">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <button
                                    type="button"
                                    className="text-left font-semibold hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
                                    onClick={() => void runSearch(row.keyword)}
                                  >
                                    {row.keyword}
                                  </button>
                                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    {row.trend === "rising" ? (
                                      <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                    ) : row.trend === "falling" ? (
                                      <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                                    ) : (
                                      <Minus className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                    )}
                                    {row.questions} questions
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold">{formatCompact(row.volume)}</p>
                              <p className="text-xs text-muted-foreground">monthly</p>
                            </td>
                            <td className="px-4 py-4">
                              <span className="rounded-full bg-amber-100 dark:bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                {row.difficultyScore}
                              </span>
                            </td>
                            <td className="px-4 py-4">${row.cpc.toFixed(2)}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="w-7 font-semibold">{row.opportunity}</span>
                                <div className="h-2 w-20 rounded-full bg-muted dark:bg-white/10">
                                  <div
                                    className={`h-2 rounded-full ${progressClass}`}
                                    style={{ width: `${row.opportunity}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className="rounded-full border px-2 py-1 text-xs font-medium capitalize"
                                style={{
                                  borderColor: `${intentColor}66`,
                                  color: intentColor,
                                  background: `${intentColor}1a`,
                                }}
                              >
                                {row.intent}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <button
                                  type="button"
                                  className="hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                                  onClick={() => void saveSingleKeyword(row.keyword, row.source)}
                                  aria-label={`Save ${row.keyword}`}
                                >
                                  <Star className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(row.keyword);
                                      toast({
                                        title: "Copied",
                                        description: `"${row.keyword}" copied.`,
                                      });
                                    } catch {
                                      toast({
                                        title: "Copy failed",
                                        description: "Clipboard unavailable.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  aria-label={`Copy ${row.keyword}`}
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                                  onClick={() =>
                                    navigateToAction("script", row.keyword, [row.keyword])
                                  }
                                  aria-label={`Script from ${row.keyword}`}
                                >
                                  <PenSquare className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
                                  onClick={() =>
                                    navigateToAction("thumbnail", row.keyword, [row.keyword])
                                  }
                                  aria-label={`Thumbnail from ${row.keyword}`}
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="hover:text-fuchsia-600 dark:hover:text-fuchsia-300 transition-colors"
                                  onClick={() =>
                                    navigateToAction("snipradar", row.keyword, [row.keyword])
                                  }
                                  aria-label={`X drafts from ${row.keyword}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {topKeywordRows.map((row) => (
                    <div
                      key={row.keyword}
                      className="rounded-xl border border-border dark:border-white/10 bg-muted/40 dark:bg-black/20 p-3"
                    >
                      <p className="font-medium">{row.keyword}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatCompact(row.volume)} volume</span>
                        <span>{row.opportunity} score</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border border-border dark:border-white/[0.07] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Search Trend</h3>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="h-[180px] rounded-lg border border-border dark:border-white/[0.07] bg-muted/30 dark:bg-black/20 px-2 py-2">
                {trendSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendChartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="keywordTrendStroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#d946ef" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "10px",
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="url(#keywordTrendStroke)"
                        strokeWidth={3}
                        dot={{ r: 2.5, strokeWidth: 0, fill: "#34d399" }}
                        activeDot={{ r: 4, fill: "#e879f9" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-xs text-muted-foreground">Run analysis to render trend.</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="border border-border dark:border-white/[0.07] p-4">
              <h3 className="mb-3 font-semibold">Search Intent</h3>
              <div className="flex items-center gap-4">
                <div className="h-32 w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={
                          intentPieData.length
                            ? intentPieData
                            : [
                                {
                                  name: "informational",
                                  value: 1,
                                  color: INTENT_COLORS.informational,
                                },
                              ]
                        }
                        dataKey="value"
                        nameKey="name"
                        innerRadius={38}
                        outerRadius={56}
                        strokeWidth={1}
                        stroke="hsl(var(--background))"
                      >
                        {(intentPieData.length
                          ? intentPieData
                          : [
                              {
                                name: "informational",
                                value: 1,
                                color: INTENT_COLORS.informational,
                              },
                            ]
                        ).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "10px",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 text-sm">
                  {intentBreakdown.parts.map((part) => (
                    <div key={part.intent} className="flex items-center justify-between gap-4">
                      <span className="inline-flex items-center gap-2 capitalize text-muted-foreground">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: part.color }}
                        />
                        {part.intent}
                      </span>
                      <span className="font-medium">{part.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="border-violet-300 dark:border-violet-400/20 bg-gradient-to-b from-violet-50 dark:from-violet-500/10 to-fuchsia-50/50 dark:to-fuchsia-500/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-violet-700 dark:text-violet-100">
                <Sparkles className="h-4 w-4" />
                AI Insights
              </h3>
              <ul className="space-y-2 text-sm text-violet-700/90 dark:text-violet-100/90">
                <li>
                  • {statsSummary.highOpportunity} keywords are low-competition opportunities.
                </li>
                <li>• Trend direction is currently {result.trendDirection}.</li>
                <li>• Dominant intent: {intentBreakdown.parts[0]?.intent ?? "informational"}.</li>
                <li>
                  • Estimated CPC baseline: $
                  {typeof result.estimatedCPM === "number"
                    ? result.estimatedCPM.toFixed(2)
                    : `${result.estimatedCPM.min}-${result.estimatedCPM.max}`}
                </li>
              </ul>
            </Card>

            {usageSnapshot ? (
              <Card className="border border-border dark:border-white/[0.07] p-4">
                <h3 className="mb-2 font-semibold capitalize">{usageSnapshot.tier} Plan Usage</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Searches</span>
                    <span>
                      {usageSearch?.used ?? 0}/
                      {usageSearch?.unlimited ? "∞" : (usageSearch?.limit ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">AI Suggestions</span>
                    <span>
                      {usageRecommendations?.used ?? 0}/
                      {usageRecommendations?.unlimited ? "∞" : (usageRecommendations?.limit ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Saved</span>
                    <span>
                      {usageSaved?.used ?? 0}/
                      {usageSaved?.unlimited ? "∞" : (usageSaved?.limit ?? 0)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    trackEvent({
                      name: "keyword_upgrade_clicked",
                      payload: { source: "modern_usage_card", tier: usageSnapshot.tier },
                    });
                    router.push("/pricing");
                  }}
                >
                  Upgrade Plan
                </Button>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {recommendations?.recommendations?.length ? (
        <Card className="border border-border dark:border-white/[0.07] p-4">
          <h3 className="mb-2 text-sm font-semibold">AI Suggestion Queue</h3>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.recommendations.slice(0, 12).map((rec) => (
              <Badge
                key={rec.keyword}
                variant="secondary"
                className="cursor-pointer rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 hover:bg-violet-200 dark:hover:bg-violet-500/25"
                onClick={() => void runSearch(rec.keyword)}
              >
                {rec.keyword}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
