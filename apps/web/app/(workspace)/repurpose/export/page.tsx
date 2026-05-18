"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Film,
  Languages,
  Loader2,
  Mic,
} from "lucide-react";

import { useRepurpose } from "@/components/repurpose/repurpose-context";
import { ExportPanel } from "@/components/repurpose/export-panel";
import { SourceQualityNotice } from "@/components/repurpose/source-quality-notice";
import type { ProjectClip, ProjectExport } from "@/components/repurpose/types";
import {
  AppCard,
  EmptyState as ProductEmptyState,
  PageHeader,
} from "@/components/product-ui/primitives";
import { cn } from "@/lib/utils";
import { getExportEligibleClips } from "@/lib/repurpose/review-workflow";
import {
  PLATFORM_EXPORT_PRESETS,
  PLATFORM_EXPORT_PRESET_VALUES,
  type PlatformExportPreset,
  type PlatformExportPresetId,
} from "@/lib/repurpose/export-presets";

const SocialPublishComposer = dynamic(
  () =>
    import("@/components/repurpose/social-publish-composer").then(
      (module) => module.SocialPublishComposer,
    ),
  { ssr: false },
);
const TranslateTranscriptDialog = dynamic(
  () =>
    import("@/components/repurpose/translate-transcript-dialog").then(
      (module) => module.TranslateTranscriptDialog,
    ),
  { ssr: false },
);
const VoiceTranslateDialog = dynamic(
  () =>
    import("@/components/repurpose/voice-translate-dialog").then(
      (module) => module.VoiceTranslateDialog,
    ),
  { ssr: false },
);
const TranslationsList = dynamic(
  () =>
    import("@/components/repurpose/translations-list").then(
      (module) => module.TranslationsList,
    ),
  { ssr: false },
);
const VoiceTranslationsList = dynamic(
  () =>
    import("@/components/repurpose/voice-translations-list").then(
      (module) => module.VoiceTranslationsList,
    ),
  { ssr: false },
);

