"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/use-toast";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";
import { useProgress } from "@/hooks/use-progress";
import { useProject } from "@/lib/hooks/queries/useProjects";

import type { ProjectDetail, ProjectSummary } from "./types";

export type UseRepurposeWorkspaceArgs = {
  projects: ProjectSummary[];
  initialProjectId?: string;
};

export const HIGHLIGHT_MODEL_OPTIONS = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (Experimental)" },
  { value: "gpt-5-mini", label: "OpenAI GPT-5 Mini" },
  { value: "gpt-4.1-mini", label: "OpenAI GPT-4.1 Mini" }
] as const;

export function useRepurposeWorkspace({ projects, initialProjectId }: UseRepurposeWorkspaceArgs) {
  const { toast } = useToast();
  const { uiV2Enabled } = useFeatureFlags();

  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [captionLoading, setCaptionLoading] = useState<string | undefined>();
  const [sourceUrl, setSourceUrl] = useState("");
  const youtubeProgress = useProgress();
  const highlightProgress = useProgress();
  const highlightModelDefault =
    typeof process !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_REPURPOSE_DEFAULT_MODEL === "string" &&
    HIGHLIGHT_MODEL_OPTIONS.some((option) => option.value === process.env.NEXT_PUBLIC_REPURPOSE_DEFAULT_MODEL.trim())
      ? process.env.NEXT_PUBLIC_REPURPOSE_DEFAULT_MODEL.trim()
      : HIGHLIGHT_MODEL_OPTIONS[0].value;
  const [highlightModel, setHighlightModel] = useState<string>(highlightModelDefault);
  const [highlightBrief, setHighlightBrief] = useState<string>("");
  const [highlightAudience, setHighlightAudience] = useState<string>("Growth-focused creators");
  const [highlightTone, setHighlightTone] = useState<string>("Tension → payoff, high energy");
  const [highlightCallToAction, setHighlightCallToAction] = useState<string>("Drive viewers to subscribe or click through");

  // Use React Query to fetch project data
  const { data: projectData, refetch: refetchProject, error: projectError } = useProject(projectId || null);
  const project = projectData?.project ?? null;

  const primaryAsset = useMemo(() => project?.assets[0] ?? null, [project]);
  const isProjectSelected = Boolean(projectId);
  const selectValue = projectId === "" ? undefined : projectId;

  // Reset selection when project changes
  useEffect(() => {
    setSelectedClipIds([]);
  }, [projectId]);

  // Show error toast if project fetch fails
  useEffect(() => {
    if (projectError) {
      toast({ variant: "destructive", title: "Unable to load project" });
    }
  }, [projectError, toast]);

  // Wrapper for refetch to maintain compatibility with existing code
  const loadProject = useCallback(
    async (id: string) => {
      if (id === projectId) {
        await refetchProject();
      }
    },
    [projectId, refetchProject]
  );

  useEffect(() => {
    if (!initialProjectId) return;
    if (projects.some((proj) => proj.id === initialProjectId)) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId, projects]);

  const handleAutoHighlights = useCallback(async () => {
    if (!primaryAsset) {
      toast({
        variant: "destructive",
        title: "Upload an asset",
        description: "Add a long-form video before detecting highlights."
      });
      return;
    }

    highlightProgress.start();
    try {
      const response = await fetch("/api/repurpose/auto-highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: primaryAsset.id,
          model: highlightModel,
          brief: highlightBrief,
          audience: highlightAudience,
          tone: highlightTone,
          callToAction: highlightCallToAction
        }),
        cache: "no-store",
        next: { revalidate: 0 }
      });
      if (!response.ok) {
        throw new Error("Failed to generate highlights");
      }
      toast({ title: "Highlights detected", description: "Review and refine clips below." });
      await loadProject(projectId);
      highlightProgress.complete();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Could not detect highlights" });
      highlightProgress.reset();
    }
  }, [
    highlightAudience,
    highlightBrief,
    highlightCallToAction,
    highlightModel,
    highlightProgress,
    highlightTone,
    loadProject,
    primaryAsset,
    projectId,
    toast
  ]);

  const handleGenerateCaptions = useCallback(
    async (clipId: string) => {
      setCaptionLoading(clipId);
      try {
        const response = await fetch("/api/repurpose/captions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clipId }),
          cache: "no-store",
          next: { revalidate: 0 }
        });
        if (!response.ok) {
          throw new Error("Caption generation failed");
        }
        toast({ title: "Captions generated", description: "Preview updated clip." });
        await loadProject(projectId);
      } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Could not build captions" });
      } finally {
        setCaptionLoading(undefined);
      }
    },
    [loadProject, projectId, toast]
  );

  const handleIngestYouTube = useCallback(async () => {
    if (!sourceUrl) {
      toast({
        variant: "destructive",
        title: "Add a YouTube URL",
        description: "Paste a full https://youtube.com/watch?... link."
      });
      return;
    }

    youtubeProgress.start();
    try {
      // Step 1: Queue the ingestion job
      const response = await fetch("/api/repurpose/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sourceUrl }),
        cache: "no-store",
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        throw new Error("Failed to queue ingestion job");
      }

      const data = await response.json();
      const jobId = data.data.jobId;

      console.log("YouTube ingestion job queued", { jobId });

      toast({
        title: "Processing video",
        description: "YouTube video is being downloaded and transcribed. This may take a few minutes..."
      });
      setSourceUrl("");

      // Step 2: Poll for job status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/repurpose/ingest/${jobId}`, {
            cache: "no-store",
            next: { revalidate: 0 }
          });

          if (!statusResponse.ok) {
            throw new Error("Failed to check job status");
          }

          const statusData = await statusResponse.json();
          const status = statusData.data.status;

          console.log("YouTube ingest job status", { jobId, status });

          if (status === "completed") {
            clearInterval(pollInterval);
            toast({
              title: "YouTube ingested",
              description: "Video downloaded and transcribed. Highlights ready next."
            });
            await loadProject(projectId);
            youtubeProgress.complete();
          } else if (status === "failed") {
            clearInterval(pollInterval);
            const errorMessage = statusData.data.error || "Unknown error";
            throw new Error(errorMessage);
          }
          // Keep polling if status is "queued" or "processing"
        } catch (pollError) {
          clearInterval(pollInterval);
          console.error("Polling error:", pollError);
          toast({
            variant: "destructive",
            title: "Ingestion failed",
            description: pollError instanceof Error ? pollError.message : "Unknown error"
          });
          youtubeProgress.reset();
        }
      }, 5000); // Poll every 5 seconds

      // Stop polling after 10 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        if (youtubeProgress.isActive) {
          toast({
            variant: "destructive",
            title: "Ingestion timeout",
            description: "The process is taking longer than expected. Please refresh the page."
          });
          youtubeProgress.reset();
        }
      }, 600000); // 10 minutes

    } catch (error) {
      console.error("YouTube ingestion error:", error);
      toast({
        variant: "destructive",
        title: "Unable to ingest URL",
        description: "Check the link or try a different video."
      });
      youtubeProgress.reset();
    }
  }, [loadProject, projectId, sourceUrl, toast, youtubeProgress]);

  return {
    uiV2Enabled,
    projectId,
    setProjectId,
    project,
    selectedClipIds,
    setSelectedClipIds,
    captionLoading,
    sourceUrl,
    setSourceUrl,
    youtubeProgress,
    highlightProgress,
    highlightModel,
    setHighlightModel,
    highlightBrief,
    setHighlightBrief,
    highlightAudience,
    setHighlightAudience,
    highlightTone,
    setHighlightTone,
    highlightCallToAction,
    setHighlightCallToAction,
    primaryAsset,
    isProjectSelected,
    selectValue,
    handleAutoHighlights,
    handleGenerateCaptions,
    handleIngestYouTube,
    loadProject
  };
}
