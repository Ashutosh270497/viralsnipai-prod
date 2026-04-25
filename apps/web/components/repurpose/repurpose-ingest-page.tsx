"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Flame,
  Link as LinkIcon,
  Loader2,
  Music,
  Pencil,
  Sparkles,
  Upload as UploadIcon,
  Youtube,
  Zap,
} from "lucide-react";

import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { AIPromptGeneratorDialog } from "@/components/repurpose/ai-prompt-generator-dialog";
import { useRepurpose } from "@/components/repurpose/repurpose-context";
import { Button } from "@/components/ui/button";
import { AppCard, EmptyState, PageHeader, Stepper } from "@/components/product-ui/primitives";
import { cn, formatDuration } from "@/lib/utils";
import { useRepurposeIngest } from "@/components/repurpose/use-repurpose-ingest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { HIGHLIGHT_MODEL_OPTIONS } from "@/lib/constants/repurpose";

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
  } = useRepurpose();

  const {
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
  } = useRepurposeIngest({
    projectId,
    primaryAssetId: primaryAsset?.id,
    onProjectRefresh: invalidate,
  });

  const clipCount = project?.clips?.length ?? 0;
  const activeStep = clipCount > 0 ? 1 : primaryAsset ? 0 : 0;
  const appliedSeedRef = useRef<string | null>(null);
  const seededIdea = useMemo(() => {
    const ideaId = searchParams.get("ideaId");
    if (!ideaId) return null;

    return {
      source: searchParams.get("source"),
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

  // ── Detection progress state ───────────────────────────────────────────────
  const [detectionPhase, setDetectionPhase] = useState(0);

  useEffect(() => {
    if (!seededIdea || !projectId) {
      return;
    }

    const seedKey = `${projectId}:${seededIdea.ideaId}`;
    if (appliedSeedRef.current === seedKey) {
      return;
    }

    const briefParts = [
      seededIdea.title ? `Turn "${seededIdea.title}" into short-form clips.` : null,
      seededIdea.description ? seededIdea.description : null,
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

  async function handleAutoHighlightsWithProgress() {
    setDetectionPhase(0);
    await handleAutoHighlights();
    setDetectionPhase(0);
  }

  return (
    <div className="w-full space-y-6 pb-10 animate-enter">
      <PageHeader
        eyebrow="Create Clip"
        title="Upload, detect, edit, export"
        description="A guided V1 workspace for turning long-form recordings into branded short clips."
        icon={Sparkles}
        actions={
          <div className="min-w-[240px]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
            Active Project
          </p>
          {projects.length > 0 ? (
            <Select value={projectId || undefined} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 rounded-lg border-border/50 text-sm">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground/60 py-2">
              No projects yet —{" "}
              <Link href="/dashboard" className="text-primary hover:underline">create one</Link>
            </p>
          )}
          </div>
        }
      />

      <Stepper
        activeIndex={activeStep}
        steps={[
          { label: "Upload & Detect", icon: UploadIcon },
          { label: "Edit & Enhance", icon: Pencil },
          { label: "Export", icon: Download },
        ]}
      />

      {/* ── Seeded idea banner ────────────────────────────────────────────────── */}
      {seededIdea ? (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                Seeded from Content Calendar
              </p>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {seededIdea.title || "Repurpose-ready idea"}
                </p>
                <p className="max-w-3xl text-sm text-muted-foreground/70">
                  Upload or fetch the source video next. RepurposeOS will use the seeded idea context to guide
                  highlight detection and clip selection.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground/60">
                {seededIdea.niche ? (
                  <span className="rounded-full border border-border/50 bg-muted/50 px-2.5 py-1">
                    Audience: {seededIdea.niche}
                  </span>
                ) : null}
                {seededIdea.keywords.slice(0, 3).map((keyword) => (
                  <span key={keyword} className="rounded-full border border-border/50 bg-muted/50 px-2.5 py-1">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href={`/dashboard/content-calendar?ideaId=${seededIdea.ideaId}`}
              className="text-sm font-medium text-primary/70 transition-colors hover:text-primary"
            >
              ← Back to idea
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── No project selected ─────────────────────────────────────────────── */}
      {!isProjectSelected ? (
        <EmptyState
          icon={Sparkles}
          title="Start by creating or selecting a project"
          description="Choose an existing project from the selector above, or create a fresh project to upload a source video and generate clips."
          primary={{ label: "Create project", href: "/projects" }}
          secondary={{ label: "Select existing project", href: "/projects" }}
        />
      ) : (
        <div className="space-y-6">
          {/* ── Main 2-column grid ──────────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">

            {/* ── LEFT: Source panel ─────────────────────────────────────────── */}
            <AppCard className="space-y-5 p-6">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Youtube className="h-4 w-4 text-red-400" />
                  <h2 className="text-sm font-semibold">Source Video</h2>
                </div>
                <p className="text-xs text-muted-foreground/50">
                  Paste a YouTube link or upload a local file
                </p>
              </div>

              {/* YouTube URL + Fetch inline */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Youtube className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 pointer-events-none" />
                  <input
                    type="text"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/50 bg-background/60 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors text-sm"
                  />
                </div>
                <Button
                  variant="glow"
                  size="sm"
                  onClick={handleIngestYouTube}
                  disabled={youtubeProgress.isActive || !sourceUrl.trim()}
                  className="shrink-0 h-[42px] px-4"
                >
                  {youtubeProgress.isActive
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <LinkIcon className="h-4 w-4" />}
                  <span className="ml-1.5">
                    {youtubeProgress.isActive ? (youtubeProgress.phase ?? "Fetching…") : "Fetch"}
                  </span>
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[11px] text-muted-foreground/40 font-medium">or upload a file</span>
                <div className="flex-1 h-px bg-border/40" />
              </div>

              <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">Formats: MP4, MOV, WebM</div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">Max size: configured by plan</div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">Typical processing: 2-5 min</div>
              </div>

              {/* Upload dropzone */}
              <UploadDropzone
                projectId={projectId}
                onUpload={async (file) => {
                  const formData = new FormData();
                  formData.append("projectId", projectId);
                  formData.append("file", file);
                  const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                    cache: "no-store",
                  });
                  if (!res.ok) throw new Error("Upload failed");
                  const data = await res.json();
                  toast({
                    title: "Upload complete",
                    description: `${data.asset?.type ?? "Asset"} ready for repurposing.`,
                  });
                  await invalidate();
                }}
                description="Drop high-quality video or audio files"
              />

              {/* Asset status */}
              {primaryAsset ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm font-semibold text-emerald-400 capitalize">
                      {primaryAsset.type}
                    </span>
                    <span className="text-xs text-muted-foreground/50">
                      · {formatDuration((primaryAsset.durationSec ?? 0) * 1000)}
                    </span>
                  </div>
                  {primaryAsset.transcript ? (
                    <div className="h-28 overflow-y-auto rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground/60 leading-relaxed">
                      {primaryAsset.transcript}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/40">
                      No transcript yet — will generate during detection.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/30 text-xs text-muted-foreground/30">
                  No asset loaded yet
                </div>
              )}
            </AppCard>

            {/* ── RIGHT: AI Detection config ─────────────────────────────────── */}
            <AppCard className="flex flex-col gap-5 p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Sparkles className="h-4 w-4 text-primary/70" />
                    <h2 className="text-sm font-semibold">AI Detection</h2>
                  </div>
                  <p className="text-xs text-muted-foreground/50">
                    Guide the AI to find the best moments
                  </p>
                </div>
                <AIPromptGeneratorDialog
                  transcript={primaryAsset?.transcript}
                  videoTitle={project?.title}
                  onPromptsGenerated={(prompts) => {
                    setHighlightBrief(prompts.brief);
                    setHighlightAudience(prompts.audience);
                    setHighlightTone(prompts.tone);
                    setHighlightCallToAction(prompts.callToAction);
                  }}
                />
              </div>

              {/* Model selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Detection Model
                </label>
                <Select value={highlightModel} onValueChange={setHighlightModel}>
                  <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/60 text-sm">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {HIGHLIGHT_MODEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Highlight brief */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Highlight Brief
                </label>
                <textarea
                  value={highlightBrief}
                  onChange={(e) => setHighlightBrief(e.target.value)}
                  placeholder="What core message should clips amplify?"
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border/50 bg-background/60 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors resize-none text-sm"
                />
              </div>

              {/* Audience / Tone / CTA */}
              <div className="space-y-3">
                {[
                  { label: "Audience", value: highlightAudience, set: setHighlightAudience, placeholder: "Growth-focused creators" },
                  { label: "Tone", value: highlightTone, set: setHighlightTone, placeholder: "Tension → payoff, high energy" },
                  { label: "Desired Action", value: highlightCallToAction, set: setHighlightCallToAction, placeholder: "Drive viewers to subscribe" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                      {f.label}
                    </label>
                    <input
                      type="text"
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border/50 bg-background/60 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Separator + CTA */}
              <div className="mt-auto">
                <div className="h-px bg-border/30 mb-5" />
                {highlightProgress.isActive ? (
                  <DetectionProgressCard phase={detectionPhase} onPhaseChange={setDetectionPhase} />
                ) : (
                  <Button
                    variant="glow"
                    className="w-full"
                    onClick={handleAutoHighlightsWithProgress}
                    disabled={!primaryAsset}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Auto-detect Highlights
                  </Button>
                )}
              </div>
            </AppCard>
          </div>

          {/* ── Detected Highlights grid ─────────────────────────────────────── */}
          {clipCount > 0 && project && (
            <div>
              {/* Section header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-semibold">Detected Highlights</h2>
                  <p className="text-xs text-muted-foreground/50 mt-0.5">
                    {clipCount} clip{clipCount !== 1 ? "s" : ""} · ready to edit
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <Link href={`/repurpose/export?projectId=${projectId}`}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Export All
                    </Link>
                  </Button>
                  <Button
                    variant="glow"
                    size="sm"
                    asChild
                  >
                    <Link href={`/repurpose/editor?projectId=${projectId}`}>
                      Continue to Edit
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Thumbnail card grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {project.clips.map((clip, index) => {
                  const duration = clip.endMs - clip.startMs;
                  const score = clip.viralityScore ?? null;
                  return (
                    <div
                      key={clip.id}
                      className="group rounded-xl border border-border/40 overflow-hidden hover:border-border/70 transition-all bg-card"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-black/40">
                        {clip.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Sparkles className="h-6 w-6 text-white/10" />
                          </div>
                        )}

                        {/* Viral score badge */}
                        {score !== null && (
                          <div className={cn(
                            "absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full backdrop-blur-sm text-[9px] font-bold text-white",
                            score >= 80 ? "bg-emerald-500/85" : score >= 60 ? "bg-amber-500/85" : "bg-orange-500/85"
                          )}>
                            <Flame className="h-2 w-2" />
                            {score}
                          </div>
                        )}

                        {/* Duration */}
                        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono font-semibold text-white/80">
                          {formatDuration(duration)}
                        </div>

                        {/* Hover overlay — actions */}
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                          <Link
                            href={`/repurpose/editor?projectId=${projectId}`}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors backdrop-blur-sm"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Link>
                          <Link
                            href={`/repurpose/export?projectId=${projectId}`}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/80 hover:bg-primary text-white text-xs font-medium transition-colors backdrop-blur-sm"
                          >
                            <Download className="h-3 w-3" />
                            Export
                          </Link>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="px-3 py-2.5">
                        <p className="text-[13px] font-medium truncate text-foreground/90">
                          {clip.title || `Clip ${index + 1}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detection Progress Card ───────────────────────────────────────────────────

const DETECTION_PHASES = [
  {
    label: "Connecting to source",
    sublabel: "Validating YouTube URL and media availability",
    Icon: LinkIcon,
    delayMs: 0,
  },
  {
    label: "Downloading audio track",
    sublabel: "Extracting audio for transcription",
    Icon: Music,
    delayMs: 1500,
  },
  {
    label: "Transcribing speech",
    sublabel: "Converting audio to timestamped transcript",
    Icon: FileText,
    delayMs: 7500,
  },
  {
    label: "Analyzing viral patterns",
    sublabel: "Scoring segments for engagement potential",
    Icon: Sparkles,
    delayMs: 37500,
  },
] as const;

function DetectionProgressCard({
  phase,
  onPhaseChange,
}: {
  phase: number;
  onPhaseChange: (p: number) => void;
}) {
  useEffect(() => {
    const timers = DETECTION_PHASES.slice(1).map((p, i) =>
      setTimeout(() => onPhaseChange(i + 1), p.delayMs)
    );
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)" }}
        >
          <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
        </div>
        <p className="text-sm font-semibold text-primary/80">Detecting highlights…</p>
      </div>

      <div className="space-y-3">
        {DETECTION_PHASES.map(({ label, sublabel, Icon }, idx) => {
          const isDone   = idx < phase;
          const isActive = idx === phase;

          return (
            <div key={idx} className="flex items-start gap-3">
              {/* Icon circle */}
              <div
                className={cn(
                  "shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-all",
                  isDone
                    ? "bg-emerald-500"
                    : isActive
                    ? "bg-primary"
                    : "bg-muted"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                ) : isActive ? (
                  <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/30" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isDone
                      ? "text-emerald-400"
                      : isActive
                      ? "text-foreground"
                      : "text-muted-foreground/30"
                  )}
                >
                  {label}
                </p>
                {(isDone || isActive) && (
                  <p className="text-xs text-muted-foreground/50 mt-0.5">{sublabel}</p>
                )}
              </div>

              {/* Status chip */}
              {isDone && (
                <span className="shrink-0 text-[10px] font-semibold text-emerald-400 mt-0.5">Done</span>
              )}
              {isActive && (
                <span className="shrink-0 text-[10px] font-semibold text-primary/70 mt-0.5 animate-pulse">
                  Running…
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
