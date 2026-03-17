"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/use-toast";
import { useProgress } from "@/hooks/use-progress";
import { HIGHLIGHT_MODEL_OPTIONS } from "@/lib/constants/repurpose";

type UseRepurposeIngestArgs = {
  projectId: string;
  primaryAssetId?: string;
  onProjectRefresh: () => Promise<void>;
};

export function useRepurposeIngest({
  projectId,
  primaryAssetId,
  onProjectRefresh,
}: UseRepurposeIngestArgs) {
  const { toast } = useToast();

  const [sourceUrl, setSourceUrl] = useState("");
  const youtubeProgress = useProgress(800);
  const highlightProgress = useProgress(800);
  const highlightModelDefault =
    typeof process !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_REPURPOSE_DEFAULT_MODEL === "string" &&
    HIGHLIGHT_MODEL_OPTIONS.some(
      (option) => option.value === process.env.NEXT_PUBLIC_REPURPOSE_DEFAULT_MODEL!.trim()
    )
      ? process.env.NEXT_PUBLIC_REPURPOSE_DEFAULT_MODEL!.trim()
      : HIGHLIGHT_MODEL_OPTIONS[0].value;
  const [highlightModel, setHighlightModel] = useState<string>(highlightModelDefault);
  const [highlightBrief, setHighlightBrief] = useState<string>("");
  const [highlightAudience, setHighlightAudience] = useState<string>("Growth-focused creators");
  const [highlightTone, setHighlightTone] = useState<string>("Tension → payoff, high energy");
  const [highlightCallToAction, setHighlightCallToAction] = useState<string>(
    "Drive viewers to subscribe or click through"
  );

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const readJobMetadata = useCallback((value: unknown) => {
    if (!value || typeof value !== "object") {
      return null;
    }
    return value as { phase?: unknown; progress?: unknown };
  }, []);

  const handleAutoHighlights = useCallback(async () => {
    if (!primaryAssetId) {
      toast({
        variant: "destructive",
        title: "Upload an asset",
        description: "Add a long-form video before detecting highlights.",
      });
      return;
    }

    // Highlight detection typically takes 30-90s
    highlightProgress.start(90_000);
    highlightProgress.setPhase("Analyzing transcript", 40);

    try {
      const response = await fetch("/api/repurpose/auto-highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: primaryAssetId,
          model: highlightModel,
          brief: highlightBrief,
          audience: highlightAudience,
          tone: highlightTone,
          callToAction: highlightCallToAction,
        }),
        cache: "no-store",
        next: { revalidate: 0 },
      });
      if (!response.ok) {
        throw new Error("Failed to generate highlights");
      }
      toast({ title: "Highlights detected", description: "Review clips in Editor." });
      await onProjectRefresh();
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
    onProjectRefresh,
    primaryAssetId,
    toast,
  ]);

  const handleIngestYouTube = useCallback(async () => {
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Select a project",
        description: "Choose a project first.",
      });
      return;
    }

    if (!sourceUrl) {
      toast({
        variant: "destructive",
        title: "Add a YouTube URL",
        description: "Paste a full https://youtube.com/watch?... link.",
      });
      return;
    }

    // Real-world ingest can take multiple minutes depending on video length.
    youtubeProgress.start(300_000);
    youtubeProgress.setPhase("Queuing", 8);

    try {
      const response = await fetch("/api/repurpose/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sourceUrl }),
        cache: "no-store",
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        throw new Error("Failed to queue ingestion job");
      }

      const data = await response.json();
      const jobId = data.data.jobId;

      // Job accepted by backend.
      youtubeProgress.setAbsolute(10, "Queued");

      toast({
        title: "Processing video",
        description: "Downloading and transcribing. This may take a few minutes...",
      });
      setSourceUrl("");
      clearPolling();

      let seenProcessing = false;

      pollTimerRef.current = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/repurpose/ingest/${jobId}`, {
            cache: "no-store",
            next: { revalidate: 0 },
          });
          if (!statusResponse.ok) {
            throw new Error("Failed to check job status");
          }

          const statusData = await statusResponse.json();
          const payload = statusData.data ?? {};
          const status = String(payload.status || "").toLowerCase();
          const metadata = readJobMetadata(payload.metadata);
          const metadataProgress =
            typeof metadata?.progress === "number" ? metadata.progress : null;
          const metadataPhase =
            typeof metadata?.phase === "string" && metadata.phase.trim().length > 0
              ? metadata.phase.trim()
              : null;

          if (metadataProgress !== null) {
            youtubeProgress.setAbsolute(metadataProgress, metadataPhase ?? undefined);
          }

          // Advance progress based on backend status
          if (status === "processing" && !seenProcessing) {
            seenProcessing = true;
            if (metadataProgress === null) {
              youtubeProgress.setPhase("Processing", 70);
            }
          }

          if (status === "queued" && metadataProgress === null) {
            youtubeProgress.setPhase("Queued", 12);
          }

          if (status === "completed" || status === "done") {
            clearPolling();
            youtubeProgress.setPhase("Finalizing", 95);
            toast({
              title: "YouTube ingested",
              description: "Video downloaded and transcribed.",
            });
            await onProjectRefresh();
            youtubeProgress.complete();
            return;
          }

          if (status === "failed") {
            clearPolling();
            throw new Error(payload.error || "Unknown error");
          }
        } catch (pollError) {
          clearPolling();
          console.error("Polling error:", pollError);
          toast({
            variant: "destructive",
            title: "Ingestion failed",
            description: pollError instanceof Error ? pollError.message : "Unknown error",
          });
          youtubeProgress.reset();
        }
      }, 2500);

      timeoutRef.current = setTimeout(() => {
        clearPolling();
        if (youtubeProgress.isActive) {
          toast({
            variant: "destructive",
            title: "Ingestion timeout",
            description: "The process is taking longer than expected. Refresh and retry.",
          });
          youtubeProgress.reset();
        }
      }, 10 * 60 * 1000);
    } catch (error) {
      console.error("YouTube ingestion error:", error);
      toast({
        variant: "destructive",
        title: "Unable to ingest URL",
        description: "Check the link or try a different video.",
      });
      youtubeProgress.reset();
      clearPolling();
    }
  }, [clearPolling, onProjectRefresh, projectId, readJobMetadata, sourceUrl, toast, youtubeProgress]);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  return {
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
    handleIngestYouTube,
    handleAutoHighlights,
  };
}
