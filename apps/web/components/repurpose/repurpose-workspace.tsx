"use client";

import { useState } from "react";
import { Scissors, Languages, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { formatDuration } from "@/lib/utils";
import { EditorSurfaceV2 } from "@/components/editor-v2/editor-surface";

import { HIGHLIGHT_MODEL_OPTIONS, useRepurposeWorkspace } from "./use-repurpose-workspace";
import type { ProjectSummary } from "./types";
import { AIPromptGeneratorDialog } from "./ai-prompt-generator-dialog";
import { TranslateTranscriptDialog } from "./translate-transcript-dialog";
import { TranslationsList } from "./translations-list";
import { VoiceTranslateDialog } from "./voice-translate-dialog";
import { VoiceTranslationsList } from "./voice-translations-list";

export function RepurposeWorkspace({
  projects,
  initialProjectId
}: {
  projects: ProjectSummary[];
  initialProjectId?: string;
}) {
  const { toast } = useToast();
  const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
  const [voiceTranslateDialogOpen, setVoiceTranslateDialogOpen] = useState(false);
  const [translationsKey, setTranslationsKey] = useState(0);
  const [voiceTranslationsKey, setVoiceTranslationsKey] = useState(0);

  const {
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
    primaryAsset,
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
    isProjectSelected,
    selectValue,
    handleAutoHighlights,
    handleGenerateCaptions,
    handleIngestYouTube,
    loadProject
  } = useRepurposeWorkspace({ projects, initialProjectId });

  const uploadSection = !isProjectSelected ? (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 p-12 text-center">
      <div className="flex flex-col items-center gap-6 max-w-md">
        <div className="rounded-full bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-6">
          <Scissors className="h-12 w-12 text-muted-foreground/70" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Select a project first</p>
          <p className="text-xs text-muted-foreground/80">Choose a project to enable uploads, highlights, and exports</p>
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <UploadDropzone
          projectId={projectId}
          onUpload={async (file) => {
            const formData = new FormData();
            formData.append("projectId", projectId);
            formData.append("file", file);
            const response = await fetch("/api/upload", {
              method: "POST",
              body: formData,
              cache: "no-store",
              next: { revalidate: 0 }
            });
            if (!response.ok) {
              throw new Error("Upload failed");
            }
            const data = await response.json();
            toast({ title: "Upload complete", description: `${data.asset?.type ?? "Asset"} ready for repurposing.` });
            await loadProject(projectId);
          }}
          description="Drop high-quality video or audio files"
        />
        <Card className="h-full border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="tracking-tight">Latest asset</CardTitle>
                <CardDescription className="text-muted-foreground/80">
                  {primaryAsset
                    ? `${primaryAsset.type} • ${formatDuration((primaryAsset.durationSec ?? 0) * 1000)}`
                    : "Upload to get started."}
                </CardDescription>
              </div>
              {primaryAsset?.transcript && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTranslateDialogOpen(true)}
                    className="gap-2"
                  >
                    <Languages className="h-4 w-4" />
                    Translate
                  </Button>
                  {primaryAsset.type === 'video' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVoiceTranslateDialogOpen(true)}
                      className="gap-2"
                    >
                      <Mic className="h-4 w-4" />
                      Voice
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {primaryAsset?.transcript ? (
              <div className="h-48 overflow-y-auto rounded-xl border border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 p-4 text-sm leading-relaxed shadow-sm">
                {primaryAsset.transcript}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/80">
                {primaryAsset ? "Transcribe the asset from the project page to preview text." : "No transcript yet."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Translations List */}
      {primaryAsset?.id && (
        <TranslationsList key={translationsKey} assetId={primaryAsset.id} />
      )}

      {/* Voice Translations List */}
      {primaryAsset?.id && primaryAsset.type === 'video' && (
        <VoiceTranslationsList key={voiceTranslationsKey} assetId={primaryAsset.id} />
      )}
    </div>
  );

  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/90 via-purple-500/90 to-fuchsia-500/90 p-4 shadow-sm">
            <Scissors className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Repurpose</h1>
            <p className="text-sm font-medium text-muted-foreground/80">Transform long-form content into viral clips</p>
          </div>
        </div>
      </div>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="tracking-tight">Project</CardTitle>
          <CardDescription className="text-muted-foreground/80">Choose where uploaded assets and clips should live.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="flex-1 min-w-[200px] space-y-2.5">
              <Label className="text-sm font-semibold tracking-tight">Project</Label>
              <Select value={selectValue} onValueChange={(value) => setProjectId(value)}>
                <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/50 transition-colors focus:border-amber-300 focus:ring-amber-200">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isProjectSelected ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start lg:self-end h-9 rounded-xl"
                onClick={() => setProjectId("")}
              >
                Clear selection
              </Button>
            ) : null}
            <div className="flex-[2] min-w-[300px] space-y-3">
              <Label htmlFor="youtubeUrl" className="text-base font-semibold tracking-tight">YouTube URL</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  id="youtubeUrl"
                  placeholder="https://youtube.com/watch?v=..."
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  className="h-12 w-full text-base rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200"
                />
                <Button
                  onClick={handleIngestYouTube}
                  disabled={youtubeProgress.isActive || !projectId}
                  className="h-12 px-6 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                >
                  {youtubeProgress.isActive ? (
                    <span className="flex items-center gap-2">
                      <ProgressCircle progress={youtubeProgress.progress} size={20} />
                      Fetching…
                    </span>
                  ) : (
                    "Fetch from YouTube"
                  )}
                </Button>
              </div>
            </div>
            <div className="flex-1 min-w-[200px] space-y-2.5">
              <Label className="text-sm font-semibold tracking-tight">Detection model</Label>
              <Select value={highlightModel} onValueChange={setHighlightModel}>
                <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/50 transition-colors focus:border-amber-300 focus:ring-amber-200">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {HIGHLIGHT_MODEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAutoHighlights}
              disabled={highlightProgress.isActive || !primaryAsset}
              className="self-start lg:self-end h-10 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all whitespace-nowrap"
            >
              {highlightProgress.isActive ? (
                <span className="flex items-center gap-2">
                  <ProgressCircle progress={highlightProgress.progress} size={20} />
                  Detecting…
                </span>
              ) : (
                "Auto-detect highlights"
              )}
            </Button>
          </div>
        </CardContent>
        <CardContent className="flex flex-col gap-5 border-t border-border/40 bg-gradient-to-br from-slate-50/30 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              Viral Detection Prompts
            </p>
            <AIPromptGeneratorDialog
              onPromptsGenerated={(prompts) => {
                setHighlightBrief(prompts.brief);
                setHighlightAudience(prompts.audience);
                setHighlightTone(prompts.tone);
                setHighlightCallToAction(prompts.callToAction);
              }}
            />
          </div>
          <div className="rounded-2xl border border-violet-200/40 bg-gradient-to-br from-violet-50/60 to-purple-50/40 dark:border-violet-900/30 dark:from-violet-950/30 dark:to-purple-950/20 p-5 shadow-sm">
            <Label htmlFor="highlightBrief" className="text-sm font-semibold tracking-tight">Highlight brief</Label>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Share the core message or angle you want the clips to amplify. Leave blank to rely on defaults.
            </p>
            <textarea
              id="highlightBrief"
              className="mt-3 h-20 w-full resize-y rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-200"
              value={highlightBrief}
              onChange={(event) => setHighlightBrief(event.target.value)}
              placeholder="Ex: Emphasize scrappy AI growth tactics that feel achievable for solo founders."
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="highlightAudience" className="text-xs font-semibold uppercase tracking-wide">Audience</Label>
              <input
                id="highlightAudience"
                className="h-10 w-full rounded-xl border border-border/50 bg-background/80 px-3 text-sm outline-none transition-colors focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-200"
                value={highlightAudience}
                onChange={(event) => setHighlightAudience(event.target.value)}
                placeholder="Growth-focused creators"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="highlightTone" className="text-xs font-semibold uppercase tracking-wide">Tone</Label>
              <input
                id="highlightTone"
                className="h-10 w-full rounded-xl border border-border/50 bg-background/80 px-3 text-sm outline-none transition-colors focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-200"
                value={highlightTone}
                onChange={(event) => setHighlightTone(event.target.value)}
                placeholder="Tension → payoff, high energy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="highlightCallToAction" className="text-xs font-semibold uppercase tracking-wide">Desired action</Label>
              <input
                id="highlightCallToAction"
                className="h-10 w-full rounded-xl border border-border/50 bg-background/80 px-3 text-sm outline-none transition-colors focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-200"
                value={highlightCallToAction}
                onChange={(event) => setHighlightCallToAction(event.target.value)}
                placeholder="Drive viewers to subscribe or click through"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {uploadSection}

      <EditorSurfaceV2
        project={project}
        selectedClipIds={selectedClipIds}
        onSelectClip={setSelectedClipIds}
        onGenerateCaptions={handleGenerateCaptions}
        captionLoading={captionLoading}
        onQueuedExport={() => loadProject(projectId)}
      />

      {/* Translation Dialog */}
      {primaryAsset?.id && (
        <TranslateTranscriptDialog
          open={translateDialogOpen}
          onOpenChange={setTranslateDialogOpen}
          assetId={primaryAsset.id}
          sourceLanguage={primaryAsset.sourceLanguage}
          onSuccess={() => {
            // Force refresh translations list
            setTranslationsKey((prev) => prev + 1);
          }}
        />
      )}

      {/* Voice Translation Dialog */}
      {primaryAsset?.id && primaryAsset.type === 'video' && (
        <VoiceTranslateDialog
          open={voiceTranslateDialogOpen}
          onOpenChange={setVoiceTranslateDialogOpen}
          assetId={primaryAsset.id}
          sourceLanguage={primaryAsset.sourceLanguage}
          onSuccess={() => {
            // Force refresh voice translations list
            setVoiceTranslationsKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}
