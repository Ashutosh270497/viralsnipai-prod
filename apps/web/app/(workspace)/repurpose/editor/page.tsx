"use client";

import Link from "next/link";
import { useCallback, useRef, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  FileText,
  Film,
  Flame,
  Loader2,
  MessageSquareText,
  Palette,
  RefreshCw,
  Scissors,
  AlertTriangle,
  Crop,
  Waves,
  SlidersHorizontal,
  PanelRightOpen,
} from "lucide-react";

import { TranscriptEditor } from "@/components/repurpose/transcript-editor";
import { FramingPanel } from "@/components/repurpose/framing-panel";
import { CreativeEnhancementsPanel } from "@/components/repurpose/creative-enhancements-panel";
import { BrandTemplateApplyPanel } from "@/components/repurpose/brand-template-apply-panel";
import {
  TopClipStrip,
  sortV1ClipsForStrip,
  type V1ClipSortMode,
} from "@/components/repurpose/editor/v1/top-clip-strip";
import { SafeThumbnailImage } from "@/components/repurpose/safe-thumbnail-image";
import { SourceQualityNotice } from "@/components/repurpose/source-quality-notice";
import { useClipUpdateQueue } from "@/components/repurpose/use-clip-update-queue";
import { useRepurpose } from "@/components/repurpose/repurpose-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { cn, formatDuration } from "@/lib/utils";
import { srtToWebVTT } from "@/lib/captions/webvtt";
import { projectKeys } from "@/lib/hooks/queries/useProjects";
import {
  BoundaryConfidenceBadge,
  ClipTypeBadge,
  PlatformFitChips,
  ReviewStatusBadge,
  TranscriptPrecisionBadge,
  ViralityScoreBadge,
  getClipMetadata,
} from "@/components/repurpose/quality-indicators";
import type { ClipReviewStatus } from "@/lib/types";
import type { ClipCaptionStyleConfig } from "@/lib/repurpose/caption-style-config";
import type { ClipLayoutConfig } from "@/lib/repurpose/layout-config";

type ReviewTab = "all" | ClipReviewStatus;
type SortBy = "score" | "confidence" | "duration" | "candidateType" | "createdAt";
type PlatformFilter = "all" | "youtubeShorts" | "instagramReels" | "tiktok" | "x";
type PrecisionFilter = "all" | "word" | "segment" | "low";
type WorkspaceTab = "preview" | "transcript" | "captions" | "style" | "advanced";

const REVIEW_STATUSES: ClipReviewStatus[] = [
  "needs_review",
  "approved",
  "rejected",
  "export_ready",
];

