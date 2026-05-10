"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  HelpCircle,
  Download,
  Eye,
  FileText,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Play,
  Search,
  Sparkles,
  UploadCloud,
  X,
  Youtube,
} from "lucide-react";

import { AIPromptGeneratorDialog } from "@/components/repurpose/ai-prompt-generator-dialog";
import { SafeThumbnailImage } from "@/components/repurpose/safe-thumbnail-image";
import { SourceQualityNotice } from "@/components/repurpose/source-quality-notice";
import { useRepurpose } from "@/components/repurpose/repurpose-context";
import { V1UsageLimitsCard } from "@/components/repurpose/v1-usage-limits-card";
import type { AutoHighlightsAnalytics } from "@/components/repurpose/quality-indicators";
import { getClipMetadata, QualityDiagnosticsPanel } from "@/components/repurpose/quality-indicators";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/product-ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useRepurposeIngest } from "@/components/repurpose/use-repurpose-ingest";
import { CLIP_INTENT_OPTIONS, QUALITY_MODE_OPTIONS } from "@/lib/ai/model-routing-options";
import { HIGHLIGHT_MODEL_OPTIONS } from "@/lib/constants/repurpose";
import { cn, formatDuration } from "@/lib/utils";

type WizardStage = "source" | "goals" | "generate" | "review" | "export";
type GeneratedPromptSet = {
  brief: string;
  audience: string;
  tone: string;
  callToAction: string;
};

const STAGES: Array<{ id: WizardStage; label: string; helper: string }> = [
  { id: "source", label: "Source", helper: "Add video" },
  { id: "goals", label: "Goals", helper: "Set outcome" },
  { id: "generate", label: "Generate", helper: "Create clips" },
  { id: "review", label: "Review", helper: "Choose winners" },
  { id: "export", label: "Export", helper: "Ship clips" },
];

const TARGET_PLATFORM_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

