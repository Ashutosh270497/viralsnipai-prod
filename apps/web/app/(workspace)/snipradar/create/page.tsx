"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, ChevronDown, ChevronUp, Loader2, Radar, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { Textarea } from "@/components/ui/textarea";
import { parseServerTimingMs } from "@/lib/server-timing";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";
import type { SnipRadarDraft } from "@/components/snipradar/snipradar-context";
import { TweetDraftCard } from "@/components/snipradar/tweet-draft-card";
import { TemplateLibrary } from "@/components/snipradar/template-library";
import { StyleTrainerCard } from "@/components/snipradar/style-trainer-dialog";
import { ThreadComposer } from "@/components/snipradar/thread-composer";
import { HookGenerator } from "@/components/snipradar/hook-generator";
import { ContentsTab } from "@/components/snipradar/contents-tab";
import { TweetPredictor } from "@/components/snipradar/tweet-predictor";
import { ResearchCopilot } from "@/components/snipradar/research-copilot";
import { VariantLab } from "@/components/snipradar/variant-lab";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";
import { isCreateTab, type CreateTab } from "@/lib/snipradar-tabs";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";
import { useBillingSubscriptionState } from "@/hooks/use-billing-subscription";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";

const EMPTY_DRAFTS: SnipRadarDraft[] = [];

function formatRelativeTime(isoDate?: string | null): string {
  if (!isoDate) return "N/A";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function useUrlTab(defaultTab: CreateTab, tabOverride?: CreateTab) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabOverride ?? (isCreateTab(tabParam) ? tabParam : defaultTab);

  const setTab = (nextTab: CreateTab) => {
    router.replace(`/snipradar/create/${nextTab}`, { scroll: false });
  };

  return { tab, setTab };
}

