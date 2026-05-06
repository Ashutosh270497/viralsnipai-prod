"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Flame,
  Info,
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
import { SafeThumbnailImage } from "@/components/repurpose/safe-thumbnail-image";
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
import { CLIP_INTENT_OPTIONS, QUALITY_MODE_OPTIONS } from "@/lib/ai/model-routing-options";
import { V1UsageLimitsCard } from "@/components/repurpose/v1-usage-limits-card";
import {
  ProviderBadge,
  ProcessingStepTimeline,
  QualityDiagnosticsPanel,
  TranscriptPrecisionBadge,
  getClipMetadata,
} from "@/components/repurpose/quality-indicators";

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

  const {
    sourceUrl,
    setSourceUrl,
    youtubeProgress,
    highlightProgress,
    qualityMode,
    setQualityMode,
    clipIntent,
    setClipIntent,
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
  } = useRepurposeIngest({
    projectId,
    primaryAssetId: primaryAsset?.id,
    onProjectRefresh: invalidate,
  });

  const clipCount = project?.clips?.length ?? 0;
  const transcriptPreview = useMemo(() => parseTranscriptPreview(primaryAsset?.transcript), [primaryAsset?.transcript]);
  const transcriptPrecision = lastHighlightAnalytics?.transcriptPrecision ?? getClipMetadata(project?.clips?.[0]).boundaryPrecision ?? transcriptPreview.precision;
  const modelDebugEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_MODEL_DEBUG === "true";
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
        title="Turn long videos into viral-ready clips"
        description="Upload a podcast, webinar, tutorial, interview, or YouTube video. ViralSnipAI finds timestamped moments, ranks them, and prepares social-ready clips."
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

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl shadow-black/20">
        <div className="absolute inset-x-20 top-0 h-32 rounded-full bg-gradient-to-r from-emerald-400/20 via-cyan-400/15 to-violet-400/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <ProviderBadge provider="openai" label="OpenAI word timing" />
              <ProviderBadge provider="openrouter" label="OpenRouter ranking" />
              <TranscriptPrecisionBadge precision={transcriptPrecision} />
            </div>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
              Upload once. Review precise AI clips in minutes.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              The V1 pipeline keeps timestamps deterministic: OpenAI handles timing, OpenRouter ranks creative potential, and local boundary refinement keeps clips aligned to real speech and scene cuts.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="#source-input" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90">
                Upload video
              </a>
              <a href="#source-input" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                Paste YouTube link
              </a>
              <button
                type="button"
                onClick={handleAutoHighlightsWithProgress}
                disabled={!primaryAsset || highlightProgress.isActive}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-45"
              >
                Start AI clipping
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Project status</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ["Source", primaryAsset ? "Ready" : "Missing"],
                ["Clips", clipCount],
                ["Selected", selectedClipIds.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
                  <p className="mt-2 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100/85">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Very long videos are automatically chunked for transcription. Upload high-quality source files for best clip boundaries.
            </p>
          </div>
        </div>
      </div>

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
            <AppCard id="source-input" className="space-y-5 p-6">
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
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">Long videos: chunked safely</div>
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
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <TranscriptPrecisionBadge precision={transcriptPreview.precision} />
                        {transcriptPreview.language && (
                          <span className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground/50">
                            {transcriptPreview.language}
                          </span>
                        )}
                        {transcriptPreview.durationSec ? (
                          <span className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground/50">
                            {formatDuration(transcriptPreview.durationSec * 1000)}
                          </span>
                        ) : null}
                      </div>
                      {transcriptPreview.text}
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

            {/* ── RIGHT: AI Detection config + usage ─────────────────────────── */}
            <div className="space-y-5">
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

              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    AI Clipping Settings
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground/50">
                    ViralSnipAI automatically chooses the best AI model based on quality mode,
                    video length, transcript precision, and your plan.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Clipping Quality
                    </label>
                    <Select value={qualityMode} onValueChange={(value) => setQualityMode(value as typeof qualityMode)}>
                      <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/60 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALITY_MODE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground/45">
                      {QUALITY_MODE_OPTIONS.find((option) => option.value === qualityMode)?.description}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Clip Intent
                    </label>
                    <Select value={clipIntent} onValueChange={(value) => setClipIntent(value as typeof clipIntent)}>
                      <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/60 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIP_INTENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {modelDebugEnabled && (
                  <details className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-amber-200">
                      Developer override — not visible to normal users
                    </summary>
                    <div className="mt-3 space-y-2">
                      <Select value={debugModelOverride || "auto"} onValueChange={(value) => setDebugModelOverride(value === "auto" ? "" : value)}>
                        <SelectTrigger className="h-9 rounded-lg border-amber-500/25 bg-background/60 text-sm">
                          <SelectValue placeholder="Internal model override" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto model policy</SelectItem>
                          {HIGHLIGHT_MODEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] leading-5 text-amber-100/65">
                        Debug override bypasses automatic routing only in development/admin contexts.
                        Normal users never see raw OpenRouter model IDs.
                      </p>
                    </div>
                  </details>
                )}
              </div>

              {transcriptPrecision !== "word" && transcriptPrecision !== "none" && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
                  <p className="text-xs font-semibold text-amber-200">Lower precision transcript</p>
                  <p className="mt-1 text-[11px] leading-5 text-amber-100/70">
                    This source has segment-level timing. Word-level timing gives better clip boundaries.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8 border-amber-500/30 bg-amber-500/10 text-xs text-amber-100 hover:bg-amber-500/15"
                    onClick={() => toast({
                      title: "Re-transcription available",
                      description: "Use the retranscribe action from the project tools to rebuild word-level timing.",
                    })}
                  >
                    Re-transcribe for word-level precision
                  </Button>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Target clips
                  </label>
                  <Select value={String(targetClipCount)} onValueChange={(value) => setTargetClipCount(Number(value))}>
                    <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/60 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 4, 5, 6, 7, 8].map((count) => (
                        <SelectItem key={count} value={String(count)}>{count} clips</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Clip length
                  </label>
                  <Select value={clipLengthPreset} onValueChange={(value) => setClipLengthPreset(value as typeof clipLengthPreset)}>
                    <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/60 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short · 18-30s</SelectItem>
                      <SelectItem value="balanced">Balanced · 30-45s</SelectItem>
                      <SelectItem value="detailed">Detailed · 45-58s</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
            <V1UsageLimitsCard />
            </div>
          </div>

          <ProcessingStepTimeline active={highlightProgress.isActive} complete={Boolean(lastHighlightAnalytics || clipCount > 0)} />
          <QualityDiagnosticsPanel analytics={lastHighlightAnalytics} />

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

              {/* Clip result card grid */}
              <div className="grid gap-4 lg:grid-cols-2">
                {project.clips.map((clip, index) => {
                  const duration = clip.endMs - clip.startMs;
                  const score = clip.viralityScore ?? null;
                  const captionStatus = resolveCaptionStatus(clip.captionSrt);
                  const renderStatus = clip.previewPath ? "Preview ready" : "Preview pending";
                  const exportRecord = project.exports.find(
                    (exp) =>
                      isExportComplete(exp.status) &&
                      exp.outputPath &&
                      Array.isArray(exp.clipIds) &&
                      exp.clipIds.includes(clip.id)
                  );
                  return (
                    <div
                      key={clip.id}
                      className="group overflow-hidden rounded-2xl border border-border/50 bg-card/80 shadow-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-slate-950/5"
                    >
                      <div className="grid min-h-full gap-0 sm:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="relative aspect-video bg-black/50 sm:aspect-auto">
                          {clip.previewPath ? (
                            <video
                              src={clip.previewPath}
                              className="h-full w-full object-cover"
                              muted
                              loop
                              playsInline
                              preload="metadata"
                            />
                          ) : clip.thumbnail ? (
                            <SafeThumbnailImage
                              src={clip.thumbnail}
                              alt={clip.title || `Clip ${index + 1} thumbnail`}
                              className="absolute inset-0 aspect-auto"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Sparkles className="h-7 w-7 text-white/15" />
                            </div>
                          )}

                          <div className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
                            #{index + 1}
                          </div>

                          {score !== null && (
                            <div className={cn(
                              "absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm",
                              score >= 80 ? "bg-emerald-500/85" : score >= 60 ? "bg-amber-500/85" : "bg-orange-500/85"
                            )}>
                              <Flame className="h-3 w-3" />
                              {score}
                            </div>
                          )}

                          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 font-mono text-[10px] font-semibold text-white/80">
                            <Clock3 className="h-3 w-3" />
                            {formatDuration(duration)}
                          </div>
                        </div>

                        <div className="flex min-w-0 flex-col gap-3 p-4">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-foreground">
                                  {clip.title || `Clip ${index + 1}`}
                                </h3>
                                <p className="mt-1 font-mono text-[11px] text-muted-foreground/55">
                                  {formatDuration(clip.startMs)} → {formatDuration(clip.endMs)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedClipIds(
                                    selectedClipIds.includes(clip.id)
                                      ? selectedClipIds.filter((id) => id !== clip.id)
                                      : [...selectedClipIds, clip.id]
                                  )
                                }
                                className={cn(
                                  "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                                  selectedClipIds.includes(clip.id)
                                    ? "border-primary/40 bg-primary/15 text-primary"
                                    : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {selectedClipIds.includes(clip.id) ? "Selected" : "Select"}
                              </button>
                            </div>

                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground/70">
                              {clip.summary || transcriptSnippet(clip.captionSrt) || "Transcript snippet will appear after captions are generated."}
                            </p>
                          </div>

                          <div className="grid gap-2 text-[11px] sm:grid-cols-3">
                            <StatusPill label="Captions" value={captionStatus} tone={captionStatus === "Ready" ? "good" : "warn"} />
                            <StatusPill label="Render" value={renderStatus} tone={clip.previewPath ? "good" : "neutral"} />
                            <StatusPill label="Export" value={exportRecord ? "Ready" : "Not exported"} tone={exportRecord ? "good" : "neutral"} />
                          </div>

                          {score !== null && (
                            <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
                              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-foreground/80">Score explanation</span>
                                <span className="font-semibold text-muted-foreground/60">{score}/100</span>
                              </div>
                              <p className="line-clamp-2 text-xs leading-5 text-muted-foreground/65">
                                {scoreExplanation(clip.viralityFactors) || "Ranked by hook strength, pacing, emotional peak, transcript quality, and clip boundary quality."}
                              </p>
                            </div>
                          )}

                          <div className="mt-auto flex flex-wrap gap-2">
                            {clip.previewPath ? (
                              <a
                                href={clip.previewPath}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Preview
                              </a>
                            ) : null}
                            <Link
                              href={`/repurpose/editor?projectId=${projectId}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Link>
                            <Link
                              href={`/repurpose/export?projectId=${projectId}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Export
                            </Link>
                            {exportRecord?.outputPath ? (
                              <a
                                href={exportRecord.outputPath}
                                download
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/15"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </a>
                            ) : null}
                          </div>
                        </div>
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

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        tone === "good" && "border-emerald-500/20 bg-emerald-500/[0.06]",
        tone === "warn" && "border-amber-500/20 bg-amber-500/[0.06]",
        tone === "neutral" && "border-border/60 bg-muted/25"
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/45">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate font-semibold",
          tone === "good" && "text-emerald-500",
          tone === "warn" && "text-amber-500",
          tone === "neutral" && "text-muted-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function resolveCaptionStatus(captionSrt?: string | null) {
  if (!captionSrt?.trim()) {
    return "Missing";
  }
  if (captionSrt.includes("[Transcript unavailable]")) {
    return "Needs regen";
  }
  return "Ready";
}

function transcriptSnippet(captionSrt?: string | null) {
  if (!captionSrt) {
    return "";
  }
  return captionSrt
    .replace(/\d+\s*\n/g, " ")
    .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function scoreExplanation(viralityFactors: unknown) {
  if (!viralityFactors || typeof viralityFactors !== "object") {
    return "";
  }
  const factors = viralityFactors as {
    reasoning?: unknown;
    improvements?: unknown;
    hookStrength?: unknown;
    emotionalPeak?: unknown;
    pacing?: unknown;
  };
  if (typeof factors.reasoning === "string" && factors.reasoning.trim()) {
    return factors.reasoning.trim();
  }
  const parts = [
    typeof factors.hookStrength === "number" ? `Hook ${factors.hookStrength}/100` : null,
    typeof factors.emotionalPeak === "number" ? `emotion ${factors.emotionalPeak}/100` : null,
    typeof factors.pacing === "number" ? `pacing ${factors.pacing}/100` : null,
  ].filter(Boolean);
  return parts.length ? `Strongest signals: ${parts.join(", ")}.` : "";
}

function isExportComplete(status: string) {
  return status === "done" || status === "completed";
}

function parseTranscriptPreview(transcript?: string | null): {
  text: string;
  precision: string;
  language?: string | null;
  durationSec?: number | null;
} {
  if (!transcript) {
    return {
      text: "No transcript yet — will generate during detection.",
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

// ─── Detection Progress Card ───────────────────────────────────────────────────

const DETECTION_PHASES = [
  {
    label: "Upload",
    sublabel: "Validating source media and preparing the asset",
    Icon: LinkIcon,
    delayMs: 0,
  },
  {
    label: "Audio extraction",
    sublabel: "Extracting clean audio for transcription",
    Icon: Music,
    delayMs: 1500,
  },
  {
    label: "Transcription",
    sublabel: "Converting speech into timestamped text",
    Icon: FileText,
    delayMs: 7500,
  },
  {
    label: "Scene detection",
    sublabel: "Finding clean clip boundaries and visual changes",
    Icon: Zap,
    delayMs: 17500,
  },
  {
    label: "Highlight scoring",
    sublabel: "Ranking moments by hook, payoff, and pacing",
    Icon: Sparkles,
    delayMs: 27500,
  },
  {
    label: "Caption generation",
    sublabel: "Preparing editable captions for each clip",
    Icon: FileText,
    delayMs: 37500,
  },
  {
    label: "Preview rendering",
    sublabel: "Building playable previews and thumbnails",
    Icon: Download,
    delayMs: 47500,
  },
  {
    label: "Ready",
    sublabel: "Clips are ready to edit, export, and download",
    Icon: CheckCircle2,
    delayMs: 57500,
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
