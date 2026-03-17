"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbnailInputForm } from "@/components/thumbnail-generator/thumbnail-input-form";
import { ThumbnailCard } from "@/components/thumbnail-generator/thumbnail-card";
import { ThumbnailGeneratorInput } from "@/types/thumbnail";
import { toast } from "sonner";

interface GeneratedThumbnail {
  id: string;
  imageUrl: string;
  videoTitle: string;
  ctrScore: number;
  contrastScore: number;
  mobileReadability: number;
  emotionalImpact: number;
  nicheAlignment: number;
  overallRank: number;
  improvements: string[];
  reasoning: string;
  isPrimary: boolean;
  isFavorite: boolean;
}

export default function ThumbnailGeneratorPage() {
  const searchParams = useSearchParams();

  // Parse URL parameters for pre-filling
  const defaultValues = useMemo(() => {
    const ideaId = searchParams.get('ideaId');
    const title = searchParams.get('title');
    const niche = searchParams.get('niche');

    if (!title) return null;

    return {
      contentIdeaId: ideaId || undefined,
      videoTitle: title,
      niche: niche || '',
      thumbnailStyle: 'bold' as const,
      mainSubject: 'person' as const,
      colorScheme: 'vibrant' as const,
      includeText: true,
    };
  }, [searchParams]);

  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState<ThumbnailGeneratorInput | null>(defaultValues);

  // Generate thumbnails mutation
  const generateMutation = useMutation({
    mutationFn: async (input: ThumbnailGeneratorInput) => {
      const response = await fetch("/api/thumbnails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate thumbnails");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setCurrentBatchId(data.batchId);
      toast.success("Successfully generated 3 thumbnail variations!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Fetch thumbnails for current batch
  const { data: thumbnailsData, refetch: refetchThumbnails } = useQuery({
    queryKey: ["thumbnails", currentBatchId],
    queryFn: async () => {
      if (!currentBatchId) return null;

      const response = await fetch(`/api/thumbnails?batchId=${currentBatchId}`);
      if (!response.ok) throw new Error("Failed to fetch thumbnails");

      return response.json() as Promise<{ thumbnails: GeneratedThumbnail[] }>;
    },
    enabled: !!currentBatchId,
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ thumbnailId, isFavorite }: { thumbnailId: string; isFavorite: boolean }) => {
      const response = await fetch(`/api/thumbnails/${thumbnailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });

      if (!response.ok) throw new Error("Failed to update thumbnail");
      return response.json();
    },
    onSuccess: () => {
      refetchThumbnails();
    },
  });

  // Set primary mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (thumbnailId: string) => {
      const response = await fetch(`/api/thumbnails/${thumbnailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });

      if (!response.ok) throw new Error("Failed to set primary thumbnail");
      return response.json();
    },
    onSuccess: () => {
      refetchThumbnails();
      toast.success("Primary thumbnail selected!");
    },
  });

  const handleGenerate = (input: ThumbnailGeneratorInput) => {
    setCurrentInput(input);
    generateMutation.mutate(input);
  };

  const handleDownload = () => {
    toast.success("Thumbnail downloaded!");
  };

  const thumbnails = thumbnailsData?.thumbnails || [];

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 dark:from-violet-500/25 dark:to-fuchsia-500/25 p-2">
            <ImageIcon className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold">AI Thumbnail Generator</h1>
        </div>
        <p className="text-muted-foreground">
          Generate eye-catching YouTube thumbnails with AI. Optimized for maximum CTR using DALL-E 3.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Left Column - Input Form */}
        <div className="space-y-6">
          <Card className="border border-border dark:border-white/[0.07] p-6">
            <h2 className="mb-4 text-xl font-semibold">Generate Thumbnails</h2>
            <ThumbnailInputForm
              onGenerate={handleGenerate}
              isGenerating={generateMutation.isPending}
              defaultValues={defaultValues || currentInput || undefined}
            />
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {generateMutation.isPending && (
            <Card className="flex flex-col items-center justify-center p-12 border border-border dark:border-white/[0.07]">
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Generating Thumbnails...</h3>
              <p className="text-center text-sm text-muted-foreground">
                Our AI is creating 3 thumbnail variations using DALL-E 3.
                <br />
                This usually takes 30-60 seconds.
              </p>
            </Card>
          )}

          {!generateMutation.isPending && thumbnails.length === 0 && (
            <Card className="flex flex-col items-center justify-center p-12 border border-border dark:border-white/[0.07]">
              <div className="mb-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 dark:from-violet-500/20 dark:to-fuchsia-500/20 p-4">
                <Sparkles className="h-12 w-12 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Ready to Generate Thumbnails</h3>
              <p className="text-center text-sm text-muted-foreground">
                Fill out the form on the left and click &quot;Generate 3 Thumbnail Variations&quot;
                <br />
                to get started with AI-powered thumbnail creation.
              </p>
            </Card>
          )}

          {thumbnails.length > 0 && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Generated Thumbnails ({thumbnails.length})</h3>
                <Badge variant="secondary">
                  Batch ID: {currentBatchId?.slice(0, 8)}
                </Badge>
              </div>

              {/* Thumbnails Grid */}
              <div className="space-y-4">
                {thumbnails.map((thumbnail) => (
                  <ThumbnailCard
                    key={thumbnail.id}
                    imageUrl={thumbnail.imageUrl}
                    videoTitle={thumbnail.videoTitle}
                    ctrScore={thumbnail.ctrScore}
                    contrastScore={thumbnail.contrastScore}
                    mobileReadability={thumbnail.mobileReadability}
                    emotionalImpact={thumbnail.emotionalImpact}
                    nicheAlignment={thumbnail.nicheAlignment}
                    overallRank={thumbnail.overallRank}
                    improvements={thumbnail.improvements}
                    reasoning={thumbnail.reasoning}
                    isPrimary={thumbnail.isPrimary}
                    isFavorite={thumbnail.isFavorite}
                    onToggleFavorite={() =>
                      toggleFavoriteMutation.mutate({
                        thumbnailId: thumbnail.id,
                        isFavorite: thumbnail.isFavorite,
                      })
                    }
                    onSetPrimary={() => setPrimaryMutation.mutate(thumbnail.id)}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