export default function SnipRadarCreatePage({
  tabOverride,
}: {
  tabOverride?: CreateTab;
} = {}) {
  const router = useRouter();
  const flags = useFeatureFlags();
  const billingQuery = useBillingSubscriptionState();
  const [showPostedTweets, setShowPostedTweets] = useState(false);
  const [studioDraftId, setStudioDraftId] = useState<string | null>(null);
  const [studioText, setStudioText] = useState("");
  const [studioPrediction, setStudioPrediction] = useState<number | null>(null);
  const [studioPredictionHint, setStudioPredictionHint] = useState<string | null>(null);
  const [studioTone, setStudioTone] = useState<string>("Professional");
  const [loadedRemixSeed, setLoadedRemixSeed] = useState(false);
  const [researchSeedLabel, setResearchSeedLabel] = useState<string | null>(null);
  const { tab, setTab } = useUrlTab("drafts", tabOverride);
  const { account, counts, invalidate, reportPerf } = useSnipRadar();
  const [kbdSaved, setKbdSaved] = useState(false);
  const {
    data: createData,
    isLoading: createLoading,
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
      if (!res.ok) throw new Error("Failed to fetch create data");
      reportPerf("create_data", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json();
    },
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
  // Contents counts for tab badges (Part F) — shares cache with ContentsTab
  const { data: contentsData } = useQuery<{
    threads: { groupId: string }[];
    singlePosts: { id: string }[];
  }>({
    queryKey: ["snipradar-contents"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/contents");
      if (!res.ok) throw new Error("Failed to fetch contents");
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const contentsThreadCount = contentsData?.threads.length ?? 0;
  const contentsTotalCount = contentsThreadCount + (contentsData?.singlePosts.length ?? 0);

  const drafts = useMemo(() => createData?.drafts ?? EMPTY_DRAFTS, [createData?.drafts]);
  const scheduledDrafts = useMemo(
    () => createData?.scheduledDrafts ?? EMPTY_DRAFTS,
    [createData?.scheduledDrafts],
  );
  const postedDrafts = useMemo(
    () => createData?.postedDrafts ?? EMPTY_DRAFTS,
    [createData?.postedDrafts],
  );
  const viralTweetCount = createData?.viralTweetCount ?? counts.viralTweets;

  const generateDraftsMutation = useMutation({
    mutationFn: async () => {
      const startedAt = performance.now();
      const res = await fetch("/api/snipradar/drafts", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate drafts");
      }
      reportPerf("create_generate_drafts", {
        clientMs: Math.round(performance.now() - startedAt),
        serverMs: parseServerTimingMs(res.headers.get("Server-Timing")),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      refetchCreateData();
    },
  });

  const draftFilterStats = useMemo(
    () => ({
      active: drafts.length,
      scheduled: scheduledDrafts.length,
      posted: postedDrafts.length,
    }),
    [drafts.length, scheduledDrafts.length, postedDrafts.length],
  );

  const latestPostedAt = postedDrafts[0]?.postedAt ?? postedDrafts[0]?.createdAt ?? null;
  const avgPostedPrediction =
    postedDrafts.length > 0
      ? Math.round(
          postedDrafts.reduce((sum, draft) => sum + (draft.viralPrediction ?? 0), 0) /
            postedDrafts.length,
        )
      : 0;
  const studioDraft = useMemo(
    () => drafts.find((draft) => draft.id === studioDraftId) ?? drafts[0] ?? null,
    [drafts, studioDraftId],
  );

  const toneVariants = ["Professional", "Bold", "Educational", "Meme"] as const;
  const variantLabLocked = billingQuery.data ? !billingQuery.data.limits.variantLab : false;
  const researchCopilotLocked = billingQuery.data ? !billingQuery.data.limits.researchCopilot : false;

  useEffect(() => {
    if (!studioDraftId && drafts.length > 0) {
      setStudioDraftId(drafts[0].id);
    }
  }, [drafts, studioDraftId]);

  useEffect(() => {
    if (!studioDraft) return;
    setStudioText(studioDraft.text);
    setStudioPrediction(studioDraft.viralPrediction ?? null);
  }, [studioDraft]);

  useEffect(() => {
    if (loadedRemixSeed || typeof window === "undefined") return;
    const remixSeed = window.localStorage.getItem("snipradar:remixDraftSeed");
    if (remixSeed) {
      setStudioText(remixSeed);
      setResearchSeedLabel("Loaded from research/template seed");
      window.localStorage.removeItem("snipradar:remixDraftSeed");
    }
    setLoadedRemixSeed(true);
  }, [loadedRemixSeed]);

  const studioPredictMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/snipradar/drafts/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to predict");
      }
      return res.json() as Promise<{ prediction: { score: number; suggestion?: string } }>;
    },
    onSuccess: (result) => {
      setStudioPrediction(result.prediction.score);
      setStudioPredictionHint(result.prediction.suggestion ?? null);
      trackSnipRadarEvent("snipradar_create_live_predict", { score: result.prediction.score });
    },
  });
  const predictDraft = studioPredictMutation.mutate;

  const studioToneMutation = useMutation({
    mutationFn: async (tone: string) => {
      const res = await fetch("/api/snipradar/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: studioText, tone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to apply tone");
      }
      return res.json() as Promise<{ rewritten: string }>;
    },
    onSuccess: (result, tone) => {
      setStudioText(result.rewritten);
      setStudioTone(tone);
      trackSnipRadarEvent("snipradar_create_variant_apply", { tone });
    },
  });

  const saveStudioMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!studioDraft) throw new Error("No draft selected");
      const res = await fetch(`/api/snipradar/drafts/${studioDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save draft");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      refetchCreateData();
    },
  });

  useEffect(() => {
    if (!flags.snipRadarCreateV2Enabled) return;
    const text = studioText.trim();
    if (text.length < 20) {
      setStudioPrediction(null);
      setStudioPredictionHint(null);
      return;
    }
    const timer = window.setTimeout(() => {
      predictDraft(text);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [flags.snipRadarCreateV2Enabled, predictDraft, studioText]);

  // Cmd+S / Ctrl+S — save draft when on Drafts tab (Part G)
  useKeyboardShortcuts(
    [
      {
        key: "s",
        ctrl: true,
        action: () => {
          if (!studioDraft || !studioText.trim() || saveStudioMutation.isPending) return;
          saveStudioMutation.mutate(studioText);
          setKbdSaved(true);
          setTimeout(() => setKbdSaved(false), 1500);
        },
        description: "Save draft",
      },
    ],
    tab === "drafts",
  );

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as CreateTab)}>
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="drafts">Drafts</TabsTrigger>
        <TabsTrigger value="research">Research</TabsTrigger>
        <TabsTrigger value="predictor">Predictor</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="style">Style</TabsTrigger>
        <TabsTrigger value="threads" className="gap-1.5">
          Threads
          {contentsThreadCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none">
              {contentsThreadCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="hooks">Hooks</TabsTrigger>
        <TabsTrigger value="contents" className="gap-1.5">
          Contents
          {contentsTotalCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none">
              {contentsTotalCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="drafts" className="space-y-4">
        {flags.snipRadarCreateV2Enabled ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Live Draft Studio
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Split editor with live preview and score
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {drafts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {drafts.slice(0, 8).map((draft, idx) => (
                      <Button
                        key={draft.id}
                        size="sm"
                        variant={studioDraft?.id === draft.id ? "default" : "outline"}
                        onClick={() => setStudioDraftId(draft.id)}
                      >
                        Draft {idx + 1}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Composer
                      </p>
                      <div className="flex items-center gap-2">
                        {researchSeedLabel ? (
                          <Badge variant="outline" className="text-[10px]">
                            {researchSeedLabel}
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">{studioText.length}/280</span>
                      </div>
                    </div>
                    <Textarea
                      value={studioText}
                      onChange={(e) => {
                        setResearchSeedLabel(null);
                        setStudioText(e.target.value.slice(0, 280));
                      }}
                      placeholder="Write your draft..."
                      className="min-h-[220px] text-sm leading-relaxed"
                    />
                    <div className="flex flex-wrap gap-2">
                      {["🚀", "🔥", "💡", "✅"].map((emoji) => (
                        <Button
                          key={emoji}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => setStudioText((current) => `${current}${emoji}`.slice(0, 280))}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        As seen on X
                      </p>
                      <Badge variant="outline">{studioTone}</Badge>
                    </div>
                    <p className="rounded-md border border-border bg-muted/20 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {studioText || "Your preview will appear here."}
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Live Viral Score</span>
                        <span>{studioPrediction ?? "--"}/100</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (studioPrediction ?? 0) >= 80
                              ? "bg-emerald-500"
                              : (studioPrediction ?? 0) >= 60
                                ? "bg-amber-500"
                                : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.max(2, studioPrediction ?? 0)}%` }}
                        />
                      </div>
                      {studioPredictionHint ? (
                        <p className="text-[11px] text-muted-foreground">{studioPredictionHint}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {toneVariants.map((tone) => (
                    <Button
                      key={tone}
                      type="button"
                      size="sm"
                      variant={studioTone === tone ? "default" : "outline"}
                      className="h-8"
                      disabled={studioToneMutation.isPending || !studioText.trim()}
                      onClick={() => studioToneMutation.mutate(tone)}
                    >
                      {tone}
                    </Button>
                  ))}
                  {kbdSaved && (
                    <span className="animate-in fade-in text-xs text-emerald-600 dark:text-emerald-400 duration-150">
                      Saved ⌘S
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="ml-auto"
                    disabled={saveStudioMutation.isPending || !studioDraft || !studioText.trim()}
                    onClick={() => saveStudioMutation.mutate(studioText)}
                    title="Save draft (⌘S / Ctrl+S)"
                  >
                    {saveStudioMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Saving
                      </>
                    ) : (
                      "Save Draft"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {variantLabLocked && billingQuery.data ? (
              <SnipRadarBillingGateCard
                details={{
                  kind: "upgrade_required",
                  feature: "variantLab",
                  currentPlan: billingQuery.data.plan.id,
                  requiredPlan: "plus",
                  upgradePlan: "plus",
                }}
              />
            ) : (
              <VariantLab
                text={studioText}
                followerCount={account?.followerCount}
                onApplyVariant={(variant) => {
                  setResearchSeedLabel(`Loaded from Variant Lab · ${variant.label}`);
                  setStudioText(variant.text);
                  setStudioPrediction(variant.score);
                  setStudioPredictionHint(`${variant.label} applied from Variant Lab.`);
                }}
              />
            )}
          </>
        ) : null}

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">
              Draft Studio
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {draftFilterStats.active} active · {draftFilterStats.scheduled} scheduled ·{" "}
                {draftFilterStats.posted} posted
              </span>
            </CardTitle>
            <Button
              className="gap-2"
              onClick={() => generateDraftsMutation.mutate()}
              disabled={generateDraftsMutation.isPending}
            >
              {generateDraftsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Drafts
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {generateDraftsMutation.error ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {(generateDraftsMutation.error as Error).message}
              </div>
            ) : null}
            {createLoading ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Loading drafts...
              </div>
            ) : null}

            {drafts.length === 0 ? (
              <SnipRadarEmptyState
                icon={Radar}
                eyebrow="Create"
                title="Draft studio is ready for its first batch"
                description="Generate AI-powered posts from the viral patterns already found in your tracked feed."
                hint={
                  viralTweetCount === 0
                    ? "Discover mode has no analyzed viral tweets yet. Fetch and analyze accounts first."
                    : `${viralTweetCount} analyzed viral tweets are ready to inform your next drafts.`
                }
                primaryAction={{
                  label: generateDraftsMutation.isPending ? "Generating..." : "Generate drafts",
                  onClick: () => generateDraftsMutation.mutate(),
                  disabled: generateDraftsMutation.isPending || viralTweetCount === 0,
                }}
                secondaryAction={
                  viralTweetCount === 0
                    ? {
                        label: "Open Discover",
                        onClick: () => router.push("/snipradar/discover"),
                      }
                    : undefined
                }
              />
            ) : (
              <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
                {drafts.map((draft) => (
                  <TweetDraftCard
                    key={draft.id}
                    draft={draft}
                    xUsername={account?.xUsername ?? ""}
                  />
                ))}
              </div>
            )}

            {scheduledDrafts.length > 0 ? (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 text-blue-500" />
                  <h3 className="text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Scheduled ({scheduledDrafts.length})
                  </h3>
                </div>
                {scheduledDrafts.map((draft) => (
                  <TweetDraftCard
                    key={draft.id}
                    draft={draft}
                    xUsername={account?.xUsername ?? ""}
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recently Posted</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setShowPostedTweets((prev) => !prev)}
            >
              {showPostedTweets ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Expand
                </>
              )}
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            {showPostedTweets ? (
              postedDrafts.length > 0 ? (
                postedDrafts
                  .slice(0, 6)
                  .map((draft) => (
                    <TweetDraftCard
                      key={draft.id}
                      draft={draft}
                      xUsername={account?.xUsername ?? ""}
                    />
                  ))
              ) : (
                <SnipRadarEmptyState
                  icon={CalendarClock}
                  eyebrow="Posted"
                  title="No SnipRadar posts have landed yet"
                  description="Once drafts are posted from SnipRadar, this stream becomes your fast review lane for what actually shipped."
                  hint="Post at least one draft to unlock the posted feed, average prediction checks, and downstream analytics."
                  primaryAction={{ label: "Open Publish", href: "/snipradar/publish" }}
                />
              )
            ) : postedDrafts.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{postedDrafts.length} posted</Badge>
                <span>last {formatRelativeTime(latestPostedAt)}</span>
                <span>avg prediction {avgPostedPrediction}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Posted tweets will appear here after the first live publish.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="templates" className="space-y-4">
        <TemplateLibrary />
      </TabsContent>

      <TabsContent value="research" className="space-y-4">
        {researchCopilotLocked && billingQuery.data ? (
          <SnipRadarBillingGateCard
            details={{
              kind: "upgrade_required",
              feature: "researchCopilot",
              currentPlan: billingQuery.data.plan.id,
              requiredPlan: "plus",
              upgradePlan: "plus",
            }}
          />
        ) : (
          <ResearchCopilot
            onUseDraftSeed={(seed, source) => {
              if (typeof window !== "undefined") {
                window.localStorage.setItem("snipradar:remixDraftSeed", seed);
              }
              setResearchSeedLabel(`Seeded from ${source.replace("_", " ")}`);
              setStudioText(seed.slice(0, 280));
              setStudioDraftId(drafts[0]?.id ?? null);
              setTab("drafts");
            }}
          />
        )}
      </TabsContent>

      <TabsContent value="predictor" className="space-y-4">
        <TweetPredictor defaultNiche="tech" followerCount={account?.followerCount} />
      </TabsContent>

      <TabsContent value="style" className="space-y-4">
        <StyleTrainerCard />
      </TabsContent>

      <TabsContent value="threads" className="space-y-4">
        <ThreadComposer />
      </TabsContent>

      <TabsContent value="hooks" className="space-y-4">
        <HookGenerator />
      </TabsContent>

      <TabsContent value="contents" className="space-y-4">
        <ContentsTab />
      </TabsContent>
    </Tabs>
  );
}
