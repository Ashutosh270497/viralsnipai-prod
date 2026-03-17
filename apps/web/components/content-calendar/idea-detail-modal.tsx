"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, CheckCircle, RefreshCw, Calendar as CalendarIcon, TrendingUp, Search, Eye, Lightbulb, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { VideoIdea } from "@/lib/types/content-calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useContentSync } from "@/lib/hooks/use-content-sync";

interface IdeaDetailModalProps {
  idea: VideoIdea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function IdeaDetailModal({ idea, open, onOpenChange, onRefresh }: IdeaDetailModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { navigateToRepurpose } = useContentSync();
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Mark as done mutation
  const markAsDoneMutation = useMutation({
    mutationFn: async () => {
      if (!idea) throw new Error("No idea to update");
      const res = await fetch(`/api/content-calendar/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-calendars"] });
      toast({ title: "Success", description: "Idea marked as published!" });
      onRefresh?.();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    },
  });

  // Regenerate idea mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!idea) throw new Error("No idea to regenerate");
      const res = await fetch(`/api/content-calendar/ideas/${idea.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to regenerate idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-calendars"] });
      toast({ title: "Success", description: "New idea generated!" });
      onRefresh?.();
      setIsRegenerating(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to regenerate idea", variant: "destructive" });
      setIsRegenerating(false);
    },
  });

  const repurposeMutation = useMutation({
    mutationFn: async () => {
      if (!idea) throw new Error("No idea to send to RepurposeOS");

      const sourceUrl =
        typeof window !== "undefined"
          ? new URL(`/dashboard/content-calendar?ideaId=${idea.id}`, window.location.origin).toString()
          : undefined;

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: idea.title,
          topic: idea.description || idea.niche || idea.title,
          sourceUrl,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error?.fieldErrors?.title?.[0] ?? payload.error ?? "Failed to create repurpose project");
      }
      return payload as { project: { id: string } };
    },
    onSuccess: ({ project }) => {
      navigateToRepurpose({
        id: idea!.id,
        projectId: project.id,
        title: idea!.title,
        niche: idea!.niche || idea!.contentCategory,
        description: idea!.description,
        keywords: idea!.keywords,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Repurpose handoff failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!idea) return null;

  const handleGenerateScript = () => {
    router.push(`/script-generator?ideaId=${idea.id}&title=${encodeURIComponent(idea.title)}`);
    onOpenChange(false);
  };

  const handleGenerateTitle = () => {
    const keywords = (idea.keywords || []).join(',');
    const params = new URLSearchParams({
      ideaId: idea.id,
      topic: idea.title,
      description: idea.description || '',
      keywords: keywords,
    });
    router.push(`/dashboard/title-generator?${params.toString()}`);
    onOpenChange(false);
  };

  const handleGenerateThumbnail = () => {
    const params = new URLSearchParams({
      ideaId: idea.id,
      title: idea.title,
      niche: idea.contentCategory || '',
    });
    router.push(`/dashboard/thumbnail-generator?${params.toString()}`);
    onOpenChange(false);
  };

  const handleMarkAsDone = () => {
    if (confirm("Mark this video idea as published?")) {
      markAsDoneMutation.mutate();
    }
  };

  const handleRegenerate = () => {
    if (confirm("Generate a new idea for this slot? This will replace the current idea.")) {
      setIsRegenerating(true);
      regenerateMutation.mutate();
    }
  };

  const getViralityColor = (score: number) => {
    if (score >= 80) return "text-red-600 dark:text-red-500";
    if (score >= 50) return "text-amber-600 dark:text-amber-500";
    return "text-muted-foreground";
  };

  const getViralityLabel = (score: number) => {
    if (score >= 80) return "High Virality";
    if (score >= 50) return "Medium Virality";
    return "Growing Potential";
  };

  const getCategoryBadge = (category: string) => {
    const styles = {
      trending: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-600 border-red-300 dark:border-red-500/20",
      evergreen: "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-600 border-green-300 dark:border-green-500/20",
      experimental: "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-600 border-purple-300 dark:border-purple-500/20",
    };
    return styles[category as keyof typeof styles] || "";
  };

  const getCompetitionLabel = (score: number) => {
    if (score >= 8) return "High Competition";
    if (score >= 5) return "Medium Competition";
    return "Low Competition";
  };

  const getCompetitionColor = (score: number) => {
    if (score >= 8) return "text-red-600 dark:text-red-500";
    if (score >= 5) return "text-amber-600 dark:text-amber-500";
    return "text-emerald-600 dark:text-emerald-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <Badge className={cn("border", getCategoryBadge(idea.contentCategory || ""))}>
                  {idea.contentCategory}
                </Badge>
                <Badge variant="outline">
                  {idea.videoType === "short" ? "🎬 Short" : "📺 Long-form"}
                </Badge>
              </div>
              <DialogTitle className="text-2xl">{idea.title}</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <p className="text-muted-foreground">{idea.description}</p>
          </div>

          <Separator />

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-secondary/20 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                Virality Score
              </div>
              <div className={cn("text-2xl font-bold", getViralityColor(idea.viralityScore || 0))}>
                {idea.viralityScore}/100
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {getViralityLabel(idea.viralityScore || 0)}
              </div>
            </div>

            <div className="rounded-lg border bg-secondary/20 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Eye className="h-4 w-4" />
                Est. Views
              </div>
              <div className="text-2xl font-bold">
                {idea.estimatedViews?.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                30-day projection
              </div>
            </div>

            <div className="rounded-lg border bg-secondary/20 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Search className="h-4 w-4" />
                Search Volume
              </div>
              <div className="text-2xl font-bold">
                {idea.searchVolume?.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Monthly searches
              </div>
            </div>

            <div className="rounded-lg border bg-secondary/20 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                Competition
              </div>
              <div className={cn("text-2xl font-bold", getCompetitionColor(idea.competitionScore || 0))}>
                {idea.competitionScore}/10
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {getCompetitionLabel(idea.competitionScore || 0)}
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Reasoning */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              <h3 className="text-lg font-semibold">Why This Idea Will Work</h3>
            </div>
            <div className="rounded-lg border bg-secondary/20 p-4">
              <p className="text-sm leading-relaxed">{idea.reasoning}</p>
            </div>
          </div>

          <Separator />

          {/* Keywords */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Target Keywords</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {idea.keywords?.map((keyword, index) => (
                <Badge key={index} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Hook Suggestions */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Hook Ideas (First 15 Seconds)</h3>
            </div>
            <div className="space-y-2">
              {idea.hookSuggestions?.map((hook, index) => (
                <div key={index} className="rounded-lg border bg-secondary/20 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed">{hook}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Thumbnail Ideas */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Thumbnail Concepts</h3>
            </div>
            <div className="space-y-2">
              {idea.thumbnailIdeas?.map((thumbnail, index) => (
                <div key={index} className="rounded-lg border bg-secondary/20 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed">{thumbnail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span>Scheduled for {format(new Date(idea.scheduledDate), "MMMM d, yyyy")}</span>
            </div>
            <Badge variant="outline" className="capitalize">
              {idea.status}
            </Badge>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating || regenerateMutation.isPending}
            >
              {isRegenerating || regenerateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate Idea
                </>
              )}
            </Button>
          </div>
          <div className="flex gap-2">
            {idea.status !== "published" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAsDone}
                disabled={markAsDoneMutation.isPending}
              >
                {markAsDoneMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Published
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleGenerateTitle}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Generate Title
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateThumbnail}>
              <ImageIcon className="mr-2 h-4 w-4" />
              Generate Thumbnail
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => repurposeMutation.mutate()}
              disabled={repurposeMutation.isPending}
            >
              {repurposeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Send to RepurposeOS
            </Button>
            <Button size="sm" onClick={handleGenerateScript}>
              <FileText className="mr-2 h-4 w-4" />
              Generate Script
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