export function RepurposeIngestPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const {
    projects,
    projectId,
    setProjectId,
    project,
    primaryAsset,
    isProjectSelected,
    invalidate,
    selectedClipIds,
    setSelectedClipIds,
  } = useRepurpose();

  const ingest = useRepurposeIngest({
    projectId,
    primaryAssetId: primaryAsset?.id,
    onProjectRefresh: invalidate,
  });

  const {
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
  } = ingest;

  const [stage, setStage] = useState<WizardStage>("source");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewSort, setReviewSort] = useState("best");
  const clipCount = project?.clips?.length ?? 0;
  const approvedCount = project?.clips?.filter((clip) =>
    clip.reviewStatus === "approved" || clip.reviewStatus === "export_ready"
  ).length ?? 0;
  const transcriptPreview = useMemo(
    () => parseTranscriptPreview(primaryAsset?.transcript),
    [primaryAsset?.transcript],
  );
  const transcriptPrecision =
    lastHighlightAnalytics?.transcriptPrecision ??
    getClipMetadata(project?.clips?.[0]).boundaryPrecision ??
    transcriptPreview.precision;
  const modelDebugEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_MODEL_DEBUG === "true";
  const isEmptySourceState = stage === "source" && !primaryAsset;

  const appliedSeedRef = useRef<string | null>(null);
  const seededIdea = useMemo(() => {
    const ideaId = searchParams.get("ideaId");
    if (!ideaId) return null;
    return {
      ideaId,
      title: searchParams.get("ideaTitle") ?? "",
      niche: searchParams.get("ideaNiche") ?? "",
      description: searchParams.get("ideaDescription") ?? "",
      keywords: (searchParams.get("ideaKeywords") ?? "")
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    };
  }, [searchParams]);

  useEffect(() => {
    if (!seededIdea || !projectId) return;
    const seedKey = `${projectId}:${seededIdea.ideaId}`;
    if (appliedSeedRef.current === seedKey) return;
    const briefParts = [
      seededIdea.title ? `Turn "${seededIdea.title}" into short-form clips.` : null,
      seededIdea.description || null,
      seededIdea.keywords.length ? `Lean into ${seededIdea.keywords.slice(0, 4).join(", ")}.` : null,
    ].filter(Boolean);
    setHighlightBrief(briefParts.join(" "));
    setHighlightAudience(seededIdea.niche || "Growth-focused creators");
    setHighlightTone("Insight-led, scroll-stopping, fast payoff");
    setHighlightCallToAction("Drive profile visits, saves, and qualified clicks.");
    appliedSeedRef.current = seedKey;
  }, [
    projectId,
    seededIdea,
    setHighlightAudience,
    setHighlightBrief,
    setHighlightCallToAction,
    setHighlightTone,
  ]);

  useEffect(() => {
    if (highlightProgress.isActive) {
      setStage("generate");
    }
  }, [highlightProgress.isActive]);

  async function generateClips() {
    setStage("generate");
    const ok = await handleAutoHighlights();
    if (ok) setStage("review");
  }

  async function uploadSource(file: File) {
    const maxBytes = 500 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error("File exceeds 500 MB upload limit.");
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error?.message ?? payload?.message ?? "Upload failed");
    }
    const data = await res.json();
    toast({
      title: "Source ready",
      description: `${data.asset?.type ?? "Asset"} uploaded and ready for clipping.`,
    });
    await invalidate();
  }

  async function updateReviewStatus(clipId: string, reviewStatus: string) {
    const response = await fetch(`/api/clips/${clipId}/review-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus }),
    });
    if (!response.ok) {
      toast({ variant: "destructive", title: "Could not update clip status" });
      return;
    }
    await invalidate();
  }

  if (!isProjectSelected) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Start by selecting a project"
        description="Choose a project first. ViralSnipAI keeps your source video, generated clips, edits, captions, and exports together."
        primary={{ label: "View projects", href: "/projects" }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      <CreateClipHeader
        projects={projects}
        projectId={projectId}
        setProjectId={setProjectId}
        projectTitle={project?.title ?? "Untitled project"}
        status={resolveUserStatus({
          hasSource: Boolean(primaryAsset),
          generating: highlightProgress.isActive,
          clipCount,
          approvedCount,
        })}
      />

      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Create clips from your video
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Upload a video or paste a YouTube link. ViralSnipAI will find the best moments automatically.
        </p>
      </div>

      <ClipCreationStageNav
        stage={stage}
        setStage={setStage}
        hasSource={Boolean(primaryAsset)}
        hasClips={clipCount > 0}
        hasApproved={approvedCount > 0}
      />

      {seededIdea ? (
        <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
                Seeded from Content Calendar
              </p>
              <p className="mt-1 text-sm font-semibold">{seededIdea.title || "Repurpose-ready idea"}</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground/70">
                This context has been applied to your clip goals. You can edit it in the Goals stage.
              </p>
            </div>
            <Link href={`/dashboard/content-calendar?ideaId=${seededIdea.ideaId}`} className="text-sm font-medium text-primary">
              Back to idea
            </Link>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-5 lg:items-start",
          isEmptySourceState
            ? "lg:grid-cols-[minmax(0,1fr)_280px]"
            : "lg:grid-cols-[minmax(0,1fr)_340px]",
        )}
      >
        <div className="min-w-0">
          {stage === "source" ? (
            <SourceStage
              sourceUrl={sourceUrl}
              setSourceUrl={setSourceUrl}
              handleIngestYouTube={handleIngestYouTube}
              youtubeProgress={youtubeProgress}
              projectId={projectId}
              uploadSource={uploadSource}
              primaryAsset={primaryAsset}
              transcriptPreview={transcriptPreview}
              transcriptPrecision={transcriptPrecision}
              onNext={() => setStage("goals")}
            />
          ) : null}

          {stage === "goals" ? (
            <GoalsStage
              qualityMode={qualityMode}
              setQualityMode={setQualityMode}
              clipIntent={clipIntent}
              setClipIntent={setClipIntent}
              targetPlatform={targetPlatform}
              setTargetPlatform={setTargetPlatform}
              targetClipCount={targetClipCount}
              setTargetClipCount={setTargetClipCount}
              clipLengthPreset={clipLengthPreset}
              setClipLengthPreset={setClipLengthPreset}
              highlightBrief={highlightBrief}
              setHighlightBrief={setHighlightBrief}
              highlightAudience={highlightAudience}
              setHighlightAudience={setHighlightAudience}
              highlightTone={highlightTone}
              setHighlightTone={setHighlightTone}
              highlightCallToAction={highlightCallToAction}
              setHighlightCallToAction={setHighlightCallToAction}
              primaryAssetTranscript={primaryAsset?.transcript}
              primaryAssetDurationSec={primaryAsset?.durationSec ?? null}
              transcriptPrecision={transcriptPrecision}
              projectTitle={project?.title}
              onPromptsGenerated={(prompts: GeneratedPromptSet) => {
                setHighlightBrief(prompts.brief);
                setHighlightAudience(prompts.audience);
                setHighlightTone(prompts.tone);
                setHighlightCallToAction(prompts.callToAction);
              }}
              onBack={() => setStage("source")}
              onNext={() => setStage("generate")}
            />
          ) : null}

          {stage === "generate" ? (
            <GenerateStage
              canGenerate={Boolean(primaryAsset)}
              isGenerating={highlightProgress.isActive}
              progress={highlightProgress.progress}
              generateClips={generateClips}
              onBack={() => setStage("goals")}
              onReview={() => setStage("review")}
              clipCount={clipCount}
            />
          ) : null}

          {stage === "review" && project ? (
            <ReviewStage
              clips={project.clips}
              projectId={projectId}
              selectedClipIds={selectedClipIds}
              setSelectedClipIds={setSelectedClipIds}
              reviewFilter={reviewFilter}
              setReviewFilter={setReviewFilter}
              reviewSort={reviewSort}
              setReviewSort={setReviewSort}
              updateReviewStatus={updateReviewStatus}
              onBack={() => setStage("generate")}
              onExport={() => setStage("export")}
            />
          ) : null}

          {stage === "export" && project ? (
            <ExportStageEntry
              clips={project.clips}
              projectId={projectId}
              selectedClipIds={selectedClipIds}
              setSelectedClipIds={setSelectedClipIds}
              onBack={() => setStage("review")}
            />
          ) : null}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          {isEmptySourceState ? (
            <>
              <BestResultsCard />
              <AdvancedDetailsPanel
                hasSource={false}
                assetType={undefined}
                durationSec={undefined}
                clipCount={clipCount}
                approvedCount={approvedCount}
                exportCount={project?.exports?.length ?? 0}
                selectedCount={selectedClipIds.length}
                analytics={lastHighlightAnalytics}
                transcriptPreview={transcriptPreview}
                transcriptPrecision={transcriptPrecision}
                modelDebugEnabled={modelDebugEnabled}
                debugModelOverride={debugModelOverride}
                setDebugModelOverride={setDebugModelOverride}
              />
            </>
          ) : stage === "goals" ? (
            <>
              <ProjectSummaryCard
                hasSource={Boolean(primaryAsset)}
                assetType={primaryAsset?.type}
                durationSec={primaryAsset?.durationSec}
                clipCount={clipCount}
                approvedCount={approvedCount}
                exportCount={project?.exports?.length ?? 0}
                selectedCount={selectedClipIds.length}
                compact
              />
              <AdvancedDetailsPanel
                hasSource={Boolean(primaryAsset)}
                assetType={primaryAsset?.type}
                durationSec={primaryAsset?.durationSec}
                clipCount={clipCount}
                approvedCount={approvedCount}
                exportCount={project?.exports?.length ?? 0}
                selectedCount={selectedClipIds.length}
                analytics={lastHighlightAnalytics}
                transcriptPreview={transcriptPreview}
                transcriptPrecision={transcriptPrecision}
                modelDebugEnabled={modelDebugEnabled}
                debugModelOverride={debugModelOverride}
                setDebugModelOverride={setDebugModelOverride}
                showProjectSummary={false}
              />
            </>
          ) : (
            <>
              <ProjectSummaryCard
                hasSource={Boolean(primaryAsset)}
                assetType={primaryAsset?.type}
                durationSec={primaryAsset?.durationSec}
                clipCount={clipCount}
                approvedCount={approvedCount}
                exportCount={project?.exports?.length ?? 0}
                selectedCount={selectedClipIds.length}
              />
              <TechnicalDetailsDrawer
                analytics={lastHighlightAnalytics}
                transcriptPreview={transcriptPreview}
                transcriptPrecision={transcriptPrecision}
                modelDebugEnabled={modelDebugEnabled}
                debugModelOverride={debugModelOverride}
                setDebugModelOverride={setDebugModelOverride}
              />
              <details className="rounded-2xl border border-border/50 bg-card/55 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Plan usage</summary>
                <div className="mt-3">
                  <V1UsageLimitsCard />
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateClipHeader({
  projects,
  projectId,
  setProjectId,
  projectTitle,
  status,
}: {
  projects: Array<{ id: string; title: string }>;
  projectId: string;
  setProjectId: (id: string) => void;
  projectTitle: string;
  status: string;
}) {
  const navItems = [
    { label: "Create", href: `/repurpose?projectId=${projectId}`, active: true, disabled: false },
    { label: "Editor", href: `/repurpose/editor?projectId=${projectId}`, active: false, disabled: false },
    { label: "Export", href: `/repurpose/export?projectId=${projectId}`, active: false, disabled: false },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{projectTitle}</p>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {status}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <nav className="flex w-full rounded-xl border border-border/50 bg-background/50 p-1 sm:w-auto">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition sm:flex-none",
                  item.active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Select value={projectId || undefined} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 min-w-[210px] rounded-xl text-sm">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function ClipCreationStageNav({
  stage,
  setStage,
  hasSource,
  hasClips,
  hasApproved,
}: {
  stage: WizardStage;
  setStage: (stage: WizardStage) => void;
  hasSource: boolean;
  hasClips: boolean;
  hasApproved: boolean;
}) {
  const currentIndex = STAGES.findIndex((item) => item.id === stage);
  function disabled(id: WizardStage) {
    if (id === "goals" || id === "generate") return !hasSource;
    if (id === "review") return !hasClips;
    if (id === "export") return !hasApproved;
    return false;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/45 bg-card/45 p-1.5">
      <div className="flex min-w-max items-center gap-1.5">
        {STAGES.map((item, index) => {
          const active = item.id === stage;
          const complete = index < currentIndex;
          const isDisabled = disabled(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => setStage(item.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-left transition",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                isDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
              )}
            >
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                active ? "bg-white/20" : complete ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
              )}>
                {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="block text-sm font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SourceStage({
  sourceUrl,
  setSourceUrl,
  handleIngestYouTube,
  youtubeProgress,
  projectId,
  uploadSource,
  primaryAsset,
  transcriptPreview,
  transcriptPrecision,
  onNext,
}: {
  sourceUrl: string;
  setSourceUrl: (value: string) => void;
  handleIngestYouTube: () => Promise<void>;
  youtubeProgress: { isActive: boolean; phase: string };
  projectId: string;
  uploadSource: (file: File) => Promise<void>;
  primaryAsset: any;
  transcriptPreview: TranscriptPreview;
  transcriptPrecision: string;
  onNext: () => void;
}) {
  const [isReplacingSource, setIsReplacingSource] = useState(false);
  const hasSource = Boolean(primaryAsset);
  const showInputOptions = !hasSource || isReplacingSource;
  const sourceName = getAssetDisplayName(primaryAsset);

  return (
    <StageShell
      eyebrow={hasSource && !isReplacingSource ? "Source ready" : "Stage 1"}
      title={hasSource && !isReplacingSource ? "Source added" : "Add your source"}
      description={
        hasSource && !isReplacingSource
          ? "Your video is ready. Continue to goals when you are ready to choose the clips you want."
          : "Start with a video, podcast, webinar, tutorial, interview, or YouTube link."
      }
    >
      {showInputOptions ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border/60 bg-background/60 p-5 shadow-sm transition hover:border-red-400/30 hover:bg-background/75">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-red-500/10 p-3 text-red-400">
                <Youtube className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold">Paste YouTube link</h3>
                <p className="mt-1 text-xs text-muted-foreground/70">Paste a public YouTube URL.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <LinkIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="h-12 w-full rounded-2xl border border-border/55 bg-background/80 pl-10 pr-3 text-sm outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <Button onClick={handleIngestYouTube} disabled={youtubeProgress.isActive || !sourceUrl.trim()} className="h-12 rounded-2xl px-5">
                {youtubeProgress.isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-1.5">{youtubeProgress.isActive ? youtubeProgress.phase || "Importing" : "Import"}</span>
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-primary/25 bg-primary/[0.045] p-5 shadow-sm shadow-primary/5 transition hover:border-primary/40 hover:bg-primary/[0.06]">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                <UploadCloud className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold">Upload video</h3>
                <p className="mt-1 text-xs text-muted-foreground/70">Upload MP4, MOV, WebM, MP3, WAV, or M4A.</p>
              </div>
            </div>
            <div className="mt-5">
              <UploadDropzone
                projectId={projectId}
                onUpload={uploadSource}
                maxSizeMb={500}
                recommendedDurationMinutes={60}
                description="Upload videos up to 500 MB"
                formatHints={["MP4", "MOV", "WebM", "MP3", "WAV", "M4A"]}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.045] p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-background/60 text-emerald-400">
                {primaryAsset?.type === "audio" ? <FileText className="h-7 w-7" /> : <Play className="h-7 w-7" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Source added
                  </span>
                  <span className="text-xs capitalize text-muted-foreground">{primaryAsset?.type}</span>
                </div>
                <h3 className="mt-3 truncate text-lg font-semibold">{sourceName}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {primaryAsset?.durationSec
                    ? formatDuration(primaryAsset.durationSec * 1000)
                    : "Duration is being analyzed"}
                  {primaryAsset?.sourceWidth && primaryAsset?.sourceHeight
                    ? ` · ${primaryAsset.sourceWidth}x${primaryAsset.sourceHeight}`
                    : ""}
                </p>
                {transcriptPrecision !== "word" && transcriptPrecision !== "none" ? (
                  <PrecisionNotice />
                ) : null}
                <SourceQualityNotice
                  sourceWidth={primaryAsset?.sourceWidth}
                  sourceHeight={primaryAsset?.sourceHeight}
                  compact
                  className="mt-3"
                />
                {primaryAsset?.transcript ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                      Transcript preview
                    </summary>
                    <p className="mt-2 rounded-xl border border-border/50 bg-background/60 p-3 text-xs leading-5 text-muted-foreground/70">
                      {transcriptPreview.text}
                    </p>
                  </details>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
              <Button onClick={onNext} size="lg">
                Continue to Goals
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setIsReplacingSource(true)}>
                Replace source
              </Button>
            </div>
          </div>
        </div>
      )}

      {showInputOptions ? (
        <div className="sticky bottom-3 z-20 mt-6 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-2xl shadow-black/10 backdrop-blur md:static md:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {hasSource
                ? "Import or upload a replacement, or continue with the current source."
                : "Add a YouTube link or upload a file to continue."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {hasSource ? (
                <Button variant="outline" onClick={() => setIsReplacingSource(false)}>
                  Cancel
                </Button>
              ) : null}
              <Button onClick={onNext} disabled={!hasSource}>
                Continue to Goals
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </StageShell>
  );
}

function GoalsStage({
  qualityMode,
  setQualityMode,
  clipIntent,
  setClipIntent,
  targetPlatform,
  setTargetPlatform,
  targetClipCount,
  setTargetClipCount,
  clipLengthPreset,
  setClipLengthPreset,
  highlightBrief,
  setHighlightBrief,
  highlightAudience,
  setHighlightAudience,
  highlightTone,
  setHighlightTone,
  highlightCallToAction,
  setHighlightCallToAction,
  primaryAssetTranscript,
  primaryAssetDurationSec,
  transcriptPrecision,
  projectTitle,
  onPromptsGenerated,
  onBack,
  onNext,
}: any) {
  const lengthOptions = [
    { value: "short", title: "Short", body: "18-30s" },
    { value: "balanced", title: "Balanced", body: "30-45s", badge: "Recommended" },
    { value: "detailed", title: "Detailed", body: "45-58s" },
  ];
  const clipCountOptions = [3, 5, 8];

  return (
    <StageShell
      eyebrow="Stage 2"
      title="Choose your clip goals"
      description="Pick the type and length of clips you want. ViralSnipAI handles the AI routing automatically."
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Clip length</h3>
            <p className="mt-1 text-xs text-muted-foreground/65">Choose how much context each short clip should include.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {lengthOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setClipLengthPreset(option.value)}
                className={cn(
                  "min-h-[104px] rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm",
                  clipLengthPreset === option.value
                    ? "border-primary/55 bg-primary/10 shadow-sm shadow-primary/5"
                    : "border-border/60 bg-background/55 hover:border-border/90",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{option.title}</span>
                  {option.badge ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                      {option.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">{option.body}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Clip type</h3>
            <p className="mt-1 text-xs text-muted-foreground/65">Pick the kind of moments you want to surface.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {CLIP_INTENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setClipIntent(option.value)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm",
                  clipIntent === option.value
                    ? "border-primary/55 bg-primary/10 text-primary shadow-sm shadow-primary/5"
                    : "border-border/60 bg-background/55 text-foreground/85 hover:border-border/90",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Number of clips</h3>
            <p className="mt-1 text-xs text-muted-foreground/65">Start small for fast review, or generate a larger batch.</p>
          </div>
          <div className="inline-grid w-full gap-2 rounded-2xl border border-border/60 bg-background/55 p-1.5 sm:w-auto sm:grid-cols-3">
            {clipCountOptions.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setTargetClipCount(count)}
                className={cn(
                  "rounded-xl px-5 py-2.5 text-sm font-semibold transition",
                  targetClipCount === count
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {count} clips
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-violet-500/20 bg-violet-500/[0.045] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                <HelpCircle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Not sure what to choose?</h3>
                <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground/70">
                  Let ViralSnipAI analyze your transcript and suggest audience, tone, CTA, and brief.
                </p>
              </div>
            </div>
            <AIPromptGeneratorDialog
              transcript={primaryAssetTranscript}
              videoTitle={projectTitle}
              qualityMode={qualityMode}
              clipIntent={clipIntent}
              transcriptPrecision={transcriptPrecision}
              videoDurationSec={primaryAssetDurationSec}
              onPromptsGenerated={onPromptsGenerated}
              triggerLabel="Suggest goals"
              triggerClassName="h-10 shrink-0 rounded-xl border-violet-500/25 bg-violet-500/10 px-4 text-violet-200 hover:bg-violet-500/15"
            />
          </div>
        </section>

        <details className="rounded-3xl border border-border/55 bg-background/45 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Advanced goals</summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="AI quality">
                <Select value={qualityMode} onValueChange={setQualityMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALITY_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground/60">
                  {QUALITY_MODE_OPTIONS.find((option) => option.value === qualityMode)?.description}
                </p>
              </Field>
              <Field label="Target platform">
                <Select value={targetPlatform} onValueChange={setTargetPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_PLATFORM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <p className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04] px-3 py-2 text-xs leading-5 text-cyan-50/70">
              ViralSnipAI automatically chooses the best AI route. You control the outcome, not the model.
            </p>
            <TextareaField label="Audience" value={highlightAudience} onChange={setHighlightAudience} rows={2} />
            <TextareaField label="Tone" value={highlightTone} onChange={setHighlightTone} rows={2} />
            <TextareaField label="Desired action" value={highlightCallToAction} onChange={setHighlightCallToAction} rows={2} />
            <Field label="Optional brief">
              <textarea
                value={highlightBrief}
                onChange={(event) => setHighlightBrief(event.target.value)}
                placeholder="What should the best clips emphasize?"
                rows={5}
                className="w-full resize-y rounded-xl border border-border/55 bg-background/70 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary/45"
              />
            </Field>
          </div>
        </details>
      </div>
      <StageActions>
        <Button variant="outline" onClick={onBack}><ChevronLeft className="mr-1.5 h-4 w-4" />Back</Button>
        <div className="sticky bottom-3 z-20 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-2xl shadow-black/10 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <p className="mb-2 text-xs text-muted-foreground sm:text-right">
            Next: ViralSnipAI will find and prepare your clips.
          </p>
          <Button onClick={onNext} size="lg" className="w-full sm:w-auto">
            Continue to Generate<ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </StageActions>
    </StageShell>
  );
}

function GenerateStage({
  canGenerate,
  isGenerating,
  progress,
  generateClips,
  onBack,
  onReview,
  clipCount,
}: {
  canGenerate: boolean;
  isGenerating: boolean;
  progress: number;
  generateClips: () => Promise<void>;
  onBack: () => void;
  onReview: () => void;
  clipCount: number;
}) {
  return (
    <StageShell
      eyebrow="Stage 3"
      title="Generate clips"
      description="One click starts the full clipping workflow. Long videos can take a few minutes."
    >
      <div className="mx-auto max-w-2xl rounded-3xl border border-border/60 bg-background/55 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {isGenerating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
        </div>
        <h3 className="mt-4 text-lg font-semibold">
          {isGenerating ? "Creating your clips" : clipCount > 0 ? "Clips are ready" : "Ready to generate"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground/70">
          {isGenerating
            ? "This can take a few minutes for long videos."
            : "ViralSnipAI will find strong moments, rank clips, and create previews."}
        </p>
        <SimpleProcessingTimeline progress={progress} active={isGenerating} complete={clipCount > 0 && !isGenerating} />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onBack} disabled={isGenerating}>
            <ChevronLeft className="mr-1.5 h-4 w-4" />Back to goals
          </Button>
          {clipCount > 0 && !isGenerating ? (
            <Button onClick={onReview}>Review clips<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          ) : (
            <Button onClick={generateClips} disabled={!canGenerate || isGenerating} className="min-w-[180px]">
              {isGenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              Generate Clips
            </Button>
          )}
        </div>
      </div>
    </StageShell>
  );
}

function ReviewStage({
  clips,
  projectId,
  selectedClipIds,
  setSelectedClipIds,
  reviewFilter,
  setReviewFilter,
  reviewSort,
  setReviewSort,
  updateReviewStatus,
  onBack,
  onExport,
}: any) {
  const filtered = clips
    .filter((clip: any) => reviewFilter === "all" || (clip.reviewStatus ?? "needs_review") === reviewFilter)
    .slice()
    .sort((a: any, b: any) => {
      if (reviewSort === "shortest") return (a.endMs - a.startMs) - (b.endMs - b.startMs);
      if (reviewSort === "longest") return (b.endMs - b.startMs) - (a.endMs - a.startMs);
      if (reviewSort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b.viralityScore ?? 0) - (a.viralityScore ?? 0);
    });
  const canExport = clips.some((clip: any) => clip.reviewStatus === "approved" || clip.reviewStatus === "export_ready");

  return (
    <StageShell
      eyebrow="Stage 4"
      title="Review generated clips"
      description="Choose the clips worth keeping. Details stay available without crowding every card."
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["needs_review", "Needs Review"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["export_ready", "Export Ready"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setReviewFilter(value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                reviewFilter === value ? "border-primary/35 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Select value={reviewSort} onValueChange={setReviewSort}>
          <SelectTrigger className="h-9 w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="best">Best first</SelectItem>
            <SelectItem value="shortest">Shortest</SelectItem>
            <SelectItem value="longest">Longest</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/25" />
          <p className="mt-3 text-sm font-semibold">No clips match this view</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Change the filter or generate clips again.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((clip: any, index: number) => (
            <CleanClipResultCard
              key={clip.id}
              clip={clip}
              index={index}
              projectId={projectId}
              selected={selectedClipIds.includes(clip.id)}
              toggleSelected={() =>
                setSelectedClipIds(
                  selectedClipIds.includes(clip.id)
                    ? selectedClipIds.filter((id: string) => id !== clip.id)
                    : [...selectedClipIds, clip.id],
                )
              }
              updateReviewStatus={updateReviewStatus}
            />
          ))}
        </div>
      )}
      <StageActions>
        <Button variant="outline" onClick={onBack}><ChevronLeft className="mr-1.5 h-4 w-4" />Back</Button>
        <Button onClick={onExport} disabled={!canExport}>
          Continue to export<ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </StageActions>
    </StageShell>
  );
}

function CleanClipResultCard({
  clip,
  index,
  projectId,
  selected,
  toggleSelected,
  updateReviewStatus,
}: any) {
  const duration = clip.endMs - clip.startMs;
  const score = clip.viralityScore ?? null;
  const metadata = getClipMetadata(clip);
  const summary = clip.summary || transcriptSnippet(clip.captionSrt) || "Generated clip ready for review.";
  const status = clip.reviewStatus ?? "needs_review";
  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm">
      <div className="grid gap-0 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="relative bg-black/50">
          {clip.previewPath ? (
            <video src={clip.previewPath} className="aspect-video h-full w-full object-cover md:aspect-auto" muted loop playsInline preload="metadata" />
          ) : clip.thumbnail ? (
            <SafeThumbnailImage src={clip.thumbnail} alt={clip.title || `Clip ${index + 1}`} className="h-full min-h-[160px]" />
          ) : (
            <div className="flex aspect-video h-full items-center justify-center"><Sparkles className="h-7 w-7 text-white/15" /></div>
          )}
          {score !== null ? (
            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
              {score} score
            </span>
          ) : null}
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{clip.title || `Clip ${index + 1}`}</h3>
                <ReviewStatusBadge status={status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDuration(duration)} · {formatDuration(clip.startMs)} to {formatDuration(clip.endMs)}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleSelected}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                selected ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground",
              )}
            >
              {selected ? "Selected" : "Select"}
            </button>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground/75">{summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {score !== null ? <CompactBadge>{score >= 80 ? "High potential" : "Good candidate"}</CompactBadge> : null}
            <CompactBadge>{metadata.candidateType ? formatLabel(metadata.candidateType) : "AI clip"}</CompactBadge>
            <CompactBadge>{metadata.boundaryConfidence ? `${formatLabel(metadata.boundaryConfidence)} confidence` : "Review timing"}</CompactBadge>
          </div>
          <details className="mt-3 rounded-xl border border-border/50 bg-muted/20 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Why this clip?</summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground/70">
              {scoreExplanation(clip.viralityFactors) || "Selected by hook strength, pacing, transcript quality, and clean boundaries."}
            </p>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            {clip.previewPath ? (
              <a href={clip.previewPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold">
                <Eye className="h-3.5 w-3.5" />Preview
              </a>
            ) : null}
            <Button size="sm" variant="outline" asChild><Link href={`/repurpose/editor?projectId=${projectId}`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Link></Button>
            <Button size="sm" variant="outline" onClick={() => updateReviewStatus(clip.id, "approved")}><Check className="mr-1.5 h-3.5 w-3.5" />Approve</Button>
            <Button size="sm" variant="outline" onClick={() => updateReviewStatus(clip.id, "rejected")}><X className="mr-1.5 h-3.5 w-3.5" />Reject</Button>
            <Button size="sm" onClick={() => updateReviewStatus(clip.id, "export_ready")}><Download className="mr-1.5 h-3.5 w-3.5" />Export ready</Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ExportStageEntry({ clips, projectId, selectedClipIds, setSelectedClipIds, onBack }: any) {
  const exportable = clips.filter((clip: any) => clip.reviewStatus === "approved" || clip.reviewStatus === "export_ready");
  const selectedExportable = selectedClipIds.filter((id: string) => exportable.some((clip: any) => clip.id === id));
  const effectiveSelection = selectedExportable.length > 0 ? selectedExportable : exportable.map((clip: any) => clip.id);
  return (
    <StageShell
      eyebrow="Stage 5"
      title="Export approved clips"
      description="Use the quick entry here, or open the full Export Center for jobs, downloads, captions, and platform presets."
    >
      <div className="rounded-2xl border border-border/60 bg-background/50 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Approved / ready" value={exportable.length} />
          <Metric label="Selected" value={effectiveSelection.length} />
          <Metric label="Default format" value="9:16" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field label="Platform preset">
            <Select defaultValue="youtube_shorts">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_PLATFORM_OPTIONS.filter((option) => option.value !== "auto").map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aspect ratio">
            <Select defaultValue="9:16">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16 vertical</SelectItem>
                <SelectItem value="1:1">1:1 square</SelectItem>
                <SelectItem value="16:9">16:9 landscape</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Captions">
            <Select defaultValue="on">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on">Captions on</SelectItem>
                <SelectItem value="off">Captions off</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {exportable.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {exportable.slice(0, 8).map((clip: any) => (
              <button
                key={clip.id}
                type="button"
                onClick={() =>
                  setSelectedClipIds(
                    selectedClipIds.includes(clip.id)
                      ? selectedClipIds.filter((id: string) => id !== clip.id)
                      : [...selectedClipIds, clip.id],
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  effectiveSelection.includes(clip.id)
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground",
                )}
              >
                {clip.title || "Clip"}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-200">
            Approve at least one clip before exporting.
          </p>
        )}
      </div>
      <StageActions>
        <Button variant="outline" onClick={onBack}><ChevronLeft className="mr-1.5 h-4 w-4" />Back to review</Button>
        <Button disabled={exportable.length === 0} asChild>
          <Link href={`/repurpose/export?projectId=${projectId}`}>
            Open Export Center<ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </StageActions>
    </StageShell>
  );
}

function ProjectSummaryCard({
  hasSource,
  assetType,
  durationSec,
  clipCount,
  approvedCount,
  exportCount,
  selectedCount,
  compact = false,
}: {
  hasSource: boolean;
  assetType?: string;
  durationSec?: number | null;
  clipCount: number;
  approvedCount: number;
  exportCount: number;
  selectedCount: number;
  compact?: boolean;
}) {
  return (
    <aside className="rounded-2xl border border-border/50 bg-card/70 p-4">
      <p className="text-sm font-semibold">Project Summary</p>
      <div className="mt-4 space-y-3">
        <SummaryRow label="Source" value={hasSource ? "Ready" : "Missing"} good={hasSource} />
        {hasSource && !compact ? (
          <SummaryRow
            label="Media"
            value={`${assetType ?? "source"} · ${durationSec ? formatDuration(durationSec * 1000) : "duration pending"}`}
          />
        ) : null}
        <SummaryRow label="Generated clips" value={String(clipCount)} />
        {!compact ? (
          <>
            <SummaryRow label="Approved" value={String(approvedCount)} good={approvedCount > 0} />
            <SummaryRow label="Selected" value={String(selectedCount)} />
          </>
        ) : null}
        <SummaryRow label="Exports" value={String(exportCount)} />
      </div>
    </aside>
  );
}

function BestResultsCard() {
  const tips = [
    "Use 1080p or higher source",
    "Clear speech works best",
    "Landscape videos can become Shorts/Reels",
  ];
  return (
    <aside className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.045] p-4">
      <p className="text-sm font-semibold text-cyan-100">Best results</p>
      <ul className="mt-3 space-y-2">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-xs leading-5 text-cyan-50/70">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function AdvancedDetailsPanel({
  hasSource,
  assetType,
  durationSec,
  clipCount,
  approvedCount,
  exportCount,
  selectedCount,
  analytics,
  transcriptPreview,
  transcriptPrecision,
  modelDebugEnabled,
  debugModelOverride,
  setDebugModelOverride,
  showProjectSummary = true,
}: {
  hasSource: boolean;
  assetType?: string;
  durationSec?: number | null;
  clipCount: number;
  approvedCount: number;
  exportCount: number;
  selectedCount: number;
  analytics: AutoHighlightsAnalytics | null;
  transcriptPreview: TranscriptPreview;
  transcriptPrecision: string;
  modelDebugEnabled: boolean;
  debugModelOverride: string;
  setDebugModelOverride: (value: string) => void;
  showProjectSummary?: boolean;
}) {
  return (
    <details className="rounded-2xl border border-border/50 bg-card/55 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Advanced details</summary>
      <div className="mt-4 space-y-4">
        {showProjectSummary ? (
          <ProjectSummaryCard
            hasSource={hasSource}
            assetType={assetType}
            durationSec={durationSec}
            clipCount={clipCount}
            approvedCount={approvedCount}
            exportCount={exportCount}
            selectedCount={selectedCount}
          />
        ) : null}
        <TechnicalDetailsDrawer
          analytics={analytics}
          transcriptPreview={transcriptPreview}
          transcriptPrecision={transcriptPrecision}
          modelDebugEnabled={modelDebugEnabled}
          debugModelOverride={debugModelOverride}
          setDebugModelOverride={setDebugModelOverride}
        />
        <details className="rounded-2xl border border-border/50 bg-card/55 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Plan usage</summary>
          <div className="mt-3">
            <V1UsageLimitsCard />
          </div>
        </details>
      </div>
    </details>
  );
}

function TechnicalDetailsDrawer({
  analytics,
  transcriptPreview,
  transcriptPrecision,
  modelDebugEnabled,
  debugModelOverride,
  setDebugModelOverride,
}: {
  analytics: AutoHighlightsAnalytics | null;
  transcriptPreview: TranscriptPreview;
  transcriptPrecision: string;
  modelDebugEnabled: boolean;
  debugModelOverride: string;
  setDebugModelOverride: (value: string) => void;
}) {
  return (
    <details className="rounded-2xl border border-border/50 bg-card/55 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Technical details</summary>
      <div className="mt-4 space-y-3 text-xs text-muted-foreground/70">
        <SummaryRow label="Transcript" value={formatPrecisionForUser(transcriptPrecision)} />
        <SummaryRow label="Preview text" value={transcriptPreview.text ? "Available" : "Not available"} />
        {analytics ? (
          <>
            <SummaryRow label="Candidates found" value={String(analytics.candidatesGenerated ?? 0)} />
            <SummaryRow label="Clips created" value={String(analytics.clipsCreated ?? 0)} />
            <SummaryRow label="Quality mode" value={String(analytics.qualityMode ?? "balanced")} />
            <SummaryRow label="Clip intent" value={formatLabel(String(analytics.clipIntent ?? "auto"))} />
            <SummaryRow label="Boundary confidence" value={formatBoundaryCounts(analytics.boundaryConfidenceCounts)} />
            {modelDebugEnabled ? (
              <>
                <SummaryRow label="Timing provider" value={analytics.providerTranscription ?? "openai"} />
                <SummaryRow label="Reasoning provider" value={analytics.providerReasoning ?? "openrouter"} />
                <SummaryRow label="Rerank model" value={analytics.selectedRerankModel ?? "auto"} />
                <SummaryRow label="Fallbacks" value={(analytics.rerankFallbackModels ?? []).join(", ") || "default"} />
                <QualityDiagnosticsPanel analytics={analytics} />
              </>
            ) : null}
          </>
        ) : (
          <p>No generation analytics yet.</p>
        )}
        {modelDebugEnabled ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
            <p className="font-semibold text-amber-200">Developer override</p>
            <p className="mt-1 text-[11px] leading-5 text-amber-100/70">
              Visible only in development/admin contexts. Normal users do not see raw model IDs.
            </p>
            <Select value={debugModelOverride || "auto"} onValueChange={(value) => setDebugModelOverride(value === "auto" ? "" : value)}>
              <SelectTrigger className="mt-3 h-9 border-amber-500/25 bg-background/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto model policy</SelectItem>
                {HIGHLIGHT_MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function StageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/55 bg-card/70 p-5 shadow-sm md:p-6">
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground/70">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StageActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">{children}</div>;
}

function SimpleProcessingTimeline({
  progress,
  active,
  complete,
}: {
  progress: number;
  active: boolean;
  complete: boolean;
}) {
  const steps = [
    ["Preparing video", 10],
    ["Understanding transcript", 35],
    ["Finding strong moments", 58],
    ["Ranking clips", 78],
    ["Creating previews", 95],
  ] as const;
  return (
    <div className="mt-6 space-y-3 text-left">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${complete ? 100 : progress}%` }} />
      </div>
      <div className="grid gap-2">
        {steps.map(([label, threshold]) => {
          const done = complete || progress >= threshold;
          const current = active && !done && progress < threshold;
          return (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border",
                done ? "border-emerald-500 bg-emerald-500 text-white" : current ? "border-primary text-primary" : "border-border text-muted-foreground",
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              </span>
              <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrecisionNotice() {
  return (
    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
      <p className="text-xs font-semibold text-amber-500">Lower timing precision</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Clips may need quick review. Improve timing later if you want tighter word-level boundaries.
      </p>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/55">{label}</span>
      {children}
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-border/55 bg-background/70 px-3 text-sm outline-none transition focus:border-primary/45"
      />
    </Field>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full resize-y rounded-xl border border-border/55 bg-background/70 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary/45"
      />
    </Field>
  );
}

function SummaryRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground/65">{label}</span>
      <span className={cn("max-w-[190px] truncate text-right font-semibold", good ? "text-emerald-500" : "text-foreground/80")}>
        {value}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function CompactBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border/55 bg-muted/25 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "export_ready"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
      : status === "rejected"
        ? "border-red-500/25 bg-red-500/10 text-red-500"
        : "border-amber-500/25 bg-amber-500/10 text-amber-500";
  return <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", tone)}>{formatLabel(status)}</span>;
}

type TranscriptPreview = {
  text: string;
  precision: string;
  language?: string | null;
  durationSec?: number | null;
};

function parseTranscriptPreview(transcript?: string | null): TranscriptPreview {
  if (!transcript) {
    return {
      text: "",
      precision: "none",
      language: null,
      durationSec: null,
    };
  }
  try {
    const parsed = JSON.parse(transcript);
    if (parsed && typeof parsed === "object") {
      const text =
        typeof parsed.text === "string" && parsed.text.trim()
          ? parsed.text.trim()
          : "Transcript available, but preview could not be displayed.";
      return {
        text: text.slice(0, 500),
        precision: typeof parsed.precision === "string" ? parsed.precision : "segment",
        language: typeof parsed.language === "string" ? parsed.language : null,
        durationSec:
          typeof parsed.durationSec === "number" && Number.isFinite(parsed.durationSec)
            ? parsed.durationSec
            : null,
      };
    }
    return {
      text: "Transcript available, but preview could not be displayed.",
      precision: "segment",
      language: null,
      durationSec: null,
    };
  } catch {
    return {
      text: transcript.trim().slice(0, 500) || "Transcript available, but preview could not be displayed.",
      precision: "approximate",
      language: null,
      durationSec: null,
    };
  }
}

function resolveUserStatus(params: {
  hasSource: boolean;
  generating: boolean;
  clipCount: number;
  approvedCount: number;
}) {
  if (params.generating) return "Generating";
  if (!params.hasSource) return "No video added yet";
  if (params.approvedCount > 0) return "Ready to export";
  if (params.clipCount > 0) return "Clips ready";
  return "Source ready";
}

function getAssetDisplayName(asset: any) {
  if (!asset) return "Source video";
  const candidate = asset.title ?? asset.name ?? asset.path ?? asset.storagePath ?? "";
  if (typeof candidate !== "string" || !candidate.trim()) return "Source video";
  const normalized = candidate.replace(/\\/g, "/");
  return normalized.split("/").pop() || "Source video";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPrecisionForUser(value: string) {
  if (value === "word") return "High timing precision";
  if (value === "none") return "Not available yet";
  return "Lower timing precision";
}

function formatBoundaryCounts(counts?: { high?: number; medium?: number; low?: number } | null) {
  if (!counts) return "Not available";
  return `High ${counts.high ?? 0}, medium ${counts.medium ?? 0}, low ${counts.low ?? 0}`;
}

function transcriptSnippet(captionSrt?: string | null) {
  if (!captionSrt) return "";
  return captionSrt
    .replace(/\d+\s*\n/g, " ")
    .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function scoreExplanation(viralityFactors: unknown) {
  if (!viralityFactors || typeof viralityFactors !== "object") return "";
  const factors = viralityFactors as { reasoning?: unknown; hookStrength?: unknown; emotionalPeak?: unknown; pacing?: unknown };
  if (typeof factors.reasoning === "string" && factors.reasoning.trim()) return factors.reasoning.trim();
  const parts = [
    typeof factors.hookStrength === "number" ? `Hook ${factors.hookStrength}/100` : null,
    typeof factors.emotionalPeak === "number" ? `emotion ${factors.emotionalPeak}/100` : null,
    typeof factors.pacing === "number" ? `pacing ${factors.pacing}/100` : null,
  ].filter(Boolean);
  return parts.length ? `Strongest signals: ${parts.join(", ")}.` : "";
}
