"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  TrendingUp,
  TestTube,
  Loader2,
  Image as ImageIcon,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { TitleInputFormV2 } from "@/components/title-generator/title-input-form-v2";
import { TitleVariationCard } from "@/components/title-generator/title-variation-card";
import { CharacterGuide } from "@/components/title-generator/character-counter";
import { TitleGeneratorInput } from "@/types/title";
import { toast } from "sonner";

interface GeneratedTitle {
  id: string;
  title: string;
  characterLength: number;
  titleType: string;
  reasoning: string;
  ctrScore: number;
  keywordOptimizationScore: number;
  curiosityScore: number;
  clarityScore: number;
  powerWordCount: number;
  lengthOptimal: boolean;
  keywordOptimized: boolean;
  overallRank: number;
  isFavorite: boolean;
  isPrimary: boolean;
}

interface UsageInfo {
  used: number;
  limit: number;
  tier: string;
}

interface GenerationResponse {
  titles: GeneratedTitle[];
  batchId: string;
  abTestSuggestion: {
    titleA: string;
    titleB: string;
    reason: string;
  };
  usage?: UsageInfo;
}

export default function TitleGeneratorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse URL parameters for pre-filling from Content Calendar or Script Generator
  const defaultValues = useMemo(() => {
    const ideaId = searchParams.get("ideaId");
    const topic = searchParams.get("topic");
    const description = searchParams.get("description");
    const keywords = searchParams.get("keywords");

    if (!topic) return null;

    const keywordsArray = keywords
      ? keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : [];

    const videoTopic = description ? `${topic}. ${description}` : topic;

    return {
      contentIdeaId: ideaId || undefined,
      videoTopic,
      keywords: keywordsArray.length > 0 ? keywordsArray : [],
      targetAudience: "YouTube viewers",
      titleStyle: "mixed" as const,
      maxLength: 70 as const,
    };
  }, [searchParams]);

  const [currentInput, setCurrentInput] = useState<TitleGeneratorInput | null>(
    defaultValues
  );
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  // Accumulated titles across multiple "generate more" calls
  const [allTitles, setAllTitles] = useState<GeneratedTitle[]>([]);
  // Locally tracked selected title ID (works across batches)
  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);
  // Latest A/B suggestion
  const [abTestSuggestion, setAbTestSuggestion] = useState<{
    titleA: string;
    titleB: string;
    reason: string;
  } | null>(null);

  // Generate titles mutation
  const generateMutation = useMutation({
    mutationFn: async (input: TitleGeneratorInput) => {
      const response = await fetch("/api/titles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 403 && data.usage) {
          setUsage(data.usage);
        }
        throw new Error(
          data.message || data.error || "Failed to generate titles"
        );
      }

      return response.json() as Promise<GenerationResponse>;
    },
    onSuccess: (data) => {
      if (data.usage) setUsage(data.usage);
      setAbTestSuggestion(data.abTestSuggestion);

      // Append new titles to accumulated list
      setAllTitles((prev) => {
        const newTitles = [...prev, ...data.titles];
        // If no title selected yet, auto-select the top-ranked new one
        if (!selectedTitleId && data.titles.length > 0) {
          const bestNew = data.titles.reduce((best, t) =>
            t.ctrScore > best.ctrScore ? t : best
          );
          setSelectedTitleId(bestNew.id);
        }
        return newTitles;
      });
      toast.success(`Generated ${data.titles.length} new title variations!`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({
      titleId,
      isFavorite,
    }: {
      titleId: string;
      isFavorite: boolean;
    }) => {
      const response = await fetch(`/api/titles/${titleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });

      if (!response.ok) throw new Error("Failed to update title");
      return response.json();
    },
    onSuccess: (_, variables) => {
      setAllTitles((prev) =>
        prev.map((t) =>
          t.id === variables.titleId
            ? { ...t, isFavorite: !variables.isFavorite }
            : t
        )
      );
    },
  });

  // Set primary / select title
  const handleSelectTitle = (titleId: string) => {
    setSelectedTitleId(titleId);
    // Also persist to backend
    fetch(`/api/titles/${titleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    }).catch(() => {});
    // Update local state
    setAllTitles((prev) =>
      prev.map((t) => ({
        ...t,
        isPrimary: t.id === titleId,
      }))
    );
    toast.success("Title selected! You can now generate a thumbnail.");
  };

  const handleGenerate = (input: TitleGeneratorInput) => {
    setCurrentInput(input);
    // First generation: clear previous titles
    if (allTitles.length === 0) {
      setSelectedTitleId(null);
      setAbTestSuggestion(null);
    }
    generateMutation.mutate(input);
  };

  const handleGenerateMore = () => {
    if (!currentInput) return;
    generateMutation.mutate(currentInput);
  };

  const handleCopy = () => {
    toast.success("Title copied to clipboard!");
  };

  const handleGenerateThumbnail = () => {
    const selectedTitle = allTitles.find((t) => t.id === selectedTitleId);
    const titleToUse =
      selectedTitle?.title ||
      allTitles[0]?.title ||
      currentInput?.videoTopic ||
      "";

    const params = new URLSearchParams({
      title: titleToUse,
      niche: currentInput?.targetAudience || "general",
    });

    if (defaultValues?.contentIdeaId) {
      params.set("ideaId", defaultValues.contentIdeaId);
    }

    router.push(`/dashboard/thumbnail-generator?${params.toString()}`);
  };

  const handleStartOver = () => {
    setAllTitles([]);
    setSelectedTitleId(null);
    setAbTestSuggestion(null);
  };

  const selectedTitle = allTitles.find((t) => t.id === selectedTitleId);
  // limit of -1 means unlimited (Infinity can't be serialized to JSON)
  const hasFiniteLimit = usage !== null && usage.limit > 0;
  const isLimitReached = hasFiniteLimit && usage!.used >= usage!.limit;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 dark:from-violet-500/25 dark:to-fuchsia-500/25 p-2">
              <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold">AI Title Generator</h1>
          </div>
          {hasFiniteLimit && (
            <Badge
              variant={isLimitReached ? "warning" : "secondary"}
              className="text-sm px-3 py-1"
            >
              {Math.max(0, usage!.limit - usage!.used)} / {usage!.limit}{" "}
              generations left
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Generate optimized YouTube title variations with CTR predictions,
          keyword analysis, and A/B testing suggestions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Left Column - Input Form */}
        <div className="space-y-6">
          <Card className="border border-border dark:border-white/[0.07] p-6">
            <h2 className="mb-4 text-xl font-semibold">Generate Titles</h2>
            <TitleInputFormV2
              onGenerate={handleGenerate}
              isGenerating={generateMutation.isPending}
              defaultValues={defaultValues || currentInput || undefined}
            />
          </Card>

          <CharacterGuide />
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Limit reached banner */}
          {isLimitReached && (
            <Card className="border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-600">
                    Monthly limit reached
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You&apos;ve used all {usage!.limit} free title generations
                    this month. Your limit resets on the 1st of next month.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Selected Title Banner */}
          {selectedTitle && (
            <Card className="border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-primary mb-1">
                      Your selected title
                    </p>
                    <p className="font-semibold truncate">
                      {selectedTitle.title}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateThumbnail}
                  className="shrink-0"
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate Thumbnail
                </Button>
              </div>
            </Card>
          )}

          {/* Loading state */}
          {generateMutation.isPending && (
            <Card className="flex flex-col items-center justify-center p-12 border border-border dark:border-white/[0.07]">
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
              <h3 className="mb-2 text-lg font-semibold">
                Generating Titles...
              </h3>
              <p className="text-center text-sm text-muted-foreground">
                Our AI is creating 5 optimized title variations.
                <br />
                This usually takes 5-10 seconds.
              </p>
            </Card>
          )}

          {/* Empty state */}
          {!generateMutation.isPending && allTitles.length === 0 && (
            <Card className="flex flex-col items-center justify-center p-12 border border-border dark:border-white/[0.07]">
              <div className="mb-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 dark:from-violet-500/20 dark:to-fuchsia-500/20 p-4">
                <TrendingUp className="h-12 w-12 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Ready to Generate Titles
              </h3>
              <p className="text-center text-sm text-muted-foreground">
                Fill out the form on the left and click &quot;Generate 5
                Titles&quot;
                <br />
                to get started with AI-powered title suggestions.
              </p>
            </Card>
          )}

          {allTitles.length > 0 && (
            <>
              {/* A/B Testing Suggestion */}
              {abTestSuggestion && (
                <Card className="border-primary/30 bg-primary/5 p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <TestTube className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      A/B Testing Suggestion
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Badge variant="outline" className="mb-2">
                        Title A (High Curiosity)
                      </Badge>
                      <p className="text-sm font-medium">
                        {abTestSuggestion.titleA}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Badge variant="outline" className="mb-2">
                        Title B (High Clarity)
                      </Badge>
                      <p className="text-sm font-medium">
                        {abTestSuggestion.titleB}
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">
                          Why test these:
                        </strong>{" "}
                        {abTestSuggestion.reason}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Title Variations */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Generated Titles ({allTitles.length})
                  </h3>
                  {allTitles.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartOver}
                      className="text-muted-foreground"
                    >
                      Start Over
                    </Button>
                  )}
                </div>

                {!selectedTitle && allTitles.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Click &quot;Use This Title&quot; on any title to select it
                    for your video.
                  </p>
                )}

                {allTitles.map((title) => (
                  <TitleVariationCard
                    key={title.id}
                    title={title.title}
                    characterLength={title.characterLength}
                    titleType={title.titleType}
                    reasoning={title.reasoning}
                    ctrScore={title.ctrScore}
                    keywordOptimizationScore={title.keywordOptimizationScore}
                    curiosityScore={title.curiosityScore}
                    clarityScore={title.clarityScore}
                    powerWordCount={title.powerWordCount}
                    lengthOptimal={title.lengthOptimal}
                    keywordOptimized={title.keywordOptimized}
                    overallRank={title.overallRank}
                    isFavorite={title.isFavorite}
                    isPrimary={title.id === selectedTitleId}
                    maxLength={currentInput?.maxLength || 70}
                    onToggleFavorite={() =>
                      toggleFavoriteMutation.mutate({
                        titleId: title.id,
                        isFavorite: title.isFavorite,
                      })
                    }
                    onSetPrimary={() => handleSelectTitle(title.id)}
                    onCopy={() => handleCopy()}
                  />
                ))}

                {/* Generate More Button */}
                {!generateMutation.isPending && !isLimitReached && (
                  <Card className="border-dashed border-violet-300/60 dark:border-violet-500/30 p-6 bg-gradient-to-br from-violet-50/50 dark:from-violet-500/[0.04] to-transparent">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Not finding the right title? Generate 5 more variations
                        with the same topic.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleGenerateMore}
                        disabled={generateMutation.isPending}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Generate 5 More Titles
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
