"use client";

import { useMemo } from "react";

import { PreviewCanvas } from "@/components/editor-v2/preview-canvas";
import { Timeline } from "@/components/editor-v2/timeline";
import { CaptionTable } from "@/components/editor-v2/caption-table";
import { PropertiesPanel } from "@/components/editor-v2/properties-panel";
import { ClipList } from "@/components/repurpose/clip-list";
import { ExportPanel } from "@/components/repurpose/export-panel";
import { AdvancedFeaturesPanel } from "@/components/repurpose/advanced-features-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type Clip = {
  id: string;
  startMs: number;
  endMs: number;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  previewPath?: string | null;
};

type ExportRecord = {
  id: string;
  preset: string;
  status: string;
};

type Asset = {
  id: string;
  path: string;
  durationSec?: number | null;
  durationSeconds?: number | null;
  transcript?: string | null;
  createdAt: string;
};

export interface EditorSurfaceV2Props {
  project: {
    id: string;
    title: string;
    topic?: string | null;
    clips: Clip[];
    exports: ExportRecord[];
    assets: Asset[];
  } | null;
  selectedClipIds: string[];
  onSelectClip: (clipIds: string[]) => void;
  onGenerateCaptions: (clipId: string) => Promise<void>;
  captionLoading?: string;
  onQueuedExport: () => Promise<void> | void;
}

export function EditorSurfaceV2({
  project,
  selectedClipIds,
  onSelectClip,
  onGenerateCaptions,
  captionLoading,
  onQueuedExport
}: EditorSurfaceV2Props) {
  const { toast } = useToast();
  const primaryAsset = project?.assets[0] ?? null;
  const activeClip = useMemo(() => project?.clips.find((clip) => selectedClipIds.includes(clip.id)) ?? project?.clips[0] ?? null, [project?.clips, selectedClipIds]);

  async function handleSplit(clipId: string, atMs: number) {
    try {
      const response = await fetch(`/api/clips/${clipId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splitAtMs: atMs }),
        cache: "no-store",
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to split clip");
      }

      toast({
        title: "Clip split successfully",
        description: "Two new clips have been created."
      });

      // Reload project to show new clips
      await onQueuedExport();
    } catch (error) {
      console.error("Failed to split clip:", error);
      toast({
        variant: "destructive",
        title: "Split failed",
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  }

  async function handleTrim(clipId: string, range: { startMs: number; endMs: number }) {
    try {
      const response = await fetch(`/api/clips/${clipId}/trim`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startMs: range.startMs, endMs: range.endMs }),
        cache: "no-store",
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to trim clip");
      }

      toast({
        title: "Clip trimmed successfully",
        description: "Clip boundaries have been updated. Regenerate captions if needed."
      });

      // Reload project to show updated clip
      await onQueuedExport();
    } catch (error) {
      console.error("Failed to trim clip:", error);
      toast({
        variant: "destructive",
        title: "Trim failed",
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  }

  if (!project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading project</CardTitle>
          <CardDescription>Please select a project to begin.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <PreviewCanvas asset={primaryAsset} selectedClip={activeClip ? { startMs: activeClip.startMs, endMs: activeClip.endMs, title: activeClip.title } : null} />
        <Timeline
          clips={project.clips.map((clip) => ({ id: clip.id, label: clip.title ?? "Clip", startMs: clip.startMs, endMs: clip.endMs }))}
          activeClipId={activeClip?.id}
          onSelect={(clipId) => onSelectClip([clipId])}
          onSplit={handleSplit}
          onTrim={handleTrim}
        />
        {/* Phase 2 Advanced Features */}
        <AdvancedFeaturesPanel
          assetId={primaryAsset?.id}
          projectId={project.id}
          durationMs={primaryAsset?.durationSeconds ? primaryAsset.durationSeconds * 1000 : (primaryAsset?.durationSec ? primaryAsset.durationSec * 1000 : 0)}
          onFeaturesUsed={() => onQueuedExport()}
        />
        <Card>
          <CardHeader>
            <CardTitle>Clips</CardTitle>
            <CardDescription>Generate captions, review summaries, and choose clips for exports.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClipList
              clips={project.clips}
              onSelect={(ids) => onSelectClip(ids)}
              onGenerateCaptions={onGenerateCaptions}
              loadingClipId={captionLoading}
              projectId={project.id}
              onExportQueued={() => onQueuedExport()}
            />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <CaptionTable
          captions={project.clips.map((clip) => ({ id: clip.id, startMs: clip.startMs, endMs: clip.endMs, text: clip.summary ?? "" }))}
          activeCaptionId={activeClip?.id}
          onSelect={(captionId) => onSelectClip([captionId])}
          onUpdate={() => void 0}
          onDelete={() => void 0}
          onInsertAfter={() => void 0}
        />
        <PropertiesPanel selectedAspect="9:16" />
        <Card>
          <CardHeader>
            <CardTitle>Export presets</CardTitle>
            <CardDescription>Queue renders with branded overlays.</CardDescription>
          </CardHeader>
          <CardContent>
            <ExportPanel
              projectId={project.id}
              selectedClipIds={selectedClipIds}
              exports={project.exports}
              onQueued={() => onQueuedExport?.()}
            />
          </CardContent>
        </Card>
        <NotesPanel />
      </div>
    </div>
  );
}

function NotesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor notes</CardTitle>
        <CardDescription>Keep a quick log while reviewing clips.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="editor-notes" className="text-xs text-muted-foreground">Notes</Label>
        <Input id="editor-notes" placeholder="Drop edit notes or timestamps" className="h-10 text-sm" />
        <Button variant="outline" size="sm" type="button" className="text-xs">Save note</Button>
      </CardContent>
    </Card>
  );
}
