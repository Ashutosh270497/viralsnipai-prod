"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckSquare,
  FileText,
  Film,
  Flame,
  Loader2,
  RefreshCw,
  Scissors,
  AlertTriangle,
  Crop,
  Trash2,
  Type,
  Waves,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { TranscriptEditor } from "@/components/repurpose/transcript-editor";
import { FramingPanel } from "@/components/repurpose/framing-panel";
import { CreativeEnhancementsPanel } from "@/components/repurpose/creative-enhancements-panel";
import { BrandTemplateApplyPanel } from "@/components/repurpose/brand-template-apply-panel";
import { useRepurpose } from "@/components/repurpose/repurpose-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { getCaptionQuality } from "@/lib/caption-quality";
import { cn, formatDuration } from "@/lib/utils";
import { srtToWebVTT } from "@/lib/captions/webvtt";
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

const REVIEW_STATUSES: ClipReviewStatus[] = [
  "needs_review",
  "approved",
  "rejected",
  "export_ready",
];

export default function RepurposeEditorPage() {
  const { toast } = useToast();
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
  const [deleteClipId, setDeleteClipId] = useState<string | null>(null);
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

  const clips = useMemo(() => project?.clips ?? [], [project?.clips]);
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
  const activeClip = useMemo(
    () => clips.find((c) => c.id === activeClipId) ?? clips[0] ?? null,
    [clips, activeClipId],
  );
  const activeAsset = useMemo(
    () => project?.assets?.find((asset) => asset.id === activeClip?.assetId) ?? project?.assets?.[0] ?? null,
    [activeClip?.assetId, project?.assets],
  );
  const activeMetadata = getClipMetadata(activeClip);
  const activeReviewStatus = activeClip ? getReviewStatus(activeClip) : "needs_review";
  const activeQualitySignals = activeClip?.viralityFactors?.qualitySignals;
  const activePortraitPlan = activeClip?.viralityFactors?.reframePlans?.find(
    (plan) => plan.ratio === "9:16",
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
          <h2 className="text-xl font-bold">Edit & Enhance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Refine clips via transcript editing — remove segments to auto-trim.
          </p>
        </div>
        <GlassCard
          title="No clips detected yet"
          description="Run auto-detect highlights on the Ingest page to generate clips."
        >
          <Link
            href={`/repurpose?projectId=${project.id}`}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-muted/40 hover:bg-muted/60 text-sm font-medium transition-colors text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Ingest & Detect
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
        const body = await response.json().catch(() => null);
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
      selected.map((clip) =>
        fetch(`/api/clips/${clip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            captionStyle: style,
            expectedVersion: clip.version,
          }),
          cache: "no-store",
        }),
      ),
    );
    toast({
      title: "Caption style applied",
      description: `Updated ${selected.length} selected clip${selected.length === 1 ? "" : "s"}.`,
    });
    await invalidate();
  }

  async function applyLayoutToSelected(layoutConfig: ClipLayoutConfig) {
    const selected = clips.filter((clip) => selectedClipIds.includes(clip.id));
    if (selected.length === 0) return;
    const results = await Promise.all(
      selected.map(async (clip) => {
        const response = await fetch(`/api/clips/${clip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layoutPreset: layoutConfig.preset,
            aspectRatio: layoutConfig.aspectRatio,
            layoutConfig,
            expectedVersion: clip.version,
          }),
          cache: "no-store",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Failed to apply layout");
        }
        return response;
      }),
    );
    toast({
      title: "Layout applied",
      description: `Updated ${results.length} selected clip${results.length === 1 ? "" : "s"}.`,
    });
    await invalidate();
  }

  async function handleGenerateCaptions(clipId: string) {
    setCaptionLoading(clipId);
    try {
      const res = await fetch("/api/repurpose/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Captions generated", description: "Transcript ready for editing." });
      await invalidate();
    } catch {
      toast({ variant: "destructive", title: "Could not generate captions" });
    } finally {
      setCaptionLoading(undefined);
    }
  }

  async function handleDeleteClip() {
    if (!deleteClipId) return;
    try {
      const res = await fetch(`/api/clips/${deleteClipId}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Clip deleted" });
      if (activeClipId === deleteClipId) setActiveClipId(null);
      setSelectedClipIds(selectedClipIds.filter((id) => id !== deleteClipId));
      await invalidate();
    } catch {
      toast({ variant: "destructive", title: "Failed to delete clip" });
    } finally {
      setDeleteClipId(null);
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
        const body = await rtRes.json().catch(() => null);
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400/75">
            AI clip review queue
          </p>
          <h2 className="mt-1 text-2xl font-bold">Edit & Enhance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Preview clips, inspect confidence signals, edit transcript timing, and approve
            export-ready shorts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {clips.length > 1 && (
            <button
              onClick={() =>
                setSelectedClipIds(
                  selectedClipIds.length === visibleClips.length
                    ? []
                    : visibleClips.map((c) => c.id),
                )
              }
              className="px-4 py-2 rounded-lg border border-border/50 bg-muted/40 hover:bg-muted/60 text-sm font-medium transition-colors text-foreground"
            >
              {selectedClipIds.length === visibleClips.length
                ? "Deselect all"
                : `Select visible (${visibleClips.length})`}
            </button>
          )}
          {selectedClipIds.length > 0 && (
            <Link
              href={`/repurpose/export?projectId=${project.id}`}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors shadow-sm shadow-primary/20"
            >
              Export {selectedClipIds.length} clip{selectedClipIds.length > 1 ? "s" : ""}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-card/50 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", ...REVIEW_STATUSES] as ReviewTab[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setReviewTab(status)}
              className={cn(
                "h-9 rounded-lg border px-3 text-xs font-semibold capitalize transition-colors",
                reviewTab === status
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {status === "all" ? "All" : status.replace(/_/g, " ")}
              <span className="ml-1.5 text-[10px] opacity-60">{reviewCounts[status]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => batchSetReviewStatus("approved")}
            disabled={selectedClipIds.length === 0}
            className="h-9 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-40"
          >
            Approve selected
          </button>
          <button
            type="button"
            onClick={() => batchSetReviewStatus("rejected")}
            disabled={selectedClipIds.length === 0}
            className="h-9 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-40"
          >
            Reject selected
          </button>
          <button
            type="button"
            onClick={() => batchSetReviewStatus("export_ready")}
            disabled={selectedClipIds.length === 0}
            className="h-9 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/15 disabled:opacity-40"
          >
            Mark export ready
          </button>
          <button
            type="button"
            onClick={() => setSelectedClipIds([])}
            disabled={selectedClipIds.length === 0}
            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Clear selection
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-card/50 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/55">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground"
          >
            <option value="score">Sort by virality</option>
            <option value="confidence">Sort by boundary confidence</option>
            <option value="duration">Sort by duration</option>
            <option value="candidateType">Sort by candidate type</option>
            <option value="createdAt">Sort by created date</option>
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
          <select
            value={precisionFilter}
            onChange={(event) => setPrecisionFilter(event.target.value as PrecisionFilter)}
            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground"
          >
            <option value="all">All precision</option>
            <option value="word">Word-level timing</option>
            <option value="segment">Segment-level timing</option>
            <option value="low">Low precision</option>
          </select>
          <button
            type="button"
            onClick={() => setHideLowConfidence((value) => !value)}
            className={cn(
              "h-9 rounded-lg border px-3 text-xs font-semibold transition-colors",
              hideLowConfidence
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            Hide low confidence
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {REVIEW_STATUSES.map((status) => (
            <ReviewStatusBadge key={status} status={status} />
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── Clip sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5 mb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Clips
            </p>
            <span className="text-xs text-muted-foreground/50">
              {selectedClipIds.length}/{clips.length} selected
            </span>
          </div>

          <div className="max-h-[calc(100vh-260px)] space-y-1.5 overflow-y-auto rounded-2xl border border-border/40 bg-card/30 p-2">
            {visibleClips.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 p-6 text-center">
                <Scissors className="mx-auto mb-2 h-6 w-6 text-muted-foreground/25" />
                <p className="text-sm font-semibold text-foreground">
                  No clips match these filters
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Clear filters, switch review tabs, or return to Ingest to regenerate clips with a
                  different preset.
                </p>
              </div>
            ) : (
              visibleClips.map((clip, index) => {
                const isActive = activeClip?.id === clip.id;
                const isSelected = selectedClipIds.includes(clip.id);
                const duration = clip.endMs - clip.startMs;
                const quality = getCaptionQuality(clip.captionSrt);
                const metadata = getClipMetadata(clip);
                const reviewStatus = getReviewStatus(clip);
                const isUpdating = Boolean(statusUpdating[clip.id]);

                return (
                  <div
                    key={clip.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveClipId(clip.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveClipId(clip.id);
                      }
                    }}
                    className={cn(
                      "group w-full text-left rounded-xl border overflow-hidden transition-all",
                      isActive
                        ? "border-primary/40 shadow-sm"
                        : "border-border/40 hover:border-border",
                    )}
                  >
                    {/* ── Thumbnail ─────────────────────────────────────────── */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                      {clip.thumbnail ? (
                        <Image
                          src={clip.thumbnail}
                          alt={clip.title || `Clip ${index + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Film className="h-8 w-8 text-muted-foreground/20" />
                        </div>
                      )}

                      {/* Active glow overlay */}
                      {isActive && (
                        <div className="absolute inset-0 bg-primary/15 pointer-events-none" />
                      )}

                      {/* Viral score — top right */}
                      <div className="absolute right-1.5 top-1.5">
                        <ViralityScoreBadge score={clip.viralityScore} />
                      </div>

                      {/* Duration — bottom left */}
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono font-semibold text-white/80">
                        {formatDuration(duration)}
                      </div>

                      {/* Select checkbox — top left */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleClip(clip.id);
                        }}
                        className={cn(
                          "absolute top-1.5 left-1.5 h-5 w-5 rounded flex items-center justify-center transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-black/50 text-white/0 group-hover:text-white/70 hover:bg-white/20 hover:text-white",
                        )}
                        title={isSelected ? "Deselect clip" : "Select for export"}
                      >
                        {isSelected ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <CheckSquare className="h-3 w-3" />
                        )}
                      </button>
                    </div>

                    {/* ── Card body ─────────────────────────────────────────── */}
                    <div
                      className={cn(
                        "px-3 py-2.5 transition-colors",
                        isActive ? "bg-primary/10" : "bg-transparent group-hover:bg-muted/30",
                      )}
                    >
                      {/* Title + delete */}
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-[13px] font-medium truncate leading-snug flex-1">
                          {clip.title || `Clip ${index + 1}`}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteClipId(clip.id);
                          }}
                          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/20 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 mt-0.5"
                          title="Delete clip"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Caption status */}
                      <div className="mt-1.5">
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                          <BoundaryConfidenceBadge confidence={metadata.boundaryConfidence} />
                          <ReviewStatusBadge status={reviewStatus} />
                          <ClipTypeBadge type={metadata.candidateType} />
                        </div>
                        {clip.summary && (
                          <p className="mb-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground/65">
                            {clip.summary}
                          </p>
                        )}
                        {metadata.viralReason && (
                          <p className="mb-2 line-clamp-2 text-[10px] leading-4 text-muted-foreground/45">
                            {metadata.viralReason}
                          </p>
                        )}
                        {clip.captionSrt && quality.tier === "transcript_ready" ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400">
                            <FileText className="h-2.5 w-2.5" /> Transcript ready
                          </span>
                        ) : clip.captionSrt && quality.tier === "needs_cleanup" ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-400">
                            <AlertTriangle className="h-2.5 w-2.5" /> Needs cleanup
                          </span>
                        ) : clip.captionSrt ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-orange-400">
                            <AlertTriangle className="h-2.5 w-2.5" /> Low quality
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateCaptions(clip.id);
                            }}
                            disabled={captionLoading === clip.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed border-border/50 text-[9px] font-medium text-muted-foreground/50 hover:text-foreground hover:border-border transition-colors"
                          >
                            {captionLoading === clip.id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Type className="h-2.5 w-2.5" />
                            )}
                            Generate captions
                          </button>
                        )}
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewStatus(clip.id, "approved");
                            }}
                            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-1 text-[9px] font-semibold text-emerald-300 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewStatus(clip.id, "rejected");
                            }}
                            className="rounded-md border border-red-500/20 bg-red-500/10 px-1.5 py-1 text-[9px] font-semibold text-red-300 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewStatus(clip.id, "export_ready");
                            }}
                            className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-1 text-[9px] font-semibold text-cyan-300 disabled:opacity-50"
                          >
                            Export
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Active clip editor ───────────────────────────────────────────── */}
        <div>
          {activeClip ? (
            <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
              {/* Clip meta bar */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/40">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold truncate">
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
                    <BoundaryConfidenceBadge confidence={activeMetadata.boundaryConfidence} />
                    <TranscriptPrecisionBadge precision={activeMetadata.boundaryPrecision} />
                    <ClipTypeBadge type={activeMetadata.candidateType} />
                    <ReviewStatusBadge status={activeReviewStatus} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => setReviewStatus(activeClip.id, "approved")}
                    disabled={Boolean(statusUpdating[activeClip.id])}
                    className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setReviewStatus(activeClip.id, "rejected")}
                    disabled={Boolean(statusUpdating[activeClip.id])}
                    className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setReviewStatus(activeClip.id, "export_ready")}
                    disabled={Boolean(statusUpdating[activeClip.id])}
                    className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/15"
                  >
                    Export ready
                  </button>
                  <button
                    onClick={() => toggleClip(activeClip.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                      selectedClipIds.includes(activeClip.id)
                        ? "bg-primary text-primary-foreground"
                        : "border border-border/50 bg-muted/40 text-foreground hover:bg-muted/60",
                    )}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {selectedClipIds.includes(activeClip.id) ? "Export ready" : "Select for export"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 border-b border-border/40 px-5 py-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                    Why this clip was selected
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {activeMetadata.viralReason ||
                      activeClip.viralityFactors?.reasoning ||
                      "Selected by deterministic transcript quality, hook density, pacing, and OpenRouter ranking."}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                    Platform fit
                  </p>
                  <PlatformFitChips platformFit={activeMetadata.platformFit} />
                </div>
              </div>

              <div className="grid gap-3 border-b border-border/40 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-xl border border-border/50 bg-muted/25 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                    Quality breakdown
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                      <div
                        key={label}
                        className="rounded-lg border border-border/40 bg-background/35 p-2.5"
                      >
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
                <div className="space-y-3">
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
                  <QualityList
                    title="Editing notes"
                    items={activeMetadata.editingNotes}
                    fallback="No editing notes were returned by the reranker."
                  />
                </div>
              </div>

              {(activeQualitySignals || activePortraitPlan) && (
                <div className="grid gap-3 border-b border-border/40 px-5 py-4 md:grid-cols-3">
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/55">
                      <Waves className="h-3.5 w-3.5 text-cyan-400" />
                      Clip Quality
                    </div>
                    <p className="mt-2 text-lg font-semibold">
                      {activeQualitySignals
                        ? `${activeQualitySignals.overallScore}/100`
                        : "Pending"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {activeQualitySignals
                        ? `${activeQualitySignals.contentDensity} pacing · ${activeQualitySignals.wordsPerMinute} WPM`
                        : "Quality signals will appear after clip analysis."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/55">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      Cut Risk
                    </div>
                    <p className="mt-2 text-lg font-semibold capitalize">
                      {activeQualitySignals?.hardCutRisk ?? "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {activeQualitySignals
                        ? `Scene alignment ${activeQualitySignals.sceneAlignment}/100 · Cut cleanliness ${activeQualitySignals.cutCleanliness}/100`
                        : "Boundary alignment is unavailable for this clip."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/55">
                      <Crop className="h-3.5 w-3.5 text-primary" />
                      9:16 Reframe
                    </div>
                    <p className="mt-2 text-lg font-semibold">
                      {activePortraitPlan
                        ? activePortraitPlan.mode.replace("_", " ")
                        : "Source-first"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {activePortraitPlan?.reasoning ??
                        "Reframe guidance appears when source geometry is available."}
                    </p>
                  </div>
                </div>
              )}

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

              {/* ── Tabbed editor area ────────────────────────────────────── */}
              <Tabs defaultValue="transcript" className="w-full">
                <div className="border-b border-border/40 px-5 pt-4">
                  <TabsList className="h-8 w-auto gap-0 rounded-none border-0 bg-transparent p-0">
                    <TabsTrigger
                      value="transcript"
                      className="h-8 rounded-none border-b-2 border-transparent px-4 text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60 data-[state=inactive]:hover:text-muted-foreground"
                    >
                      Transcript
                    </TabsTrigger>
                    <TabsTrigger
                      value="framing"
                      className="h-8 rounded-none border-b-2 border-transparent px-4 text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60 data-[state=inactive]:hover:text-muted-foreground"
                    >
                      Framing
                    </TabsTrigger>
                    <TabsTrigger
                      value="enhance"
                      className="h-8 rounded-none border-b-2 border-transparent px-4 text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60 data-[state=inactive]:hover:text-muted-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        Enhance
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="export"
                      className="h-8 rounded-none border-b-2 border-transparent px-4 text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60 data-[state=inactive]:hover:text-muted-foreground"
                    >
                      Export
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Transcript tab */}
                <TabsContent value="transcript" className="m-0 p-5">
                  <TranscriptEditor
                    clipId={activeClip.id}
                    clipTitle={activeClip.title}
                    captionSrt={activeClip.captionSrt}
                    captionStyle={activeClip.captionStyle}
                    expectedVersion={activeClip.version}
                    startMs={activeClip.startMs}
                    endMs={activeClip.endMs}
                    previewPath={activeClip.previewPath}
                    projectId={project.id}
                    assetId={activeClip.assetId}
                    assetTranscript={activeAsset?.transcript ?? null}
                    selectedClipCount={selectedClipIds.length}
                    onApplyCaptionStyleToSelected={applyCaptionStyleToSelected}
                    smartReframePlan={
                      (activeClip.viralityFactors?.metadata?.smartReframe as
                        | import("@/lib/media/smart-reframe").SmartReframePlan
                        | undefined) ?? null
                    }
                    onSave={invalidate}
                    onGenerateCaptions={() => handleGenerateCaptions(activeClip.id)}
                    isGenerating={captionLoading === activeClip.id}
                  />
                </TabsContent>

                {/* Framing tab */}
                <TabsContent value="framing" className="m-0 p-5">
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
                      (activeClip.viralityFactors?.metadata?.layoutConfig as ClipLayoutConfig | undefined) ?? null
                    }
                    selectedClipCount={selectedClipIds.length}
                    onApplyLayoutToSelected={applyLayoutToSelected}
                    onAnalysisComplete={invalidate}
                  />
                </TabsContent>

                {/* Creative enhancement tab */}
                <TabsContent value="enhance" className="m-0 p-5">
                  <div className="space-y-4">
                    <BrandTemplateApplyPanel
                      projectId={project.id}
                      activeClipId={activeClip.id}
                      selectedClipIds={selectedClipIds}
                      onApplied={invalidate}
                    />
                    <CreativeEnhancementsPanel
                      clipId={activeClip.id}
                      clipDurationMs={activeClip.endMs - activeClip.startMs}
                      title={activeClip.title}
                      summary={activeClip.summary}
                      onChanged={invalidate}
                    />
                  </div>
                </TabsContent>

                {/* Export tab */}
                <TabsContent value="export" className="m-0 p-5 space-y-4">
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

              {/* AI summary — always visible below the tabs */}
              {activeClip.summary && (
                <div className="border-t border-border/40 px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                    AI Summary
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
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteClipId !== null}
        onOpenChange={(open) => !open && setDeleteClipId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this clip?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The clip and its captions will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClip}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete clip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