/** Compute a human-readable ratio string from pixel dimensions (e.g. 1080x1920 -> "9:16") */
function ratioLabel(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

export default function RepurposeExportPage() {
  const {
    projects,
    project,
    primaryAsset,
    isProjectSelected,
    setProjectId,
    selectedClipIds,
    setSelectedClipIds,
    invalidate,
    isLoading,
  } = useRepurpose();

  const socialPublishingEnabled =
    process.env.NEXT_PUBLIC_ENABLE_SOCIAL_PUBLISHING === "true";
  const exportTranslationEnabled =
    process.env.NEXT_PUBLIC_ENABLE_EXPORT_TRANSLATION === "true";
  const advancedExportEnabled =
    process.env.NEXT_PUBLIC_ENABLE_ADVANCED_EXPORT === "true";

  const [translateOpen, setTranslateOpen] = useState(false);
  const [voiceTranslateOpen, setVoiceTranslateOpen] = useState(false);
  const [translationsKey, setTranslationsKey] = useState(0);
  const [voiceKey, setVoiceKey] = useState(0);
  const [selectedPlatformPreset, setSelectedPlatformPreset] =
    useState<PlatformExportPresetId>("youtube_shorts");
  const selectedPreset = PLATFORM_EXPORT_PRESETS[selectedPlatformPreset].legacyPreset;
  const setSelectedPreset = (preset: string) => {
    const match = PLATFORM_EXPORT_PRESET_VALUES.find(
      (id) => PLATFORM_EXPORT_PRESETS[id].legacyPreset === preset,
    );
    if (match) setSelectedPlatformPreset(match);
  };
  const [showRejectedClips, setShowRejectedClips] = useState(false);

  const selectedPresetConfig = useMemo(
    () => PLATFORM_EXPORT_PRESETS[selectedPlatformPreset],
    [selectedPlatformPreset],
  );

  const pendingExportCount = useMemo(
    () =>
      project?.exports.filter((entry) => entry.status !== "done" && entry.status !== "failed")
        .length ?? 0,
    [project?.exports],
  );

  useEffect(() => {
    if (pendingExportCount === 0) return;
    const timer = setInterval(() => {
      invalidate();
    }, 5000);
    return () => clearInterval(timer);
  }, [invalidate, pendingExportCount]);

  const exportReadyClipIds = useMemo(
    () =>
      (project?.clips ?? [])
        .filter((clip) => clip.reviewStatus === "export_ready")
        .map((clip) => clip.id),
    [project?.clips],
  );

  useEffect(() => {
    if (!project || selectedClipIds.length > 0 || exportReadyClipIds.length === 0) return;
    setSelectedClipIds(exportReadyClipIds);
  }, [exportReadyClipIds, project, selectedClipIds.length, setSelectedClipIds]);

  if (projects.length === 0)
    return (
      <ProductEmptyState
        icon={Download}
        title="Create a project before exporting"
        description="Exports are generated from clips inside a project. Create a project, upload a video, then return here to render MP4s."
        primary={{ label: "Create project", href: "/projects" }}
      />
    );

  if (!isProjectSelected)
    return (
      <ProductEmptyState
        icon={Film}
        title="Select a project to view exports"
        description="Choose a project to see export history, rendering status, and download links."
        primary={{ label: "Go to projects", href: "/projects" }}
        secondary={{ label: "Create clips", href: "/repurpose" }}
      />
    );

  if (isLoading)
    return (
      <GlassCard
        title="Loading export data"
        description="Fetching clips, exports, and render status..."
        loading
      />
    );

  if (!project)
    return (
      <GlassCard
        title="Project unavailable"
        description="The selected project could not be loaded. Pick another project to continue."
      >
        <button
          onClick={() => setProjectId("")}
          className="mt-4 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </button>
      </GlassCard>
    );

  if (project.assets.length === 0)
    return (
      <GlassCard
        title="No media found"
        description="Upload or import a video before exporting clips."
      >
        <Link
          href={`/repurpose?projectId=${project.id}`}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" /> Create clips
        </Link>
      </GlassCard>
    );

  const normalizedLang = primaryAsset?.sourceLanguage?.trim().toLowerCase();
  const sourceLang =
    normalizedLang && /^[a-z]{2}(-[a-z]{2})?$/.test(normalizedLang) ? normalizedLang : "en";
  const doneExports = project.exports.filter((entry) => isCompletedStatus(entry.status));
  const exportReadyClips = project.clips.filter(
    (clip) => clip.reviewStatus === "export_ready",
  );
  const eligibleExportClips = advancedExportEnabled
    ? getExportEligibleClips(project.clips, showRejectedClips)
    : exportReadyClips;
  const eligibleClipIds = new Set(eligibleExportClips.map((clip) => clip.id));
  const selectedForExportIds = selectedClipIds.filter((id) => eligibleClipIds.has(id));
  const selectedClips = eligibleExportClips.filter((clip) =>
    selectedForExportIds.includes(clip.id),
  );
  const selectedCaptionSrt =
    selectedClips.find((clip) => clip.captionSrt?.trim())?.captionSrt ?? null;
  const selectedCaptionAnimationType =
    selectedClips.find((clip) => clip.captionStyle?.animation?.type)?.captionStyle?.animation
      ?.type ?? null;
  const previewClip = selectedClips[0] ?? eligibleExportClips[0] ?? null;
  const selectedClipsHaveHookOverlays = selectedForExportIds.some((clipId) => {
    const clip = project.clips.find((entry) => entry.id === clipId);
    return Boolean(clip?.captionStyle?.hookOverlays?.length);
  });
  const selectedDurationSec = Math.round(
    selectedClips.reduce((sum, clip) => sum + Math.max(0, clip.endMs - clip.startMs), 0) / 1000,
  );

  return (
    <div className="w-full space-y-6 pb-10">
      <PageHeader
        eyebrow="Export Center"
        title="Export your clips"
        description="Choose a format, render your export-ready clips, and download social-ready videos."
        icon={Download}
        actions={
          <Link
            href={`/repurpose/editor?projectId=${project.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Editor
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryPill label="Selected clips" value={selectedForExportIds.length} />
        <SummaryPill label="Duration" value={selectedDurationSec ? `${selectedDurationSec}s` : "-"} />
        <SummaryPill label="Exports ready" value={doneExports.length} />
      </div>

      {project.clips.length === 0 ? (
        <ExportEmptyState
          title="No clips generated yet"
          description="Generate clips first, then return here to export MP4s."
          href={`/repurpose?projectId=${project.id}`}
          cta="Create clips"
        />
      ) : null}

      {project.clips.length > 0 && eligibleExportClips.length === 0 ? (
        <ExportEmptyState
          title="No export-ready clips yet"
          description="Open the editor and mark the clips you want to download as export ready."
          href={`/repurpose/editor?projectId=${project.id}`}
          cta="Go to Editor"
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <main className="min-w-0 space-y-5">
          <AppCard className="space-y-7 p-5 sm:p-6">
            <SelectedClipsSummary
              clips={selectedClips}
              availableClips={eligibleExportClips}
              selectedIds={selectedForExportIds}
              onSelectAll={() => setSelectedClipIds(eligibleExportClips.map((clip) => clip.id))}
              editorHref={`/repurpose/editor?projectId=${project.id}`}
            />

            <ExportFormatSelector
              selected={selectedPlatformPreset}
              onChange={(presetId) => {
                setSelectedPlatformPreset(presetId);
                setSelectedPreset(PLATFORM_EXPORT_PRESETS[presetId].legacyPreset);
              }}
            />

            <ExportPanel
              projectId={project.id}
              selectedClipIds={selectedForExportIds}
              hasHookOverlays={selectedClipsHaveHookOverlays}
              exports={project.exports}
              onQueued={invalidate}
              selectedPreset={selectedPreset}
              onPresetChange={setSelectedPreset}
              selectedPlatformPreset={selectedPlatformPreset}
              onPlatformPresetChange={setSelectedPlatformPreset}
              captionSrt={selectedCaptionSrt}
              clipTitle={previewClip?.title}
              captionAnimationType={selectedCaptionAnimationType}
              showPlatformSelector={false}
            />
          </AppCard>

          {advancedExportEnabled ? (
            <AdvancedExportSection
              clips={project.clips}
              eligibleClips={eligibleExportClips}
              selectedIds={selectedForExportIds}
              showRejectedClips={showRejectedClips}
              onShowRejectedChange={setShowRejectedClips}
              onSelectIds={setSelectedClipIds}
            />
          ) : null}

          {socialPublishingEnabled ? (
            <SocialPublishComposer
              projectId={project.id}
              selectedClipIds={selectedForExportIds}
              clips={selectedClips.length > 0 ? selectedClips : eligibleExportClips}
              exports={project.exports}
              defaultPlatform={selectedPlatformPreset}
            />
          ) : null}

          {exportTranslationEnabled ? (
            <TranslationSection
              assetId={primaryAsset?.id}
              assetType={primaryAsset?.type}
              hasTranscript={Boolean(primaryAsset?.transcript)}
              translationsKey={translationsKey}
              voiceKey={voiceKey}
              onTranslate={() => setTranslateOpen(true)}
              onVoiceTranslate={() => setVoiceTranslateOpen(true)}
            />
          ) : null}
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-6">
          <ExportPreviewPanel
            clip={previewClip}
            selectedPreset={selectedPresetConfig}
            sourceWidth={primaryAsset?.sourceWidth}
            sourceHeight={primaryAsset?.sourceHeight}
            replaceSourceHref={`/repurpose?projectId=${project.id}`}
          />
          <LatestExportStatus exports={project.exports} selectedPreset={selectedPlatformPreset} />
          {pendingExportCount > 0 ? (
            <p className="text-center text-[11px] text-muted-foreground/50">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin align-middle" />
              Auto-refreshing export status...
            </p>
          ) : null}
        </aside>
      </div>

      {exportTranslationEnabled && primaryAsset?.id ? (
        <TranslateTranscriptDialog
          open={translateOpen}
          onOpenChange={setTranslateOpen}
          assetId={primaryAsset.id}
          sourceLanguage={sourceLang}
          onSuccess={() => setTranslationsKey((key) => key + 1)}
        />
      ) : null}
      {exportTranslationEnabled && primaryAsset?.id && primaryAsset.type === "video" ? (
        <VoiceTranslateDialog
          open={voiceTranslateOpen}
          onOpenChange={setVoiceTranslateOpen}
          assetId={primaryAsset.id}
          sourceLanguage={sourceLang}
          onSuccess={() => setVoiceKey((key) => key + 1)}
        />
      ) : null}
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ExportEmptyState({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <AppCard className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground/70">{description}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {cta}
        </Link>
      </div>
    </AppCard>
  );
}

function SelectedClipsSummary({
  clips,
  availableClips,
  selectedIds,
  onSelectAll,
  editorHref,
}: {
  clips: ProjectClip[];
  availableClips: ProjectClip[];
  selectedIds: string[];
  onSelectAll: () => void;
  editorHref: string;
}) {
  const visible = clips.slice(0, 3);
  const hiddenCount = Math.max(0, clips.length - visible.length);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Selected clips</h2>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Confirm what will be rendered before starting the export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableClips.length > 0 ? (
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
            >
              Select all export-ready
            </button>
          ) : null}
          <Link
            href={editorHref}
            className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
          >
            Go to Editor
          </Link>
        </div>
      </div>

      {selectedIds.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <p className="text-sm font-semibold text-amber-200">No clips selected for export</p>
          <p className="mt-1 text-sm text-amber-100/75">
            {availableClips.length > 0
              ? "Export-ready clips are available. Select all export-ready clips or return to the editor to change selection."
              : "Mark clips export ready in the editor before exporting."}
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {visible.map((clip, index) => (
            <SelectedClipCard key={clip.id} clip={clip} index={index} />
          ))}
          {hiddenCount > 0 ? (
            <div className="flex min-w-[140px] items-center justify-center rounded-2xl border border-border/60 bg-muted/20 px-4 text-sm font-semibold text-muted-foreground">
              +{hiddenCount} more
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SelectedClipCard({ clip, index }: { clip: ProjectClip; index: number }) {
  return (
    <div className="min-w-[220px] max-w-[260px] overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
      <div className="aspect-video bg-background/70">
        {clip.thumbnail || clip.previewPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail || clip.previewPath || ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Film className="h-5 w-5 text-muted-foreground/25" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {clip.title || `Clip ${index + 1}`}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatClipDuration(clip)}</span>
          <span>{formatScore(clip.viralityScore)}</span>
          <StatusPill status={clip.reviewStatus ?? "needs_review"} />
        </div>
      </div>
    </div>
  );
}

function ExportFormatSelector({
  selected,
  onChange,
}: {
  selected: PlatformExportPresetId;
  onChange: (preset: PlatformExportPresetId) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Choose format</h2>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Pick the frame your exported videos should use.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PLATFORM_EXPORT_PRESET_VALUES.map((presetId) => {
          const preset = PLATFORM_EXPORT_PRESETS[presetId];
          const active = selected === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              aria-pressed={active}
              className={cn(
                "min-w-0 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "border-emerald-400/45 bg-emerald-500/[0.10] shadow-sm shadow-emerald-950/20"
                  : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/35",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{preset.label}</p>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {preset.aspectRatio} · {preset.width}x{preset.height}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-emerald-400" : "border-border",
                  )}
                >
                  {active ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : null}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-muted-foreground/75">
                {bestForText(preset.id)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ExportPreviewPanel({
  clip,
  selectedPreset,
  sourceWidth,
  sourceHeight,
  replaceSourceHref,
}: {
  clip: ProjectClip | null;
  selectedPreset: PlatformExportPreset;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  replaceSourceHref: string;
}) {
  return (
    <AppCard className="space-y-4 overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Preview</h2>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {clip ? clip.title || "Selected clip" : "Select a clip to preview"}
          </p>
        </div>
        <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {ratioLabel(selectedPreset.width, selectedPreset.height)}
        </span>
      </div>
      <div className="flex justify-center">
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-border/50 bg-muted/60"
          style={{
            aspectRatio: `${selectedPreset.width} / ${selectedPreset.height}`,
            maxWidth:
              selectedPreset.height > selectedPreset.width
                ? "220px"
                : selectedPreset.width === selectedPreset.height
                  ? "280px"
                  : "100%",
          }}
        >
          {clip?.previewPath ? (
            <video
              key={`${clip.id}-${selectedPreset.id}`}
              src={clip.previewPath}
              className="h-full w-full object-contain"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <Film className="h-6 w-6 text-muted-foreground/25" />
              <p className="text-xs text-muted-foreground/45">No preview available</p>
            </div>
          )}
        </div>
      </div>
      <SourceQualityNotice
        sourceWidth={sourceWidth}
        sourceHeight={sourceHeight}
        targetWidth={selectedPreset.width}
        targetHeight={selectedPreset.height}
        detailsCollapsed
        className="mt-2"
        replaceSourceHref={replaceSourceHref}
      />
    </AppCard>
  );
}

function LatestExportStatus({
  exports,
  selectedPreset,
}: {
  exports: ProjectExport[];
  selectedPreset: PlatformExportPresetId;
}) {
  const latest = useMemo(
    () => {
      const byNewest = (a: ProjectExport, b: ProjectExport) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      };
      return (
        exports.filter((entry) => entry.platformPreset === selectedPreset).sort(byNewest)[0] ??
        [...exports].sort(byNewest)[0]
      );
    },
    [exports, selectedPreset],
  );

  if (!latest) {
    return (
      <AppCard className="p-5">
        <h2 className="text-base font-semibold">Export status</h2>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Your latest render and download will appear here.
        </p>
      </AppCard>
    );
  }

  const done = isCompletedStatus(latest.status);
  return (
    <AppCard className="p-5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            done ? "bg-emerald-500/15 text-emerald-300" : "bg-primary/12 text-primary",
          )}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{done ? "Download ready" : "Export status"}</h2>
          <p className="mt-1 text-sm capitalize text-muted-foreground/70">
            {done ? "The latest export is ready to download." : latest.status.replace(/_/g, " ")}
          </p>
          {done && latest.outputPath ? (
            <a
              href={latest.outputPath}
              download
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          ) : null}
        </div>
      </div>
    </AppCard>
  );
}

function AdvancedExportSection({
  clips,
  eligibleClips,
  selectedIds,
  showRejectedClips,
  onShowRejectedChange,
  onSelectIds,
}: {
  clips: ProjectClip[];
  eligibleClips: ProjectClip[];
  selectedIds: string[];
  showRejectedClips: boolean;
  onShowRejectedChange: (value: boolean) => void;
  onSelectIds: (ids: string[]) => void;
}) {
  const approvedIds = clips
    .filter((clip) => clip.reviewStatus === "approved")
    .map((clip) => clip.id);
  const exportReadyIds = clips
    .filter((clip) => clip.reviewStatus === "export_ready")
    .map((clip) => clip.id);

  return (
    <AppCard className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold">Advanced export selection</h2>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Internal controls for broader review workflows.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectIds(exportReadyIds)}
          className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold"
        >
          Select export-ready
        </button>
        <button
          type="button"
          onClick={() => onSelectIds(approvedIds)}
          className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold"
        >
          Select approved
        </button>
        <button
          type="button"
          onClick={() => onSelectIds(eligibleClips.map((clip) => clip.id))}
          className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold"
        >
          Select all eligible
        </button>
        <button
          type="button"
          onClick={() => onShowRejectedChange(!showRejectedClips)}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            showRejectedClips
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-border/60 bg-muted/30",
          )}
        >
          {showRejectedClips ? "Including rejected" : "Show rejected"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground/55">
        {selectedIds.length} selected from {eligibleClips.length} eligible clips.
      </p>
    </AppCard>
  );
}

function TranslationSection({
  assetId,
  assetType,
  hasTranscript,
  translationsKey,
  voiceKey,
  onTranslate,
  onVoiceTranslate,
}: {
  assetId?: string;
  assetType?: string;
  hasTranscript: boolean;
  translationsKey: number;
  voiceKey: number;
  onTranslate: () => void;
  onVoiceTranslate: () => void;
}) {
  return (
    <AppCard className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <Languages className="h-4 w-4 text-primary" />
        <div>
          <h2 className="text-base font-semibold">Translation</h2>
          <p className="text-sm text-muted-foreground/70">
            Translate transcript or voice tracks for multilingual exports.
          </p>
        </div>
      </div>
      {hasTranscript && assetId ? (
        <>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onTranslate}
              className="flex flex-1 items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-left transition-colors hover:bg-primary/10"
            >
              <Languages className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Translate Transcript</span>
            </button>
            {assetType === "video" ? (
              <button
                onClick={onVoiceTranslate}
                className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Translate Voice</span>
              </button>
            ) : null}
          </div>
          <TranslationsList key={translationsKey} assetId={assetId} />
          {assetType === "video" ? <VoiceTranslationsList key={voiceKey} assetId={assetId} /> : null}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground/60">
          Transcript required before translation is available.
        </div>
      )}
    </AppCard>
  );
}

function StatusPill({ status }: { status: string }) {
  const exportReady = status === "export_ready";
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        exportReady
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-border/60 bg-muted/30 text-muted-foreground",
      )}
    >
      {exportReady ? "Export ready" : status.replace(/_/g, " ")}
    </span>
  );
}

function formatClipDuration(clip: ProjectClip) {
  return `${Math.round(Math.max(0, clip.endMs - clip.startMs) / 1000)}s`;
}

function formatScore(score?: number | null) {
  if (typeof score !== "number") return "No score";
  return `${Math.round(score)}/100`;
}

function bestForText(id: PlatformExportPresetId) {
  switch (id) {
    case "youtube_shorts":
      return "Best for Shorts, Reels, and TikTok-style vertical clips.";
    case "instagram_reels":
      return "Best for Instagram Reels with safe caption spacing.";
    case "tiktok":
      return "Best for TikTok vertical videos and UI-safe captions.";
    case "linkedin":
      return "Best for LinkedIn feed clips and professional posts.";
    case "square_feed":
      return "Best for square social feeds and repurposed posts.";
    case "landscape_youtube":
      return "Best for YouTube, websites, and widescreen playback.";
    case "x_video":
      return "Best for X video posts and landscape embeds.";
    default:
      return "Best for social-ready exports.";
  }
}

function isCompletedStatus(status?: string | null) {
  return status === "done" || status === "completed";
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
      <div className="mb-1 flex items-center gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
