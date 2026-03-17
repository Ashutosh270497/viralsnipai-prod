"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Film, Languages, Loader2, Mic } from "lucide-react";

import { useRepurpose } from "@/components/repurpose/repurpose-context";
import { ExportPanel } from "@/components/repurpose/export-panel";
import { TranslateTranscriptDialog } from "@/components/repurpose/translate-transcript-dialog";
import { VoiceTranslateDialog } from "@/components/repurpose/voice-translate-dialog";
import { TranslationsList } from "@/components/repurpose/translations-list";
import { VoiceTranslationsList } from "@/components/repurpose/voice-translations-list";
import { cn } from "@/lib/utils";
import { EXPORT_PRESETS } from "@clippers/types";

/** Compute a human-readable ratio string from pixel dimensions (e.g. 1080×1920 → "9:16") */
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

  const [translateOpen, setTranslateOpen]           = useState(false);
  const [voiceTranslateOpen, setVoiceTranslateOpen] = useState(false);
  const [translationsKey, setTranslationsKey]       = useState(0);
  const [voiceKey, setVoiceKey]                     = useState(0);
  const [selectedPreset, setSelectedPreset]         = useState<string>("shorts_9x16_1080");

  // ── All hooks must come before any early returns (Rules of Hooks) ────────
  const selectedPresetConfig = useMemo(
    () => EXPORT_PRESETS.find((p) => p.id === selectedPreset) ?? EXPORT_PRESETS[0],
    [selectedPreset]
  );

  const previewClip = useMemo(
    () =>
      project?.clips.find((c) => selectedClipIds.includes(c.id)) ??
      project?.clips[0] ??
      null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project?.clips, selectedClipIds]
  );

  const pendingExportCount = useMemo(
    () =>
      project?.exports.filter((e) => e.status !== "done" && e.status !== "failed").length ?? 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project?.exports]
  );

  useEffect(() => {
    if (pendingExportCount === 0) return;
    const timer = setInterval(() => { invalidate(); }, 5000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingExportCount]);

  // ── Guard states (after all hooks) ───────────────────────────────────────
  if (projects.length === 0)
    return <EmptyState message="Create a project to start repurposing video content." />;

  if (!isProjectSelected)
    return <GlassCard title="Select a project" description="Choose a project from the selector above to access export tools." />;

  if (isLoading)
    return <GlassCard title="Loading export data" description="Fetching clips, exports, and translation state…" loading />;

  if (!project)
    return (
      <GlassCard title="Project unavailable" description="The selected project could not be loaded. Pick another project to continue.">
        <button
          onClick={() => setProjectId("")}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Ingest & Detect
        </button>
      </GlassCard>
    );

  if (project.assets.length === 0)
    return (
      <GlassCard title="No media found" description="Ingest a YouTube video or upload a file before exporting.">
        <Link
          href={`/repurpose?projectId=${project.id}`}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Go to Ingest & Detect
        </Link>
      </GlassCard>
    );

  const normalizedLang = primaryAsset?.sourceLanguage?.trim().toLowerCase();
  const sourceLang =
    normalizedLang && /^[a-z]{2}(-[a-z]{2})?$/.test(normalizedLang) ? normalizedLang : "en";
  const doneExports = project.exports.filter((e) => e.status === "done");
  const selectedClipsHaveHookOverlays = selectedClipIds.some((clipId) => {
    const clip = project.clips.find((entry) => entry.id === clipId);
    return Boolean(clip?.captionStyle?.hookOverlays?.length);
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">

      {/* ── Page header with inline stats ───────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Export & Translate</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Choose a format, configure settings, and ship channel-ready clips.
          </p>
        </div>
        {/* Inline stat chips */}
        <div className="flex items-center gap-2">
          {[
            { label: "Total",    value: project.clips.length,  dim: false },
            { label: "Selected", value: selectedClipIds.length, dim: selectedClipIds.length === 0 },
            { label: "Exported", value: doneExports.length,    dim: false, accent: doneExports.length > 0 },
          ].map((s) => (
            <div key={s.label} className={cn(
              "flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg border text-sm",
              s.accent
                ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-400"
                : "border-white/[0.07] bg-white/[0.03] text-muted-foreground/60"
            )}>
              <span className={cn("font-bold tabular-nums", s.dim ? "text-white/25" : "text-white")}>
                {s.value}
              </span>
              <span className="text-[11px] uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">

        {/* ── LEFT: Export controls + Translation ──────────────────────────── */}
        <div className="space-y-5">

          {/* Export card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-purple-400" />
                <h2 className="text-base font-semibold">Export Video</h2>
              </div>
              {selectedClipIds.length > 0 && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400">
                  {selectedClipIds.length} clip{selectedClipIds.length > 1 ? "s" : ""} selected
                </span>
              )}
            </div>

            {/* No clips selected nudge */}
            {project.clips.length > 0 && selectedClipIds.length === 0 && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <p className="flex-1 text-sm text-amber-400/90">No clips selected</p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedClipIds(project.clips.map((c) => c.id))}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors"
                  >
                    Select all
                  </button>
                  <Link
                    href={`/repurpose/editor?projectId=${project.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" /> Editor
                  </Link>
                </div>
              </div>
            )}

            <ExportPanel
              projectId={project.id}
              selectedClipIds={selectedClipIds}
              hasHookOverlays={selectedClipsHaveHookOverlays}
              exports={project.exports}
              onQueued={invalidate}
              selectedPreset={selectedPreset}
              onPresetChange={setSelectedPreset}
            />
          </div>

          {/* Translation card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6">
            <div className="flex items-center gap-2 mb-1">
              <Languages className="h-4 w-4 text-purple-400" />
              <h2 className="text-base font-semibold">Translation</h2>
            </div>
            <p className="text-sm text-muted-foreground/70 mb-5">
              Translate transcript and optionally create an AI-dubbed version.
            </p>

            {primaryAsset?.transcript ? (
              <>
                <div className="space-y-2 mb-5">
                  <button
                    onClick={() => setTranslateOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] hover:bg-purple-500/10 text-left transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 group-hover:bg-purple-500/30 transition-colors">
                      <Languages className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">Translate Transcript</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Generate subtitle translations in any language</p>
                    </div>
                    <div className="shrink-0 h-4 w-4 rounded-full border-2 border-purple-500/40 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                    </div>
                  </button>

                  {primaryAsset.type === "video" && (
                    <button
                      onClick={() => setVoiceTranslateOpen(true)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/[0.07] bg-transparent hover:bg-white/[0.04] text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0 group-hover:bg-white/12 transition-colors">
                        <Mic className="h-4 w-4 text-muted-foreground/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">Translate Voice</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">AI-dubbed video in target language</p>
                      </div>
                      <div className="shrink-0 h-4 w-4 rounded-full border-2 border-white/20" />
                    </button>
                  )}
                </div>

                {primaryAsset?.id && <TranslationsList key={translationsKey} assetId={primaryAsset.id} />}
                {primaryAsset?.id && primaryAsset.type === "video" && (
                  <VoiceTranslationsList key={voiceKey} assetId={primaryAsset.id} />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <Languages className="h-6 w-6 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground/50">
                  Transcript required — ingest and transcribe content first.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Format + Preview (sticky sidebar) ─────────────────────── */}
        <div className="lg:sticky lg:top-6 space-y-4">

          {/* Format picker + Preview unified card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden">

            {/* Format section */}
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Output Format
                </p>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
                  <span className="font-semibold text-emerald-400">{doneExports.length}</span>
                  <span>/ {project.clips.length} exported</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {EXPORT_PRESETS.map((preset) => {
                  const ratio = ratioLabel(preset.width, preset.height);
                  const active = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset.id)}
                      className={cn(
                        "w-full text-left px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-3",
                        active
                          ? "bg-gradient-to-r from-purple-500/[0.15] to-pink-500/[0.08] border-purple-500/30"
                          : "border-white/[0.05] bg-transparent hover:bg-white/[0.03] hover:border-white/10"
                      )}
                    >
                      <div className="min-w-0">
                        <p className={cn("text-[13px] font-medium leading-tight", active ? "text-white" : "text-white/65")}>
                          {preset.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5 tabular-nums">
                          {preset.width}×{preset.height} · {ratio}
                        </p>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        active ? "border-purple-500" : "border-white/20"
                      )}>
                        {active && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview section */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Preview
                </p>
                <span className="text-[11px] font-semibold text-muted-foreground/40 tabular-nums">
                  {ratioLabel(selectedPresetConfig.width, selectedPresetConfig.height)}
                </span>
              </div>

              <div className="flex justify-center">
                <div
                  className="relative overflow-hidden rounded-xl bg-black/60 border border-white/[0.08] transition-all duration-300"
                  style={{
                    aspectRatio: `${selectedPresetConfig.width} / ${selectedPresetConfig.height}`,
                    maxWidth:
                      selectedPresetConfig.height > selectedPresetConfig.width
                        ? "220px"
                        : selectedPresetConfig.width === selectedPresetConfig.height
                        ? "280px"
                        : "100%",
                    width: "100%",
                  }}
                >
                  {previewClip?.previewPath ? (
                    <video
                      key={`${previewClip.id}-${selectedPreset}`}
                      src={previewClip.previewPath}
                      className="w-full h-full object-contain"
                      autoPlay loop muted playsInline
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                      <Film className="h-6 w-6 text-white/10" />
                      <p className="text-[10px] text-muted-foreground/25 text-center px-4">
                        {selectedClipIds.length === 0 ? "Select clips to preview" : "No preview available"}
                      </p>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] font-semibold text-white/40 backdrop-blur-sm">
                    {ratioLabel(selectedPresetConfig.width, selectedPresetConfig.height)}
                  </div>
                </div>
              </div>

              {previewClip && (
                <p className="mt-2.5 text-center text-[10px] text-muted-foreground/35 truncate">
                  {previewClip.title || "Clip preview"}
                </p>
              )}
            </div>
          </div>

          {/* Pending auto-refresh note */}
          {pendingExportCount > 0 && (
            <p className="text-center text-[11px] text-muted-foreground/35">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1 align-middle" />
              Auto-refreshing every 5s…
            </p>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {primaryAsset?.id && (
        <TranslateTranscriptDialog
          open={translateOpen}
          onOpenChange={setTranslateOpen}
          assetId={primaryAsset.id}
          sourceLanguage={sourceLang}
          onSuccess={() => setTranslationsKey((k) => k + 1)}
        />
      )}
      {primaryAsset?.id && primaryAsset.type === "video" && (
        <VoiceTranslateDialog
          open={voiceTranslateOpen}
          onOpenChange={setVoiceTranslateOpen}
          assetId={primaryAsset.id}
          sourceLanguage={sourceLang}
          onSuccess={() => setVoiceKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-8">
      <div className="flex items-center gap-2 mb-1">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-purple-400" />}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