export default function RepurposeEditorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    projects,
    project,
    isProjectSelected,
    setProjectId,
    selectedClipIds,
    setSelectedClipIds,
    invalidate,
    isLoading,
  } = useRepurpose();

  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [captionLoading, setCaptionLoading] = useState<string | undefined>();
  const [retranscribing, setRetranscribing] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("all");
  const [hideLowConfidence, setHideLowConfidence] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [candidateTypeFilter, setCandidateTypeFilter] = useState("all");
  const [precisionFilter, setPrecisionFilter] = useState<PrecisionFilter>("all");
  const [reviewStatusByClip, setReviewStatusByClip] = useState<Record<string, ClipReviewStatus>>(
    {},
  );
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("preview");
  const [editorDirtyByClip, setEditorDirtyByClip] = useState<Record<string, boolean>>({});
  const captionInFlightRef = useRef<Set<string>>(new Set());
  const advancedEditorEnabled =
    process.env.NEXT_PUBLIC_ENABLE_ADVANCED_EDITOR === "true" ||
    process.env.NEXT_PUBLIC_V1_SIMPLE_EDITOR === "false";
  const useSimpleEditor = !advancedEditorEnabled;

  const clips = useMemo(() => project?.clips ?? [], [project?.clips]);
  const { updateClip } = useClipUpdateQueue({
    projectId: project?.id,
    clips,
    onProjectRefreshed: invalidate,
    onConflictResolved: () => {
      toast({
        title: "Clip refreshed",
        description: "A background update finished first, so ViralSnipAI retried with the latest clip version.",
      });
    },
  });
  const getReviewStatus = useCallback(
    (clip: { id: string; reviewStatus?: ClipReviewStatus | null }): ClipReviewStatus =>
      reviewStatusByClip[clip.id] ?? clip.reviewStatus ?? "needs_review",
    [reviewStatusByClip],
  );
  const reviewCounts = useMemo(() => {
    return clips.reduce(
      (counts, clip) => {
        counts.all += 1;
        counts[getReviewStatus(clip)] += 1;
        return counts;
      },
      { all: 0, needs_review: 0, approved: 0, rejected: 0, export_ready: 0 } as Record<
        ReviewTab,
        number
      >,
    );
  }, [clips, getReviewStatus]);
  const candidateTypes = useMemo(() => {
    return Array.from(
      new Set(clips.map((clip) => getClipMetadata(clip).candidateType).filter(Boolean) as string[]),
    ).sort();
  }, [clips]);
  const visibleClips = useMemo(() => {
    const confidenceRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return [...clips]
      .filter((clip) => {
        const metadata = getClipMetadata(clip);
        const status = getReviewStatus(clip);
        if (reviewTab !== "all" && status !== reviewTab) return false;
        if (hideLowConfidence && metadata.boundaryConfidence === "low") return false;
        if (candidateTypeFilter !== "all" && metadata.candidateType !== candidateTypeFilter)
          return false;
        if (precisionFilter === "word" && metadata.boundaryPrecision !== "word") return false;
        if (
          precisionFilter === "segment" &&
          metadata.boundaryPrecision !== "segment" &&
          metadata.boundaryPrecision !== "diarized_segment"
        )
          return false;
        if (
          precisionFilter === "low" &&
          (metadata.boundaryPrecision === "word" ||
            metadata.boundaryPrecision === "segment" ||
            metadata.boundaryPrecision === "diarized_segment")
        )
          return false;
        if (platformFilter !== "all") {
          const value = metadata.platformFit?.[platformFilter];
          return typeof value === "number" && value >= 65;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "duration") return b.endMs - b.startMs - (a.endMs - a.startMs);
        if (sortBy === "candidateType") {
          return (getClipMetadata(a).candidateType ?? "").localeCompare(
            getClipMetadata(b).candidateType ?? "",
          );
        }
        if (sortBy === "createdAt") {
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
        }
        if (sortBy === "confidence") {
          return (
            (confidenceRank[getClipMetadata(b).boundaryConfidence ?? "low"] ?? 0) -
            (confidenceRank[getClipMetadata(a).boundaryConfidence ?? "low"] ?? 0)
          );
        }
        return (b.viralityScore ?? 0) - (a.viralityScore ?? 0);
      });
  }, [
    clips,
    candidateTypeFilter,
    getReviewStatus,
    hideLowConfidence,
    platformFilter,
    precisionFilter,
    reviewTab,
    sortBy,
  ]);
  const defaultActiveClip = useMemo(
    () => [...clips].sort((a, b) => (b.viralityScore ?? 0) - (a.viralityScore ?? 0))[0] ?? null,
    [clips],
  );
  const activeClip = useMemo(
    () => clips.find((c) => c.id === activeClipId) ?? defaultActiveClip,
    [clips, activeClipId, defaultActiveClip],
  );
  const activeAsset = useMemo(
    () => project?.assets?.find((asset) => asset.id === activeClip?.assetId) ?? project?.assets?.[0] ?? null,
    [activeClip?.assetId, project?.assets],
  );
  const activeMetadata = getClipMetadata(activeClip);
  const activeReviewStatus = activeClip ? getReviewStatus(activeClip) : "needs_review";
  const activeEditorDirty = activeClip ? Boolean(editorDirtyByClip[activeClip.id]) : false;
  const activeQualitySignals = activeClip?.viralityFactors?.qualitySignals;
  const activePortraitPlan = activeClip?.viralityFactors?.reframePlans?.find(
    (plan) => plan.ratio === "9:16",
  );
  const activeClipIndex = activeClip ? clips.findIndex((clip) => clip.id === activeClip.id) : -1;
  const activeCaptionReady = Boolean(
    activeClip?.captionSrt &&
      !isSyntheticSrt(activeClip.captionSrt) &&
      !activeClip.captionSrt.includes("[Transcript unavailable]"),
  );
  const activeStyleReady = Boolean(activeClip?.captionStyle);
  const activeSourceLowQuality = Boolean(
    activeAsset?.sourceWidth &&
      activeAsset?.sourceHeight &&
      (activeAsset.sourceWidth < 1280 || activeAsset.sourceHeight < 720),
  );
  const handleActiveEditorDirtyChange = useCallback(
    (dirty: boolean) => {
      if (!activeClip?.id) return;
      setEditorDirtyByClip((prev) => {
        if (prev[activeClip.id] === dirty) return prev;
        return { ...prev, [activeClip.id]: dirty };
      });
    },
    [activeClip?.id],
  );
  const readyForExportCount = clips.filter((clip) => {
    const status = getReviewStatus(clip);
    return status === "approved" || status === "export_ready";
  }).length;
  const simpleEditorClips = useMemo(
    () => [...clips].sort((a, b) => (b.viralityScore ?? 0) - (a.viralityScore ?? 0)),
    [clips],
  );
  const mergeClipIntoProjectCache = useCallback(
    (clip: unknown) => {
      if (!project?.id || !clip || typeof clip !== "object" || !("id" in clip)) return;
      queryClient.setQueryData(projectKeys.detail(project.id), (current: any) => {
        const currentProject = current?.project ?? current;
        if (!currentProject?.clips) return current;
        const nextProject = {
          ...currentProject,
          clips: currentProject.clips.map((existing: any) =>
            existing.id === (clip as any).id ? { ...existing, ...(clip as any) } : existing,
          ),
        };
        return current?.project ? { ...current, project: nextProject } : nextProject;
      });
    },
    [project?.id, queryClient],
  );

  // ── Guard states ────────────────────────────────────────────────────────────
  if (projects.length === 0) {
    return <EmptyState message="Create a project to start repurposing video content." />;
  }
  if (!isProjectSelected) {
    return (
      <GlassCard
        title="Select a project"
        description="Choose a project from the selector above to open the editor."
      />
    );
  }
  if (isLoading) {
    return (
      <GlassCard
        title="Loading editor"
        description="Fetching clips, assets, and export state…"
        loading
      />
    );
  }
  if (!project) {
    return (
      <GlassCard
        title="Project unavailable"
        description="The selected project could not be loaded. Pick another project to continue."
      >
        <button
          onClick={() => setProjectId("")}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-muted/40 hover:bg-muted/60 text-sm font-medium transition-colors text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ingest & Detect
        </button>
      </GlassCard>
    );
  }
  if (project.assets.length === 0) {
    return (
      <GlassCard
        title="No media found"
        description="Ingest a YouTube video or upload a file to start editing clips."
      >
        <Link
          href={isProjectSelected ? `/repurpose?projectId=${project.id}` : "/repurpose"}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Go to Ingest & Detect
        </Link>
      </GlassCard>
    );
  }
  if (clips.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Edit & Export</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review clips, clean the transcript, and export the best moments.
          </p>
        </div>
        <GlassCard
          title="No clips yet. Generate clips first."
          description="Create clips from your source video, then come back here to review, edit, and export."
        >
          <Link
            href={`/repurpose?projectId=${project.id}`}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-muted/40 hover:bg-muted/60 text-sm font-medium transition-colors text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Create clips
          </Link>
        </GlassCard>
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  function toggleClip(id: string) {
    setSelectedClipIds(
      selectedClipIds.includes(id)
        ? selectedClipIds.filter((x) => x !== id)
        : [...selectedClipIds, id],
    );
  }

  function navigateActiveClip(direction: -1 | 1) {
    if (activeClipIndex < 0) return;
    const nextClip = clips[activeClipIndex + direction];
    if (nextClip) {
      setActiveClipId(nextClip.id);
      setWorkspaceTab("preview");
    }
  }

  async function syncLatestChanges() {
    await invalidate();
    toast({
      title: "Changes synced",
      description: "The editor is showing the latest saved clip state.",
    });
  }

  async function setReviewStatus(id: string, status: ClipReviewStatus) {
    const previous =
      reviewStatusByClip[id] ??
      clips.find((clip) => clip.id === id)?.reviewStatus ??
      "needs_review";
    setReviewStatusByClip((prev) => ({ ...prev, [id]: status }));
    if (status === "approved" || status === "export_ready") {
      setSelectedClipIds(selectedClipIds.includes(id) ? selectedClipIds : [...selectedClipIds, id]);
    }
    if (status === "rejected") {
      setSelectedClipIds(selectedClipIds.filter((clipId) => clipId !== id));
    }
    setStatusUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/clips/${id}/review-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: status }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch((): null => null);
        throw new Error(body?.error?.message ?? "Failed to update review status");
      }
      await invalidate();
    } catch (error) {
      setReviewStatusByClip((prev) => ({ ...prev, [id]: previous as ClipReviewStatus }));
      toast({
        variant: "destructive",
        title: "Review status not saved",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setStatusUpdating((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function batchSetReviewStatus(status: ClipReviewStatus) {
    const targetIds = selectedClipIds.filter((id) => clips.some((clip) => clip.id === id));
    if (targetIds.length === 0) {
      toast({ variant: "destructive", title: "Select clips first" });
      return;
    }
    await Promise.all(targetIds.map((id) => setReviewStatus(id, status)));
    toast({
      title: "Review queue updated",
      description: `${targetIds.length} clip${targetIds.length > 1 ? "s" : ""} marked ${status.replace(/_/g, " ")}.`,
    });
  }

  async function applyCaptionStyleToSelected(style: ClipCaptionStyleConfig) {
    const selected = clips.filter((clip) => selectedClipIds.includes(clip.id));
    if (selected.length === 0) return;
    await Promise.all(
      selected.map((clip) => updateClip(clip.id, { captionStyle: style }, { refresh: false })),
    );
    toast({
      title: "Caption style applied",
      description: `Updated ${selected.length} selected clip${selected.length === 1 ? "" : "s"}.`,
    });
    await invalidate();
  }

  async function applyCaptionStyleToAll(style: ClipCaptionStyleConfig) {
    if (clips.length === 0) return;
    await Promise.all(
      clips.map((clip) => updateClip(clip.id, { captionStyle: style }, { refresh: false })),
    );
    toast({
      title: "Caption style applied",
      description: `Updated ${clips.length} generated clip${clips.length === 1 ? "" : "s"}.`,
    });
    await invalidate();
  }

  async function applyLayoutToSelected(layoutConfig: ClipLayoutConfig) {
    const selected = clips.filter((clip) => selectedClipIds.includes(clip.id));
    if (selected.length === 0) return;
    const results = await Promise.all(
      selected.map((clip) =>
        updateClip(
          clip.id,
          {
            layoutPreset: layoutConfig.preset,
            aspectRatio: layoutConfig.aspectRatio,
            layoutConfig,
          },
          { refresh: false },
        ),
      ),
    );
    toast({
      title: "Layout applied",
      description: `Updated ${results.length} selected clip${results.length === 1 ? "" : "s"}.`,
    });
    await invalidate();
  }

  async function handleGenerateCaptions(clipId: string) {
    if (captionInFlightRef.current.has(clipId)) {
      return;
    }
    captionInFlightRef.current.add(clipId);
    setCaptionLoading(clipId);
    try {
      const res = await fetch("/api/repurpose/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId, force: true }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const body = await res.json().catch((): null => null);
      const nextClip = body?.data?.clip;
      if (nextClip) {
        mergeClipIntoProjectCache(nextClip);
      }
      toast({ title: "Captions generated", description: "Transcript ready for editing." });
      await invalidate();
    } catch {
      toast({ variant: "destructive", title: "Could not generate captions" });
    } finally {
      captionInFlightRef.current.delete(clipId);
      setCaptionLoading(undefined);
    }
  }

  /**
   * Re-runs Whisper transcription on the asset backing the active clip,
   * then regenerates captions for the clip from the real transcript.
   */
  async function handleRetranscribe() {
    const clip = activeClip;
    if (!clip?.assetId) {
      toast({ variant: "destructive", title: "No asset linked to this clip" });
      return;
    }
    setRetranscribing(true);
    try {
      // Step 1 — re-transcribe the source file.
      const rtRes = await fetch("/api/repurpose/retranscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: clip.assetId }),
        cache: "no-store",
      });
      if (!rtRes.ok) {
        const body = await rtRes.json().catch((): null => null);
        throw new Error(body?.message ?? "Re-transcription failed");
      }
      // Step 2 — regenerate captions for this clip from the fresh transcript.
      await handleGenerateCaptions(clip.id);
      toast({
        title: "Re-transcription complete",
        description: "Real transcript has replaced the placeholder. Captions regenerated.",
      });
      await invalidate();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Re-transcription failed",
        description:
          err instanceof Error
            ? err.message
            : "Please check that the source file exists and a transcription provider is configured.",
      });
    } finally {
      setRetranscribing(false);
    }
  }

  if (useSimpleEditor && activeClip) {
    return (
      <V1SimpleEditorPage
        projectId={project.id}
        clips={simpleEditorClips}
        activeClip={activeClip}
        activeAsset={activeAsset}
        activeMetadata={activeMetadata}
        activeReviewStatus={activeReviewStatus}
        activeCaptionReady={activeCaptionReady}
        activeEditorDirty={activeEditorDirty}
        activeSourceLowQuality={activeSourceLowQuality}
        captionLoading={captionLoading}
        statusUpdating={statusUpdating}
        selectedClipIds={selectedClipIds}
        setActiveClipId={setActiveClipId}
        getReviewStatus={getReviewStatus}
        setReviewStatus={setReviewStatus}
        onUpdateClip={(updates, options) => updateClip(activeClip.id, updates, options)}
        onSave={invalidate}
        onGenerateCaptions={() => handleGenerateCaptions(activeClip.id)}
        onDirtyChange={handleActiveEditorDirtyChange}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      {/* Header row */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/55 p-4 shadow-sm shadow-black/10 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400/75">
            Clip editing workspace
          </p>
          <h2 className="mt-1 text-2xl font-bold">Edit clips</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Choose a clip, make focused edits, preview the result, then mark it ready for export.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/50 bg-background/55 p-2 text-center sm:w-auto sm:min-w-[320px]">
          <div className="rounded-lg bg-muted/25 px-3 py-2">
            <p className="text-lg font-semibold text-foreground">{clips.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Clips
            </p>
          </div>
          <div className="rounded-lg bg-muted/25 px-3 py-2">
            <p className="text-lg font-semibold text-emerald-300">{reviewCounts.approved}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Approved
            </p>
          </div>
          <div className="rounded-lg bg-muted/25 px-3 py-2">
            <p className="text-lg font-semibold text-cyan-300">{readyForExportCount}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Ready
            </p>
          </div>
        </div>
      </div>

      <section className="min-w-0 rounded-2xl border border-border/60 bg-card/55 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Clip queue</p>
            <p className="text-xs text-muted-foreground/60">
              Select a clip to preview, edit, and mark ready.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
              {(["all", ...REVIEW_STATUSES] as ReviewTab[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setReviewTab(status)}
                  className={cn(
                    "h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold capitalize transition-colors",
                    reviewTab === status
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {status === "all" ? "All" : status.replace(/_/g, " ")}
                  <span className="ml-1.5 opacity-55">{reviewCounts[status]}</span>
                </button>
              ))}
            </div>
            <details className="relative rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs">
              <summary className="cursor-pointer list-none font-semibold text-muted-foreground hover:text-foreground">
                Filter
              </summary>
              <div className="mt-3 grid min-w-[260px] gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-xl lg:absolute lg:right-8 lg:z-20">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                  className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground"
                >
                  <option value="score">Best first</option>
                  <option value="confidence">Boundary confidence</option>
                  <option value="duration">Longest first</option>
                  <option value="candidateType">Clip type</option>
                  <option value="createdAt">Newest first</option>
                </select>
                <select
                  value={platformFilter}
                  onChange={(event) => setPlatformFilter(event.target.value as typeof platformFilter)}
                  className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground"
                >
                  <option value="all">All platforms</option>
                  <option value="youtubeShorts">Shorts fit</option>
                  <option value="instagramReels">Reels fit</option>
                  <option value="tiktok">TikTok fit</option>
                  <option value="x">X fit</option>
                </select>
                <select
                  value={precisionFilter}
                  onChange={(event) => setPrecisionFilter(event.target.value as PrecisionFilter)}
                  className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground"
                >
                  <option value="all">All timing</option>
                  <option value="word">Word-level</option>
                  <option value="segment">Segment</option>
                  <option value="low">Low precision</option>
                </select>
                <select
                  value={candidateTypeFilter}
                  onChange={(event) => setCandidateTypeFilter(event.target.value)}
                  className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground"
                >
                  <option value="all">All clip types</option>
                  {candidateTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setHideLowConfidence((value) => !value)}
                  className={cn(
                    "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                    hideLowConfidence
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                      : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {hideLowConfidence ? "Showing stronger clips" : "Hide low confidence clips"}
                </button>
              </div>
            </details>
          </div>
        </div>

        <div className="mt-3 flex min-w-0 gap-3 overflow-x-auto pb-2">
          {visibleClips.length === 0 ? (
            <div className="min-w-full rounded-xl border border-dashed border-border/50 bg-muted/20 p-6 text-center">
              <Scissors className="mx-auto mb-2 h-6 w-6 text-muted-foreground/25" />
              <p className="text-sm font-semibold text-foreground">No clips match these filters</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clear filters or return to Generate to create a different set.
              </p>
            </div>
          ) : (
            visibleClips.map((clip, index) => {
              const isActive = activeClip?.id === clip.id;
              const isSelected = selectedClipIds.includes(clip.id);
              const duration = clip.endMs - clip.startMs;
              const reviewStatus = getReviewStatus(clip);

              return (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => {
                    setActiveClipId(clip.id);
                    setWorkspaceTab("preview");
                  }}
                  className={cn(
                    "grid w-[260px] shrink-0 grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-xl border p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "border-primary/45 bg-primary/10 shadow-sm shadow-primary/10"
                      : "border-border/45 bg-background/45 hover:border-border hover:bg-muted/25",
                  )}
                  aria-label={`Select ${clip.title || `clip ${index + 1}`}`}
                  title={clip.title || `Clip ${index + 1}`}
                >
                  <SafeThumbnailImage
                    src={clip.thumbnail}
                    alt={clip.title || `Clip ${index + 1}`}
                    className="h-16 w-[88px] rounded-lg"
                    fallbackIcon={<Film className="h-5 w-5 text-muted-foreground/25" />}
                  />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-xs font-semibold leading-4 text-foreground">
                        {clip.title || `Clip ${index + 1}`}
                      </p>
                      {isSelected ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <span className="font-mono">{formatDuration(duration)}</span>
                      {clip.viralityScore != null ? <span>{clip.viralityScore}/100</span> : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <ReviewStatusBadge status={reviewStatus} />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Main layout */}
      <div
        className={cn(
          "grid min-w-0 gap-5",
          workspaceTab === "style"
            ? "min-[1720px]:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]"
            : "xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]",
        )}
      >
        {/* ── Active clip editor ───────────────────────────────────────────── */}
        <main className="min-w-0">
          {activeClip ? (
            <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
              {/* Clip meta bar */}
              <div className="flex flex-col gap-4 border-b border-border/40 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {activeClipIndex >= 0 ? `Clip ${activeClipIndex + 1} of ${clips.length}` : "Clip"}
                    </span>
                    <ReviewStatusBadge status={activeReviewStatus} />
                  </div>
                  <h3 className="truncate text-lg font-semibold">
                    {activeClip.title || "Untitled Clip"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground/60 tabular-nums">
                      {formatDuration(activeClip.endMs - activeClip.startMs)}
                    </span>
                    <span className="text-muted-foreground/30 text-xs">·</span>
                    <span className="text-xs text-muted-foreground/40 tabular-nums">
                      {formatDuration(activeClip.startMs)} → {formatDuration(activeClip.endMs)}
                    </span>
                    {activeClip.viralityScore != null && (
                      <>
                        <span className="text-muted-foreground/30 text-xs">·</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-semibold",
                            activeClip.viralityScore >= 80
                              ? "text-emerald-400"
                              : activeClip.viralityScore >= 60
                                ? "text-amber-400"
                                : "text-orange-400",
                          )}
                        >
                          <Flame className="h-3 w-3" />
                          {activeClip.viralityScore}/100
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1 rounded-full bg-muted/60 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                activeClip.viralityScore >= 80
                                  ? "bg-emerald-500"
                                  : activeClip.viralityScore >= 60
                                    ? "bg-amber-500"
                                    : "bg-orange-500",
                          )}
                          style={{ width: `${activeClip.viralityScore}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
                  </div>
                </div>
                <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => navigateActiveClip(-1)}
                    disabled={activeClipIndex <= 0}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/50 bg-muted/35 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateActiveClip(1)}
                    disabled={activeClipIndex < 0 || activeClipIndex >= clips.length - 1}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/50 bg-muted/35 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <details className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs">
                    <summary className="cursor-pointer list-none font-semibold text-muted-foreground hover:text-foreground">
                      More
                    </summary>
                    <div className="mt-3 grid min-w-[180px] gap-2">
                      <button
                        type="button"
                        onClick={() => void syncLatestChanges()}
                        className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:border-border"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewStatus(activeClip.id, "approved")}
                        disabled={Boolean(statusUpdating[activeClip.id])}
                        className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-left text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewStatus(activeClip.id, "rejected")}
                        disabled={Boolean(statusUpdating[activeClip.id])}
                        className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-left text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleClip(activeClip.id)}
                        className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:border-border"
                      >
                        {selectedClipIds.includes(activeClip.id)
                          ? "Remove from export selection"
                          : "Add to export selection"}
                      </button>
                    </div>
                  </details>
                  {activeReviewStatus === "export_ready" ? (
                    <Link
                      href={`/repurpose/export?projectId=${project.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
                    >
                      Export
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReviewStatus(activeClip.id, "export_ready")}
                      disabled={Boolean(statusUpdating[activeClip.id]) || activeEditorDirty}
                      title={activeEditorDirty ? "Save changes before marking export ready." : "Mark this clip ready for export."}
                      className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      Mark export ready
                    </button>
                  )}
                </div>
              </div>

              {/* ── Synthetic transcript recovery banner ──────────────────── */}
              {isSyntheticSrt(activeClip.captionSrt) && (
                <div className="flex items-start gap-3 border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-3.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-300">
                      Placeholder transcript detected
                    </p>
                    <p className="mt-0.5 text-xs text-amber-400/70">
                      This clip was generated from a synthetic fallback — not a real transcription.
                      Re-transcribe to replace it with the actual speech from the source video.
                    </p>
                  </div>
                  <button
                    onClick={handleRetranscribe}
                    disabled={retranscribing}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3 w-3", retranscribing && "animate-spin")} />
                    {retranscribing ? "Transcribing…" : "Re-transcribe"}
                  </button>
                </div>
              )}

              {/* ── Focused editor workspace ──────────────────────────────── */}
              <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as WorkspaceTab)} className="w-full">
                <div className="border-b border-border/40 px-5 pt-4">
                  <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/45 bg-background/45 p-1">
                    <TabsTrigger
                      value="preview"
                      className="h-9 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="transcript"
                      className="h-9 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Transcript
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="captions"
                      className="h-9 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <MessageSquareText className="h-3.5 w-3.5" />
                        Captions
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="style"
                      className="h-9 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5" />
                        Style
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="advanced"
                      className="h-9 rounded-lg px-3 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <PanelRightOpen className="h-3.5 w-3.5" />
                        Advanced
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Preview tab */}
                <TabsContent value="preview" className="m-0 space-y-4 p-5">
                  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="flex min-h-[260px] max-h-[calc(100vh-280px)] min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-black">
                      {activeClip.previewPath ? (
                        <video
                          src={activeClip.previewPath}
                          className="h-auto max-h-[calc(100vh-300px)] w-full bg-black object-contain"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <SafeThumbnailImage
                          src={activeClip.thumbnail}
                          alt={activeClip.title || "Clip preview"}
                          className="aspect-video w-full"
                          imageClassName="object-cover"
                          fallbackIcon={<Film className="h-10 w-10 text-muted-foreground/25" />}
                        />
                      )}
                    </div>
                    <div className="space-y-3">
                      <InsightCard
                        title="Clip quality"
                        value={
                          activeQualitySignals
                            ? `${activeQualitySignals.overallScore}/100`
                            : activeClip.viralityScore != null
                              ? `${activeClip.viralityScore}/100`
                              : "Pending"
                        }
                        description={
                          activeMetadata.viralReason ||
                          activeClip.viralityFactors?.reasoning ||
                          "Chosen for hook strength, pacing, and complete idea flow."
                        }
                        icon={<Waves className="h-4 w-4 text-cyan-300" />}
                      />
                      <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                          Next actions
                        </p>
                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={() => setWorkspaceTab("transcript")}
                            className="rounded-lg border border-border/50 bg-background px-3 py-2 text-left text-xs font-semibold text-foreground hover:border-border"
                          >
                            Edit transcript
                          </button>
                          <button
                            type="button"
                            onClick={() => setWorkspaceTab("captions")}
                            className="rounded-lg border border-border/50 bg-background px-3 py-2 text-left text-xs font-semibold text-foreground hover:border-border"
                          >
                            Update captions
                          </button>
                          <button
                            type="button"
                            onClick={() => setWorkspaceTab("style")}
                            className="rounded-lg border border-border/50 bg-background px-3 py-2 text-left text-xs font-semibold text-foreground hover:border-border"
                          >
                            Choose style
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Transcript tab */}
                <TabsContent value="transcript" className="m-0 p-5">
                  <TranscriptEditor
                    mode="transcript"
                    clipId={activeClip.id}
                    clipTitle={activeClip.title}
                    captionSrt={activeClip.captionSrt}
                    captionStyle={activeClip.captionStyle}
                    expectedVersion={activeClip.version}
                    startMs={activeClip.startMs}
                    endMs={activeClip.endMs}
                    previewPath={activeClip.previewPath}
                    sourceWidth={activeAsset?.sourceWidth}
                    sourceHeight={activeAsset?.sourceHeight}
                    projectId={project.id}
                    assetId={activeClip.assetId}
                    assetTranscript={activeAsset?.transcript ?? null}
                    selectedClipCount={selectedClipIds.length}
                    onApplyCaptionStyleToSelected={applyCaptionStyleToSelected}
                    onUpdateClip={(updates, options) => updateClip(activeClip.id, updates, options)}
                    smartReframePlan={
                      (activeClip.viralityFactors?.metadata?.smartReframe as
                        | import("@/lib/media/smart-reframe").SmartReframePlan
                        | undefined) ?? null
                    }
                    onSave={invalidate}
                    onGenerateCaptions={() => handleGenerateCaptions(activeClip.id)}
                    isGenerating={captionLoading === activeClip.id}
                    showSourceQualityNotice={false}
                    clipSummary={activeClip.summary}
                    callToAction={activeClip.callToAction}
                    onDirtyChange={handleActiveEditorDirtyChange}
                  />
                </TabsContent>

                {/* Captions tab */}
                <TabsContent value="captions" className="m-0 p-5">
                  <TranscriptEditor
                    mode="captions"
                    clipId={activeClip.id}
                    clipTitle={activeClip.title}
                    captionSrt={activeClip.captionSrt}
                    captionStyle={activeClip.captionStyle}
                    expectedVersion={activeClip.version}
                    startMs={activeClip.startMs}
                    endMs={activeClip.endMs}
                    previewPath={activeClip.previewPath}
                    sourceWidth={activeAsset?.sourceWidth}
                    sourceHeight={activeAsset?.sourceHeight}
                    projectId={project.id}
                    assetId={activeClip.assetId}
                    assetTranscript={activeAsset?.transcript ?? null}
                    selectedClipCount={selectedClipIds.length}
                    onApplyCaptionStyleToSelected={applyCaptionStyleToSelected}
                    onUpdateClip={(updates, options) => updateClip(activeClip.id, updates, options)}
                    smartReframePlan={
                      (activeClip.viralityFactors?.metadata?.smartReframe as
                        | import("@/lib/media/smart-reframe").SmartReframePlan
                        | undefined) ?? null
                    }
                    onSave={invalidate}
                    onGenerateCaptions={() => handleGenerateCaptions(activeClip.id)}
                    isGenerating={captionLoading === activeClip.id}
                    showSourceQualityNotice={false}
                    clipSummary={activeClip.summary}
                    callToAction={activeClip.callToAction}
                    onDirtyChange={handleActiveEditorDirtyChange}
                    onContinueToStyle={() => setWorkspaceTab("style")}
                  />
                </TabsContent>

                {/* Style tab */}
                <TabsContent value="style" className="m-0 p-5">
                  <TranscriptEditor
                    mode="style"
                    clipId={activeClip.id}
                    clipTitle={activeClip.title}
                    captionSrt={activeClip.captionSrt}
                    captionStyle={activeClip.captionStyle}
                    expectedVersion={activeClip.version}
                    startMs={activeClip.startMs}
                    endMs={activeClip.endMs}
                    previewPath={activeClip.previewPath}
                    sourceWidth={activeAsset?.sourceWidth}
                    sourceHeight={activeAsset?.sourceHeight}
                    projectId={project.id}
                    assetId={activeClip.assetId}
                    assetTranscript={activeAsset?.transcript ?? null}
                    selectedClipCount={selectedClipIds.length}
                    totalClipCount={clips.length}
                    onApplyCaptionStyleToSelected={applyCaptionStyleToSelected}
                    onApplyCaptionStyleToAll={applyCaptionStyleToAll}
                    onUpdateClip={(updates, options) => updateClip(activeClip.id, updates, options)}
                    smartReframePlan={
                      (activeClip.viralityFactors?.metadata?.smartReframe as
                        | import("@/lib/media/smart-reframe").SmartReframePlan
                        | undefined) ?? null
                    }
                    onSave={invalidate}
                    onGenerateCaptions={() => handleGenerateCaptions(activeClip.id)}
                    isGenerating={captionLoading === activeClip.id}
                    showSourceQualityNotice={false}
                    onDirtyChange={handleActiveEditorDirtyChange}
                    onContinueToExport={() => {
                      window.location.href = `/repurpose/export?projectId=${project.id}`;
                    }}
                  />
                </TabsContent>

                {/* Advanced tab */}
                <TabsContent value="advanced" className="m-0 p-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <InsightCard
                      title="Clip quality"
                      value={
                        activeQualitySignals
                          ? `${activeQualitySignals.overallScore}/100`
                          : activeClip.viralityScore != null
                            ? `${activeClip.viralityScore}/100`
                            : "Pending"
                      }
                      description={
                        activeQualitySignals
                          ? `${activeQualitySignals.contentDensity} pacing · ${activeQualitySignals.wordsPerMinute} WPM`
                          : "Quality signals appear after clip analysis."
                      }
                      icon={<Waves className="h-4 w-4 text-cyan-300" />}
                    />
                    <InsightCard
                      title="Cut risk"
                      value={activeQualitySignals?.hardCutRisk ?? "Unknown"}
                      description={
                        activeQualitySignals
                          ? `Scene alignment ${activeQualitySignals.sceneAlignment}/100 · cut cleanliness ${activeQualitySignals.cutCleanliness}/100`
                          : "Boundary alignment is unavailable."
                      }
                      icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}
                    />
                    <InsightCard
                      title="9:16 reframe"
                      value={activePortraitPlan ? activePortraitPlan.mode.replace("_", " ") : "Source-first"}
                      description={
                        activePortraitPlan?.reasoning ??
                        "Reframe guidance appears when source geometry is available."
                      }
                      icon={<Crop className="h-4 w-4 text-primary" />}
                    />
                  </div>

                  <details className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                    <summary
                      className="cursor-pointer text-sm font-semibold text-foreground"
                      aria-label="Toggle layout and brand styling"
                    >
                      Layout and brand styling
                    </summary>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Use these controls when you need reframe layout, manual crop, or saved brand template styling.
                    </p>
                    <div className="mt-4 space-y-4">
                      <FramingPanel
                        clipId={activeClip.id}
                        expectedVersion={activeClip.version}
                        thumbnail={activeClip.thumbnail}
                        sourceWidth={activeAsset?.sourceWidth}
                        sourceHeight={activeAsset?.sourceHeight}
                        smartReframePlan={
                          (activeClip.viralityFactors?.metadata?.smartReframe as
                            | import("@/lib/media/smart-reframe").SmartReframePlan
                            | undefined) ?? null
                        }
                        layoutConfig={
                          (activeClip.viralityFactors?.metadata?.layoutConfig as
                            | ClipLayoutConfig
                            | undefined) ?? null
                        }
                        selectedClipCount={selectedClipIds.length}
                        onApplyLayoutToSelected={applyLayoutToSelected}
                        onUpdateClip={(updates, options) => updateClip(activeClip.id, updates, options)}
                        onAnalysisComplete={invalidate}
                      />
                      <BrandTemplateApplyPanel
                        projectId={project.id}
                        activeClipId={activeClip.id}
                        selectedClipIds={selectedClipIds}
                        onApplied={invalidate}
                      />
                    </div>
                  </details>

                  <div className="rounded-xl border border-border/50 bg-muted/25 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                      Quality breakdown
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["Deterministic", activeMetadata.deterministicScore],
                        ["LLM score", activeMetadata.llmScore],
                        ["AI virality", activeClip.viralityScore],
                        ["Hook", activeClip.viralityFactors?.hookStrength],
                        ["Pacing", activeClip.viralityFactors?.pacing],
                        ["Story arc", activeClip.viralityFactors?.storyArc],
                        ["Transcript", activeClip.viralityFactors?.transcriptQuality],
                        ["Shareability", activeClip.viralityFactors?.shareability],
                        ["Scene align", activeQualitySignals?.sceneAlignment],
                        ["Cut clean", activeQualitySignals?.cutCleanliness],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-border/40 bg-background/35 p-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {typeof value === "number" ? `${Math.round(value)}/100` : "N/A"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <QualityList
                      title="Why this clip was selected"
                      items={
                        activeMetadata.viralReason
                          ? [activeMetadata.viralReason]
                          : activeClip.viralityFactors?.reasoning
                            ? [activeClip.viralityFactors.reasoning]
                            : null
                      }
                      fallback="Selected by transcript quality, hook density, pacing, and ranking."
                    />
                    <QualityList
                      title="Candidate reasons"
                      items={activeMetadata.candidateReasons}
                      fallback="No candidate reasons were stored for this clip."
                    />
                    <QualityList
                      title="Boundary reasons"
                      items={activeMetadata.boundaryReasons}
                      fallback="No boundary refinement notes were stored for this clip."
                    />
                  </div>

                  <CreativeEnhancementsPanel
                    clipId={activeClip.id}
                    clipDurationMs={activeClip.endMs - activeClip.startMs}
                    title={activeClip.title}
                    summary={activeClip.summary}
                    onChanged={invalidate}
                  />

                  {/* Caption file downloads */}
                  {activeClip.captionSrt &&
                  !isSyntheticSrt(activeClip.captionSrt) &&
                  !activeClip.captionSrt.includes("[Transcript unavailable]") ? (
                    <ClipCaptionDownloads
                      srt={activeClip.captionSrt}
                      clipTitle={activeClip.title}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 px-4 py-6 text-center">
                      <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground/50">No captions available</p>
                      <p className="mt-1 text-xs text-muted-foreground/35">
                        Generate captions first to enable .srt / .vtt downloads.
                      </p>
                    </div>
                  )}

                  {/* Link to full export page */}
                  <Link
                    href={`/repurpose/export?projectId=${project.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm shadow-primary/20"
                  >
                    Export with video render
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className="text-center text-[11px] text-muted-foreground/40">
                    Choose aspect ratio, burn captions into the video, and download the final MP4.
                  </p>
                </TabsContent>
              </Tabs>

              {/* Compact summary below workspace */}
              {activeClip.summary && workspaceTab !== "style" && (
                <div className="border-t border-border/40 px-5 py-4">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                    Clip summary
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/75">{activeClip.summary}</p>
                  {activeClip.callToAction && (
                    <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/40">
                      CTA: {activeClip.callToAction}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/20 p-16 text-center">
              <Scissors className="h-10 w-10 text-muted-foreground/15 mb-3" />
              <p className="text-sm font-medium text-muted-foreground/50">Select a clip to edit</p>
              <p className="text-xs text-muted-foreground/30 mt-1">
                Click any clip from the sidebar to view its transcript.
              </p>
            </div>
          )}
        </main>

        {/* ── Inspector ───────────────────────────────────────────────────── */}
        <aside
          className={cn(
            "min-w-0 space-y-3",
            workspaceTab === "style"
              ? "min-[1720px]:sticky min-[1720px]:top-24 min-[1720px]:max-h-[calc(100vh-120px)] min-[1720px]:self-start min-[1720px]:overflow-y-auto min-[1720px]:pr-1"
              : "xl:sticky xl:top-24 xl:max-h-[calc(100vh-120px)] xl:self-start xl:overflow-y-auto xl:pr-1",
          )}
        >
          {activeClip ? (
            <>
              {workspaceTab === "style" ? (
                <details open className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                    Style readiness
                  </summary>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Save the selected caption look before exporting.
                  </p>
                  <div className="mt-4 space-y-2">
                    <ReadinessItem
                      label="Caption theme selected"
                      status={activeStyleReady ? "done" : "pending"}
                      helper={activeStyleReady ? undefined : "Choose a caption style."}
                    />
                    <ReadinessItem
                      label="Subtitle preview available"
                      status={activeClip.previewPath ? "done" : "pending"}
                      helper={activeClip.previewPath ? undefined : "Regenerate captions to refresh preview."}
                    />
                    <ReadinessItem
                      label="Source quality checked"
                      status={activeSourceLowQuality ? "warning" : "done"}
                      helper={activeSourceLowQuality ? "Blur background may preserve quality better." : undefined}
                    />
                    <ReadinessItem
                      label="Export ready"
                      status={activeReviewStatus === "export_ready" ? "done" : "pending"}
                    />
                  </div>
                  {activeEditorDirty ? (
                    <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                      Save your style before exporting.
                    </p>
                  ) : null}
                  <div className="mt-4 grid gap-2">
                    <Link
                      href={`/repurpose/export?projectId=${project.id}`}
                      aria-disabled={activeEditorDirty}
                      className={cn(
                        "rounded-lg bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground transition hover:bg-primary/90",
                        activeEditorDirty && "pointer-events-none opacity-55",
                      )}
                    >
                      Continue to Export
                    </Link>
                    <button
                      type="button"
                      onClick={() => setReviewStatus(activeClip.id, "export_ready")}
                      disabled={activeEditorDirty || Boolean(statusUpdating[activeClip.id])}
                      className="rounded-lg border border-border/50 bg-background px-3 py-2 text-center text-xs font-semibold text-foreground hover:border-border disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      Mark export ready
                    </button>
                    <Link
                      href={`/repurpose/export?projectId=${project.id}`}
                      className="rounded-lg border border-border/50 bg-background px-3 py-2 text-center text-xs font-semibold text-foreground hover:border-border"
                    >
                      Open Export Center
                    </Link>
                  </div>
                </details>
              ) : null}

              {workspaceTab !== "style" ? (
              <details open className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  {workspaceTab === "captions" ? "Caption status" : "Status"}
                </summary>
                <p className="mt-1 text-xs leading-5 text-muted-foreground/60">
                  {workspaceTab === "captions"
                    ? "Key subtitle and timing signals for this clip."
                    : "Key readiness signals for the selected clip."}
                </p>
                <div className="mt-4 space-y-3">
                  <InspectorRow label="Status" value={<ReviewStatusBadge status={activeReviewStatus} />} />
                  <InspectorRow
                    label="Duration"
                    value={formatDuration(activeClip.endMs - activeClip.startMs)}
                  />
                  <InspectorRow
                    label="Timing"
                    value={<TranscriptPrecisionBadge precision={activeMetadata.boundaryPrecision} />}
                  />
                  <InspectorRow
                    label="Clip type"
                    value={<ClipTypeBadge type={activeMetadata.candidateType} />}
                  />
                  <InspectorRow
                    label="Boundary"
                    value={<BoundaryConfidenceBadge confidence={activeMetadata.boundaryConfidence} />}
                  />
                </div>
              </details>
              ) : null}

              <SourceQualityNotice
                sourceWidth={activeAsset?.sourceWidth}
                sourceHeight={activeAsset?.sourceHeight}
                targetWidth={1080}
                targetHeight={1920}
                compact
                replaceSourceHref={`/repurpose?projectId=${project.id}`}
                detailsCollapsed={workspaceTab === "style"}
              />

              {workspaceTab === "style" && activeClip.summary ? (
                <details className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                    Clip details
                  </summary>
                  <p className="mt-3 line-clamp-5 break-words text-xs leading-5 text-muted-foreground">
                    {activeClip.summary}
                  </p>
                  {activeClip.callToAction ? (
                    <p className="mt-3 break-words text-[11px] font-semibold text-muted-foreground">
                      CTA: {activeClip.callToAction}
                    </p>
                  ) : null}
                </details>
              ) : null}

              {workspaceTab !== "style" ? (
              <>
              <details open className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  Clip quality
                </summary>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {activeQualitySignals
                    ? `${activeQualitySignals.overallScore}/100`
                    : activeClip.viralityScore != null
                      ? `${activeClip.viralityScore}/100`
                      : "Pending"}
                </p>
                <p className="mt-1 line-clamp-4 text-xs leading-5 text-muted-foreground/65">
                  {activeMetadata.viralReason ||
                    activeClip.viralityFactors?.reasoning ||
                    "Chosen for hook strength, pacing, and complete idea flow."}
                </p>
              </details>

              <details className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  Platform fit
                </summary>
                <div className="mt-3">
                  <PlatformFitChips platformFit={activeMetadata.platformFit} />
                </div>
              </details>

              <details open className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  {workspaceTab === "captions" ? "Next step" : "Clip readiness"}
                </summary>
                <div className="mt-4 space-y-2">
                  <ReadinessItem
                    label="Transcript reviewed"
                    status={activeEditorDirty ? "warning" : activeCaptionReady ? "done" : "pending"}
                    helper={activeEditorDirty ? "Save current changes first." : undefined}
                  />
                  <ReadinessItem
                    label="Captions ready"
                    status={activeCaptionReady ? "done" : "pending"}
                    helper={activeCaptionReady ? undefined : "Generate or review captions."}
                  />
                  <ReadinessItem
                    label="Style selected"
                    status={activeStyleReady ? "done" : "pending"}
                    helper={activeStyleReady ? undefined : "Choose a caption style."}
                  />
                  <ReadinessItem
                    label="Source quality"
                    status={activeSourceLowQuality ? "warning" : "done"}
                    helper={activeSourceLowQuality ? "Low source resolution may export soft." : undefined}
                  />
                  <ReadinessItem
                    label="Export ready"
                    status={activeReviewStatus === "export_ready" ? "done" : "pending"}
                  />
                </div>
                {activeEditorDirty ? (
                  <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                    Save your current edits before marking this clip export ready.
                  </p>
                ) : null}
                <div className="mt-4 grid gap-2">
                  {workspaceTab === "captions" ? (
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab("style")}
                      disabled={activeEditorDirty}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      Continue to Style
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReviewStatus(activeClip.id, "export_ready")}
                      disabled={activeEditorDirty || Boolean(statusUpdating[activeClip.id])}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      Mark export ready
                    </button>
                  )}
                  {workspaceTab === "captions" ? (
                    <button
                      type="button"
                      onClick={() => setReviewStatus(activeClip.id, "export_ready")}
                      disabled={activeEditorDirty || Boolean(statusUpdating[activeClip.id])}
                      className="rounded-lg border border-border/50 bg-background px-3 py-2 text-center text-xs font-semibold text-foreground hover:border-border disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      Mark export ready
                    </button>
                  ) : null}
                  <Link
                    href={`/repurpose/export?projectId=${project.id}`}
                    className="rounded-lg border border-border/50 bg-background px-3 py-2 text-center text-xs font-semibold text-foreground hover:border-border"
                  >
                    Open Export Center
                  </Link>
                </div>
              </details>

              <details className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  Advanced insights
                </summary>
                <div className="mt-3 space-y-3">
                  <QualityList
                    title="Editing notes"
                    items={activeMetadata.editingNotes}
                    fallback="No editing notes were returned by the reranker."
                  />
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("advanced")}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:border-border"
                  >
                    Open Advanced tab
                  </button>
                </div>
              </details>
              </>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Select a clip to see readiness details.
            </div>
          )}
        </aside>
      </div>

    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function V1SimpleEditorPage({
  projectId,
  clips,
  activeClip,
  activeAsset,
  activeMetadata,
  activeReviewStatus,
  activeCaptionReady,
  activeEditorDirty,
  activeSourceLowQuality,
  captionLoading,
  statusUpdating,
  selectedClipIds,
  setActiveClipId,
  getReviewStatus,
  setReviewStatus,
  onUpdateClip,
  onSave,
  onGenerateCaptions,
  onDirtyChange,
}: {
  projectId: string;
  clips: any[];
  activeClip: any;
  activeAsset: any;
  activeMetadata: ReturnType<typeof getClipMetadata>;
  activeReviewStatus: ClipReviewStatus;
  activeCaptionReady: boolean;
  activeEditorDirty: boolean;
  activeSourceLowQuality: boolean;
  captionLoading?: string;
  statusUpdating: Record<string, boolean>;
  selectedClipIds: string[];
  setActiveClipId: (id: string) => void;
  getReviewStatus: (clip: { id: string; reviewStatus?: ClipReviewStatus | null }) => ClipReviewStatus;
  setReviewStatus: (id: string, status: ClipReviewStatus) => Promise<void>;
  onUpdateClip: Parameters<typeof TranscriptEditor>[0]["onUpdateClip"];
  onSave: () => Promise<void>;
  onGenerateCaptions: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [clipSortMode, setClipSortMode] = useState<V1ClipSortMode>("score");
  const orderedClips = useMemo(() => {
    return sortV1ClipsForStrip(clips, clipSortMode, getReviewStatus);
  }, [clipSortMode, clips, getReviewStatus]);
  const activeIndex = orderedClips.findIndex((clip) => clip.id === activeClip.id);
  const duration = activeClip.endMs - activeClip.startMs;
  const isStatusUpdating = Boolean(statusUpdating[activeClip.id]);
  const exportHref = `/repurpose/export?projectId=${projectId}`;
  const selectRelativeClip = (direction: -1 | 1) => {
    const nextClip = orderedClips[activeIndex + direction];
    if (nextClip) {
      setActiveClipId(nextClip.id);
    }
  };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-border/60 bg-card/55 p-4 shadow-sm shadow-black/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400/75">
              Edit & Export
            </p>
            <h2 className="mt-1 break-words text-2xl font-bold">Edit your clips</h2>
            <p className="mt-0.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Select a clip, preview it, clean the transcript, then mark it ready for export.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {activeReviewStatus === "export_ready" ? (
              <Link
                href={exportHref}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
              >
                Export clip
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Button
                onClick={() => setReviewStatus(activeClip.id, "export_ready")}
                disabled={isStatusUpdating || activeEditorDirty}
                title={activeEditorDirty ? "Save transcript changes before marking export ready." : undefined}
                className="h-10 rounded-xl"
              >
                {isStatusUpdating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Mark export ready
              </Button>
            )}
            <Button variant="outline" asChild className="h-10 rounded-xl">
              <Link href={exportHref}>Open Export</Link>
            </Button>
          </div>
        </div>
      </div>

      <TopClipStrip
        clips={orderedClips}
        activeClipId={activeClip.id}
        selectedClipIds={selectedClipIds}
        sortMode={clipSortMode}
        onSortModeChange={setClipSortMode}
        getReviewStatus={getReviewStatus}
        onSelectClip={setActiveClipId}
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <main className="min-w-0 space-y-5">
          <ClipPreviewPanel
            clip={activeClip}
            index={activeIndex}
            total={clips.length}
            duration={duration}
            metadata={activeMetadata}
            status={activeReviewStatus}
            onPrevious={() => selectRelativeClip(-1)}
            onNext={() => selectRelativeClip(1)}
          />

          {!activeCaptionReady ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-200">Captions need setup</p>
                    <p className="mt-1 text-xs leading-5 text-amber-100/70">
                      ViralSnipAI can prepare default captions for export. You can still edit the
                      transcript once captions are ready.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={onGenerateCaptions}
                  disabled={captionLoading === activeClip.id}
                  className="shrink-0 border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                >
                  {captionLoading === activeClip.id ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  )}
                  Generate captions
                </Button>
              </div>
            </div>
          ) : null}

          <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-foreground">Transcript editor</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground/65">
                Edit the readable transcript first. Advanced timing stays collapsed unless you need
                precise control.
              </p>
            </div>
            <TranscriptEditor
              mode="transcript"
              clipId={activeClip.id}
              clipTitle={activeClip.title}
              captionSrt={activeClip.captionSrt}
              captionStyle={activeClip.captionStyle}
              expectedVersion={activeClip.version}
              startMs={activeClip.startMs}
              endMs={activeClip.endMs}
              previewPath={activeClip.previewPath}
              sourceWidth={activeAsset?.sourceWidth}
              sourceHeight={activeAsset?.sourceHeight}
              projectId={projectId}
              assetId={activeClip.assetId}
              assetTranscript={activeAsset?.transcript ?? null}
              selectedClipCount={selectedClipIds.length}
              onUpdateClip={onUpdateClip}
              smartReframePlan={
                (activeClip.viralityFactors?.metadata?.smartReframe as
                  | import("@/lib/media/smart-reframe").SmartReframePlan
                  | undefined) ?? null
              }
              onSave={onSave}
              onGenerateCaptions={onGenerateCaptions}
              isGenerating={captionLoading === activeClip.id}
              showSourceQualityNotice={false}
              clipSummary={activeClip.summary}
              callToAction={activeClip.callToAction}
              onDirtyChange={onDirtyChange}
            />
          </section>

          <ExportReadinessPanel
            projectId={projectId}
            clipId={activeClip.id}
            status={activeReviewStatus}
            transcriptDirty={activeEditorDirty}
            captionsReady={activeCaptionReady}
            isUpdating={isStatusUpdating}
            onMarkReady={() => setReviewStatus(activeClip.id, "export_ready")}
          />
        </main>

        <V1ReadinessSidebar
          projectId={projectId}
          clip={activeClip}
          asset={activeAsset}
          status={activeReviewStatus}
          transcriptDirty={activeEditorDirty}
          captionsReady={activeCaptionReady}
          sourceLowQuality={activeSourceLowQuality}
          onGenerateCaptions={onGenerateCaptions}
          captionLoading={captionLoading === activeClip.id}
        />
      </div>
    </div>
  );
}

function ClipPreviewPanel({
  clip,
  index,
  total,
  duration,
  metadata,
  status,
  onPrevious,
  onNext,
}: {
  clip: any;
  index: number;
  total: number;
  duration: number;
  metadata: ReturnType<typeof getClipMetadata>;
  status: ClipReviewStatus;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
      <div className="flex flex-col gap-3 border-b border-border/45 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/50 bg-muted/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/65">
              Clip {Math.max(index + 1, 1)} of {total}
            </span>
            <ReviewStatusBadge status={status} />
          </div>
          <h3 className="mt-2 break-words text-xl font-semibold">{clip.title || "Untitled clip"}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/65">
            <span>{formatDuration(duration)}</span>
            {clip.viralityScore != null ? <span>{clip.viralityScore}/100 score</span> : null}
            {metadata.candidateType ? <span>{metadata.candidateType.replace(/_/g, " ")}</span> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPrevious} disabled={index <= 0}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <Button variant="outline" size="sm" onClick={onNext} disabled={index >= total - 1}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex min-h-[280px] max-h-[calc(100vh-320px)] min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-black">
          {clip.previewPath ? (
            <video
              src={clip.previewPath}
              className="h-auto max-h-[calc(100vh-340px)] w-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <SafeThumbnailImage
              src={clip.thumbnail}
              alt={clip.title || "Clip preview"}
              className="aspect-video w-full"
              imageClassName="object-cover"
              fallbackIcon={<Film className="h-10 w-10 text-muted-foreground/25" />}
            />
          )}
        </div>
        <div className="space-y-3">
          <InsightCard
            title="Clip quality"
            value={clip.viralityScore != null ? `${clip.viralityScore}/100` : "Pending"}
            description={
              metadata.viralReason ||
              clip.viralityFactors?.reasoning ||
              "Chosen for hook strength, pacing, and complete idea flow."
            }
            icon={<Flame className="h-4 w-4 text-amber-300" />}
          />
          {clip.summary ? (
            <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                Summary
              </p>
              <p className="mt-2 line-clamp-5 text-xs leading-5 text-muted-foreground/75">
                {clip.summary}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ExportReadinessPanel({
  projectId,
  clipId,
  status,
  transcriptDirty,
  captionsReady,
  isUpdating,
  onMarkReady,
}: {
  projectId: string;
  clipId: string;
  status: ClipReviewStatus;
  transcriptDirty: boolean;
  captionsReady: boolean;
  isUpdating: boolean;
  onMarkReady: () => Promise<void>;
}) {
  const ready = status === "export_ready";
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Export readiness</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground/65">
            {transcriptDirty
              ? "Save transcript changes before marking this clip ready."
              : ready
                ? "This clip is ready for the Export Center."
                : captionsReady
                  ? "Captions are ready. Mark the clip export ready when the transcript looks good."
                  : "Generate captions if needed, then mark the clip ready."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {ready ? (
            <Button asChild>
              <Link href={`/repurpose/export?projectId=${projectId}`}>
                Export clip
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button onClick={onMarkReady} disabled={transcriptDirty || isUpdating}>
              {isUpdating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Mark export ready
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/repurpose/export?projectId=${projectId}&clipId=${clipId}`}>
              Open Export
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function V1ReadinessSidebar({
  projectId,
  clip,
  asset,
  status,
  transcriptDirty,
  captionsReady,
  sourceLowQuality,
  onGenerateCaptions,
  captionLoading,
}: {
  projectId: string;
  clip: any;
  asset: any;
  status: ClipReviewStatus;
  transcriptDirty: boolean;
  captionsReady: boolean;
  sourceLowQuality: boolean;
  onGenerateCaptions: () => void;
  captionLoading: boolean;
}) {
  return (
    <aside className="min-w-0 space-y-4 xl:sticky xl:top-20">
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <p className="text-sm font-semibold text-foreground">Clip readiness</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground/65">
          Keep this checklist clean, then export from the Export Center.
        </p>
        <div className="mt-4 space-y-2">
          <ReadinessItem
            label="Transcript saved"
            status={transcriptDirty ? "warning" : "done"}
            helper={transcriptDirty ? "Save changes before exporting." : undefined}
          />
          <ReadinessItem
            label="Captions auto-ready"
            status={captionsReady ? "done" : "pending"}
            helper={captionsReady ? undefined : "Use the default caption generator."}
          />
          <ReadinessItem
            label="Source quality"
            status={sourceLowQuality ? "warning" : "done"}
            helper={sourceLowQuality ? "Low-resolution source may export softer." : undefined}
          />
          <ReadinessItem
            label="Export status"
            status={status === "export_ready" ? "done" : "pending"}
            helper={status === "export_ready" ? undefined : "Mark ready after review."}
          />
        </div>
        {!captionsReady ? (
          <Button
            variant="outline"
            onClick={onGenerateCaptions}
            disabled={captionLoading}
            className="mt-4 w-full"
          >
            {captionLoading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            Generate captions
          </Button>
        ) : null}
      </div>

      {sourceLowQuality ? <SourceQualityMiniNotice asset={asset} projectId={projectId} /> : null}

      <details className="rounded-2xl border border-border/60 bg-card/55 p-4">
        <summary className="cursor-pointer text-sm font-semibold">Clip details</summary>
        <div className="mt-3 space-y-2">
          <InspectorRow label="Duration" value={formatDuration(clip.endMs - clip.startMs)} />
          <InspectorRow label="Score" value={clip.viralityScore != null ? `${clip.viralityScore}/100` : "Pending"} />
          <InspectorRow label="Status" value={<ReviewStatusBadge status={status} />} />
        </div>
      </details>
    </aside>
  );
}

function SourceQualityMiniNotice({ asset, projectId }: { asset: any; projectId?: string }) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-200">Source quality is low</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/75">
            {asset?.sourceWidth && asset?.sourceHeight
              ? `${asset.sourceWidth}x${asset.sourceHeight} source may look soft in Shorts/Reels. Blur background mode is applied.`
              : "Low-resolution source may look soft in Shorts/Reels. Blur background mode is applied."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={projectId ? `/repurpose?projectId=${projectId}` : "/repurpose"}
              className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/15"
            >
              Replace source
            </Link>
            <details className="rounded-lg border border-border/50 bg-background/55 px-3 py-1.5 text-xs">
              <summary className="cursor-pointer text-muted-foreground">View details</summary>
              <div className="mt-2 space-y-1 text-muted-foreground/75">
                <p>Source quality: Low</p>
                <p>Render mode: Blur background</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

/** True when captionSrt contains the synthetic mock pattern from generateMockResult(). */
function isSyntheticSrt(srt: string | null | undefined): boolean {
  if (!srt) return false;
  return /this is synthetic transcript segment \d+/i.test(srt.slice(0, 500));
}

/** Client-side file download helper. */
function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

function safeStem(title: string | null | undefined): string {
  if (!title) return "captions";
  return (
    title
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 64)
      .toLowerCase() || "captions"
  );
}

function ReadinessItem({
  label,
  status,
  helper,
}: {
  label: string;
  status: "done" | "warning" | "pending";
  helper?: string;
}) {
  const tone =
    status === "done"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
      : status === "warning"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border/50 bg-muted/20 text-muted-foreground";

  return (
    <div className="rounded-lg border border-border/45 bg-background/35 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 break-words text-xs font-semibold text-foreground">{label}</span>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold", tone)}>
          {status === "done" ? "Done" : status === "warning" ? "Check" : "Pending"}
        </span>
      </div>
      {helper ? <p className="mt-1 break-words text-[11px] leading-4 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function ClipCaptionDownloads({ srt, clipTitle }: { srt: string; clipTitle?: string | null }) {
  const stem = safeStem(clipTitle);
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/45">
        Download Caption Files
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => downloadBlob(srt, "application/x-subrip", `${stem}.srt`)}
          className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:border-border hover:text-foreground"
        >
          <FileText className="h-3.5 w-3.5" />
          Download .srt
        </button>
        <button
          onClick={() => downloadBlob(srtToWebVTT(srt), "text/vtt", `${stem}.vtt`)}
          className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:border-border hover:text-foreground"
        >
          <FileText className="h-3.5 w-3.5" />
          Download .vtt
        </button>
      </div>
      <p className="mt-2.5 text-[10px] text-muted-foreground/40">
        Soft caption files — attach to any video player or upload to YouTube.
      </p>
    </div>
  );
}

function InsightCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-lg font-semibold capitalize text-foreground">{value}</p>
      <p className="mt-1 line-clamp-4 text-xs leading-5 text-muted-foreground/65">
        {description}
      </p>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
        {label}
      </span>
      <span className="min-w-0 text-right text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

function QualityList({
  title,
  items,
  fallback,
}: {
  title: string;
  items?: string[] | null;
  fallback: string;
}) {
  const visibleItems = items?.filter(Boolean).slice(0, 4) ?? [];
  return (
    <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
        {title}
      </p>
      {visibleItems.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {visibleItems.map((item) => (
            <li key={item} className="text-xs leading-5 text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs leading-5 text-muted-foreground/55">{fallback}</p>
      )}
    </div>
  );
}

function GlassCard({
  title,
  description,
  loading,
  children,
}: {
  title: string;
  description: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-8">
      <div className="flex items-center gap-2 mb-1">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
