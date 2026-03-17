"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Compass, Sparkles, Search, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { NicheQuiz } from "@/components/niche-discovery/niche-quiz";
import { NicheCard } from "@/components/niche-discovery/niche-card";
import { NicheFilterBar } from "@/components/niche-discovery/niche-filter-bar";
import { NicheDetailsModal } from "@/components/niche-discovery/niche-details-modal";
import type {
  NicheQuizInputs,
  NicheRecommendation,
  NicheData,
  NicheCategory,
  CompetitionLevel,
  GrowthTrend
} from "@/lib/types/niche";

type ViewMode = "quiz" | "recommendations" | "browse";

// Local filter interface matching NicheFilterBar
interface LocalFilters {
  category?: NicheCategory;
  competition?: CompetitionLevel;
  monetizationMin?: number;
  growthTrend?: GrowthTrend;
  faceless?: boolean;
  search?: string;
}

export default function NicheDiscoveryPage() {
  const router = useRouter();
  const { toast } = useToast();

  // View state
  const [activeTab, setActiveTab] = useState<"ai" | "browse">("ai");
  const [viewMode, setViewMode] = useState<ViewMode>("quiz");

  // Quiz and AI state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<NicheRecommendation[]>([]);
  const [quizInputs, setQuizInputs] = useState<NicheQuizInputs | null>(null);

  // Browse state
  const [allNiches, setAllNiches] = useState<NicheData[]>([]);
  const [filteredNiches, setFilteredNiches] = useState<NicheData[]>([]);
  const [isLoadingNiches, setIsLoadingNiches] = useState(false);
  const [filters, setFilters] = useState<LocalFilters>({});

  // Selection state
  const [selectedNiche, setSelectedNiche] = useState<NicheRecommendation | NicheData | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewingNiche, setViewingNiche] = useState<NicheRecommendation | NicheData | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Load niches for browse tab
  useEffect(() => {
    if (activeTab === "browse" && allNiches.length === 0) {
      loadNiches();
    }
  }, [activeTab]);

  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [filters, allNiches]);

  const loadNiches = async () => {
    setIsLoadingNiches(true);
    try {
      const response = await fetch("/api/niche-discovery/niches");
      const data = await response.json();
      if (data.niches) {
        setAllNiches(data.niches);
        setFilteredNiches(data.niches);
      }
    } catch (error) {
      console.error("Failed to load niches:", error);
      toast({
        title: "Error",
        description: "Failed to load niches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingNiches(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allNiches];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (niche) =>
          niche.name.toLowerCase().includes(searchLower) ||
          niche.description.toLowerCase().includes(searchLower) ||
          niche.keywords.some((k) => k.toLowerCase().includes(searchLower))
      );
    }

    if (filters.category) {
      filtered = filtered.filter((niche) => niche.category === filters.category);
    }

    if (filters.competition) {
      filtered = filtered.filter((niche) => niche.competitionLevel === filters.competition);
    }

    if (filters.faceless) {
      filtered = filtered.filter((niche) => !niche.requiresFace);
    }

    if (filters.monetizationMin !== undefined) {
      filtered = filtered.filter((niche) => niche.monetizationPotential >= filters.monetizationMin!);
    }

    if (filters.growthTrend) {
      filtered = filtered.filter((niche) => niche.growthTrend === filters.growthTrend);
    }

    setFilteredNiches(filtered);
  };

  const handleFiltersChange = (newFilters: LocalFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleQuizComplete = async (inputs: NicheQuizInputs) => {
    setQuizInputs(inputs);
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/niche-discovery/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: inputs.interests,
          availableTime: inputs.availableHoursPerWeek,
          skillLevel: inputs.skillLevel,
          goal: inputs.primaryGoal,
          showFace: inputs.showFace,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setRecommendations(data.recommendations || []);
      setViewMode("recommendations");
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleViewDetails = (niche: NicheRecommendation | NicheData) => {
    setViewingNiche(niche);
    setDetailsModalOpen(true);
  };

  const handleSelectNiche = async (niche: NicheRecommendation | NicheData) => {
    setIsSelecting(true);
    setSelectedNiche(niche);

    try {
      const response = await fetch("/api/niche-discovery/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicheId: niche.id,
          nicheName: niche.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Selection failed");
      }

      toast({
        title: "Niche Selected!",
        description: `You've selected "${niche.name}" as your content niche.`,
      });

      // Redirect to dashboard after selection
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (error) {
      console.error("Selection error:", error);
      toast({
        title: "Selection Failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setSelectedNiche(null);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleStartOver = () => {
    setViewMode("quiz");
    setRecommendations([]);
    setQuizInputs(null);
  };

  // Convert NicheData to NicheRecommendation format for display
  const nicheDataToRecommendation = (niche: NicheData): NicheRecommendation => ({
    id: niche.id,
    name: niche.name,
    category: niche.category,
    description: niche.description,
    matchScore: 0, // No match score for browse
    competitionLevel: niche.competitionLevel,
    monetizationPotential: niche.monetizationPotential,
    averageCPM: niche.averageCPM,
    growthTrend: niche.growthTrend,
    exampleChannels: niche.exampleChannels,
    contentTypes: niche.contentTypes,
    targetAudience: niche.targetAudience,
    trendingTopics: [],
    reasoning: "",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
            <Compass className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Niche Discovery</h1>
            <p className="text-muted-foreground">
              Find the perfect content niche based on your interests, skills, and goals.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ai" | "browse")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Recommendations
          </TabsTrigger>
          <TabsTrigger value="browse" className="gap-2">
            <Search className="h-4 w-4" />
            Browse All
          </TabsTrigger>
        </TabsList>

        {/* AI Recommendations Tab */}
        <TabsContent value="ai" className="mt-6">
          {viewMode === "quiz" && (
            <NicheQuiz onComplete={handleQuizComplete} isLoading={isAnalyzing} />
          )}

          {viewMode === "recommendations" && (
            <div className="space-y-6">
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Your Personalized Recommendations
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-neutral-400">
                    Based on your interests and goals, here are niches that match your profile
                  </p>
                </div>
                <Button variant="outline" onClick={handleStartOver}>
                  Start Over
                </Button>
              </div>

              {/* Recommendations Grid */}
              {recommendations.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {recommendations.map((niche, index) => (
                    <NicheCard
                      key={niche.id || index}
                      niche={niche}
                      matchScore={niche.matchScore}
                      reasoning={niche.reasoning}
                      isSelected={selectedNiche?.id === niche.id}
                      onSelect={() => handleSelectNiche(niche)}
                      onViewDetails={() => handleViewDetails(niche)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
                  <p className="text-gray-500 dark:text-neutral-400">
                    No recommendations found. Try adjusting your preferences.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={handleStartOver}>
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Browse All Tab */}
        <TabsContent value="browse" className="mt-6 space-y-6">
          {/* Filters */}
          <NicheFilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />

          {/* Results Count */}
          <div className="text-sm text-gray-500 dark:text-neutral-400">
            Showing {filteredNiches.length} of {allNiches.length} niches
          </div>

          {/* Niches Grid */}
          {isLoadingNiches ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredNiches.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredNiches.map((niche) => (
                <NicheCard
                  key={niche.id}
                  niche={nicheDataToRecommendation(niche)}
                  isSelected={selectedNiche?.id === niche.id}
                  onSelect={() => handleSelectNiche(niche)}
                  onViewDetails={() => handleViewDetails(nicheDataToRecommendation(niche))}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
              <p className="text-gray-500 dark:text-neutral-400">
                No niches match your filters. Try adjusting your search criteria.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setFilters({})}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Selection Overlay */}
      {isSelecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-8 shadow-2xl dark:bg-neutral-900">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Setting Up Your Niche
            </h3>
            <p className="text-center text-gray-500 dark:text-neutral-400">
              Configuring your content strategy for &ldquo;{selectedNiche?.name}&rdquo;
            </p>
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        </div>
      )}

      {/* Details Modal */}
      {viewingNiche && (
        <NicheDetailsModal
          niche={viewingNiche}
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          onSelect={(niche) => {
            setDetailsModalOpen(false);
            handleSelectNiche(niche);
          }}
          isSelecting={isSelecting}
        />
      )}
    </div>
  );
}
