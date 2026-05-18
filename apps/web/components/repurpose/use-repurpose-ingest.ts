"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/use-toast";
import { useProgress } from "@/hooks/use-progress";
import type { AutoHighlightsAnalytics } from "@/components/repurpose/quality-indicators";
import type { ClipIntent, QualityMode } from "@/lib/ai/model-routing-options";
import { apiFetch, getFriendlyHttpErrorMessage } from "@/lib/http/client";

type UseRepurposeIngestArgs = {
  projectId: string;
  primaryAssetId?: string;
  onProjectRefresh: () => Promise<void>;
};

type AutoHighlightRequestOverrides = {
  mode?: "replace" | "merge" | "append";
  qualityMode?: QualityMode;
  clipIntent?: ClipIntent;
  targetPlatform?: string;
  brief?: string;
  audience?: string;
  tone?: string;
  callToAction?: string;
  target?: number;
  clipLengthPreset?: "short" | "balanced" | "detailed";
  debugModelOverride?: string;
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
  const [qualityMode, setQualityMode] = useState<QualityMode>("balanced");
  const [clipIntent, setClipIntent] = useState<ClipIntent>("auto");
  const [targetPlatform, setTargetPlatform] = useState<string>("auto");
  const [debugModelOverride, setDebugModelOverride] = useState<string>("");
  const [highlightBrief, setHighlightBrief] = useState<string>("");
  const [highlightAudience, setHighlightAudience] = useState<string>("Growth-focused creators");
  const [highlightTone, setHighlightTone] = useState<string>("Tension → payoff, high energy");
  const [highlightCallToAction, setHighlightCallToAction] = useState<string>(
    "Drive viewers to subscribe or click through",
  );
  const [targetClipCount, setTargetClipCount] = useState<number>(5);
  const [clipLengthPreset, setClipLengthPreset] = useState<"short" | "balanced" | "detailed">(
    "balanced",
  );
  const [lastHighlightAnalytics, setLastHighlightAnalytics] =
    useState<AutoHighlightsAnalytics | null>(null);

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

  const handleAutoHighlights = useCallback(async (overrides: AutoHighlightRequestOverrides = {}) => {
    if (!primaryAssetId) {
      toast({
        variant: "destructive",
        title: "Upload an asset",
        description: "Add a long-form video before detecting highlights.",
      });
      return false;
    }

    // Highlight detection typically takes 30-90s
    highlightProgress.start(90_000);
    highlightProgress.setPhase("Analyzing transcript", 40);

    try {
      const payload = await apiFetch<any>("/api/repurpose/auto-highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: primaryAssetId,
          mode: overrides.mode ?? "merge",
          qualityMode: overrides.qualityMode ?? qualityMode,
          clipIntent: overrides.clipIntent ?? clipIntent,
          targetPlatform: overrides.targetPlatform ?? targetPlatform,
          ...((overrides.debugModelOverride ?? debugModelOverride).trim()
            ? { debugModelOverride: (overrides.debugModelOverride ?? debugModelOverride).trim() }
            : {}),
          brief: overrides.brief ?? highlightBrief,
          audience: overrides.audience ?? highlightAudience,
          tone: overrides.tone ?? highlightTone,
          callToAction: overrides.callToAction ?? highlightCallToAction,
          target: overrides.target ?? targetClipCount,
          clipLengthPreset: overrides.clipLengthPreset ?? clipLengthPreset,
        }),
        cache: "no-store",
        operation: "generation",
      });
      setLastHighlightAnalytics(payload?.data?.analytics ?? null);
      toast({ title: "Highlights detected", description: "Review clips in Editor." });
      await onProjectRefresh();
      highlightProgress.complete();
      return true;
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Could not detect highlights",
        description: getFriendlyHttpErrorMessage(error),
      });
      highlightProgress.reset();
      return false;
    }
  }, [
    highlightAudience,
    highlightBrief,
    highlightCallToAction,
    qualityMode,
    clipIntent,
    targetPlatform,
    debugModelOverride,
    highlightProgress,
    highlightTone,
    clipLengthPreset,
    onProjectRefresh,
    primaryAssetId,
    targetClipCount,
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
      const data = await apiFetch<any>("/api/repurpose/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sourceUrl }),
        cache: "no-store",
        operation: "generation",
      });
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
          const statusData = await apiFetch<any>(`/api/repurpose/ingest/${jobId}`, {
            cache: "no-store",
            operation: "normal",
            retries: 1,
          });
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

      timeoutRef.current = setTimeout(
        () => {
          clearPolling();
          if (youtubeProgress.isActive) {
            toast({
              variant: "destructive",
              title: "Ingestion timeout",
              description: "The process is taking longer than expected. Refresh and retry.",
            });
            youtubeProgress.reset();
          }
        },
        10 * 60 * 1000,
      );
    } catch (error) {
      console.error("YouTube ingestion error:", error);
      toast({
        variant: "destructive",
        title: "Unable to ingest URL",
        description: getFriendlyHttpErrorMessage(error) || "Check the link or try a different video.",
      });
      youtubeProgress.reset();
      clearPolling();
    }
  }, [
    clearPolling,
    onProjectRefresh,
    projectId,
    readJobMetadata,
    sourceUrl,
    toast,
    youtubeProgress,
  ]);

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
    qualityMode,
    setQualityMode,
    clipIntent,
    setClipIntent,
    targetPlatform,
    setTargetPlatform,
    debugModelOverride,
    setDebugModelOverride,
    highlightBrief,
    setHighlightBrief,
    highlightAudience,
    setHighlightAudience,
    highlightTone,
    setHighlightTone,
    highlightCallToAction,
    setHighlightCallToAction,
    targetClipCount,
    setTargetClipCount,
    clipLengthPreset,
    setClipLengthPreset,
    lastHighlightAnalytics,
    handleIngestYouTube,
    handleAutoHighlights,
  };
}
