"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Loader2, Play, Flame, Info, Download, ChevronDown, GripVertical, Filter, ArrowUpDown } from "lucide-react";
import Image from "next/image";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaptionEditorDialog } from "@/components/repurpose/caption-editor-dialog";
import type { ViralityFactors } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

// Convert SRT to VTT format and return as data URL
function srtToVttDataUrl(srt: string): string {
  // Convert SRT timestamps to VTT format (00:00:00,000 -> 00:00:00.000)
  const vtt = srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

  // Add VTT header
  const vttContent = `WEBVTT\n\n${vtt}`;

  // Create data URL
  const blob = new Blob([vttContent], { type: "text/vtt" });
  return URL.createObjectURL(blob);
}

type ClipType = {
  id: string;
  startMs: number;
  endMs: number;
  order?: number | null;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  previewPath?: string | null;
  thumbnail?: string | null;
  viralityScore?: number | null;
  viralityFactors?: ViralityFactors | null;
};

interface ClipListProps {
  clips: Array<ClipType>;
  onSelect: (clipIds: string[]) => void;
  onGenerateCaptions: (clipId: string) => Promise<void>;
  loadingClipId?: string;
  projectId?: string;
  onExportQueued?: () => Promise<void> | void;
}

interface SortableClipCardProps {
  clip: ClipType;
  index: number;
  isSelected: boolean;
  onToggle: (clipId: string) => void;
  onGenerateCaptions: (clipId: string) => Promise<void>;
  loadingClipId?: string;
  onPreview: (clipId: string) => void;
  onEditCaptions: (clipId: string) => void;
  getScoreColor: (score: number) => string;
  formatFactorName: (key: string) => string;
  dragEnabled: boolean;
}

function sortClipsByStoredOrder(items: ClipType[]): ClipType[] {
  return [...items].sort((a, b) => {
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.startMs - b.startMs;
  });
}

function SortableClipCard({
  clip,
  index,
  isSelected,
  onToggle,
  onGenerateCaptions,
  loadingClipId,
  onPreview,
  onEditCaptions,
  getScoreColor,
  formatFactorName,
  dragEnabled
}: SortableClipCardProps) {


  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: clip.id, disabled: !dragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const duration = clip.endMs - clip.startMs;
  const baseFactorKeys: Array<keyof ViralityFactors> = [
    "hookStrength",
    "emotionalPeak",
    "storyArc",
    "pacing",
    "transcriptQuality",
  ];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("transition", isSelected ? "border-primary bg-primary/5" : undefined)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...attributes}
            {...listeners}
            className={cn(
              "p-1 rounded",
              dragEnabled
                ? "cursor-grab active:cursor-grabbing hover:bg-muted"
                : "cursor-default opacity-40"
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <CardTitle className="text-base">Clip {index + 1}</CardTitle>
              {clip.viralityScore !== null && clip.viralityScore !== undefined && (
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "text-white font-semibold",
                      getScoreColor(clip.viralityScore)
                    )}
                  >
                    <Flame className="mr-1 h-3 w-3" />
                    {clip.viralityScore}
                  </Badge>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        <Info className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                          <span>Virality Analysis</span>
                          <Badge variant="outline" className={getScoreColor(clip.viralityScore)}>
                            {clip.viralityScore}/100
                          </Badge>
                        </DialogTitle>
                        <DialogDescription>
                          AI-powered analysis of this clip&apos;s viral potential
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        {clip.viralityFactors && (
                          <>
                            <div className="space-y-2">
                              {baseFactorKeys
                                .filter((key) => typeof clip.viralityFactors?.[key] === "number")
                                .map((key) => {
                                  const value = clip.viralityFactors?.[key] as number;
                                  return (
                                    <div key={key} className="space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">{formatFactorName(key)}</span>
                                        <span className="font-medium">{value}/100</span>
                                      </div>
                                      <Progress value={value} className="h-1.5" />
                                    </div>
                                  );
                                })}
                            </div>

                            {clip.viralityFactors.reasoning && (
                              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                                <p className="font-medium text-foreground mb-1 flex items-center gap-1">
                                  <Info className="h-3 w-3" />
                                  Analysis
                                </p>
                                <p>{clip.viralityFactors.reasoning}</p>
                              </div>
                            )}

                            {clip.viralityFactors.improvements && clip.viralityFactors.improvements.length > 0 && (
                              <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
                                <p className="font-medium text-foreground mb-1">Improvements</p>
                                <ul className="space-y-1 text-muted-foreground">
                                  {clip.viralityFactors.improvements.map((improvement, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span className="text-primary mt-0.5">•</span>
                                      <span>{improvement}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
            <CardDescription>
              {formatDuration(duration)} • {formatDuration(clip.startMs)} → {formatDuration(clip.endMs)}
            </CardDescription>
          </div>
        </div>
        <Button
          variant={isSelected ? "default" : "outline"}
          size="sm"
          onClick={() => onToggle(clip.id)}
          className="ml-3"
        >
          <CheckSquare className="mr-2 h-4 w-4" /> Select
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {clip.thumbnail && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <Image
              src={clip.thumbnail}
              alt={clip.title || `Clip ${index + 1} thumbnail`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        <Input
          defaultValue={clip.title ?? `Clip ${index + 1}`}
          onBlur={async (event) => {
            const newTitle = event.target.value;
            await fetch(`/api/clips/${clip.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: newTitle }),
              cache: "no-store",
              next: { revalidate: 0 }
            });
          }}
        />
        {clip.summary ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">{clip.summary}</p>
            {clip.callToAction ? <p className="mt-1 text-[11px] uppercase">{clip.callToAction}</p> : null}
          </div>
        ) : null}
        {/* Phase 1 Enhancement Badges */}
        {clip.viralityFactors?.enhancement && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={clip.viralityFactors.enhancement.qualityScore >= 70 ? "default" : "secondary"}
              className={clip.viralityFactors.enhancement.qualityScore >= 70 ? "bg-green-500 hover:bg-green-600" : ""}
            >
              Quality: {clip.viralityFactors.enhancement.qualityScore}/100
            </Badge>
            <Badge variant="outline">
              {clip.viralityFactors.enhancement.wordsPerSecond.toFixed(1)} WPS
            </Badge>
            {clip.viralityFactors.enhancement.fillerPercentage < 8 && (
              <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">
                ✓ Clean Speech
              </Badge>
            )}
            {clip.viralityFactors.enhancement.energyProfile === "rising" && (
              <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
                ↗️ Rising Energy
              </Badge>
            )}
            {clip.viralityFactors.enhancement.energyProfile === "consistent" && (
              <Badge variant="outline" className="border-purple-500 text-purple-700 dark:text-purple-400">
                ⚡ Consistent Energy
              </Badge>
            )}
            {clip.viralityFactors.enhancement.hasDeadAir && (
              <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400">
                ⚠️ Has Pauses
              </Badge>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={loadingClipId === clip.id}
            onClick={() => onGenerateCaptions(clip.id)}
          >
            {loadingClipId === clip.id ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {clip.captionSrt ? "Rebuild captions" : "Generate captions"}
          </Button>
          {clip.captionSrt && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEditCaptions(clip.id)}
            >
              Edit Captions
            </Button>
          )}
          {clip.previewPath && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreview(clip.id)}
            >
              <Play className="mr-2 h-4 w-4" />
              Preview
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ClipList({ clips, onSelect, onGenerateCaptions, loadingClipId, projectId, onExportQueued }: ClipListProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [previewClipId, setPreviewClipId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("manual");
  const [filterBy, setFilterBy] = useState<string>("all");
  const [orderedClips, setOrderedClips] = useState<ClipType[]>(() => sortClipsByStoredOrder(clips));
  const [editingCaptionClipId, setEditingCaptionClipId] = useState<string | null>(null);
  const [previewCaptionTrackUrl, setPreviewCaptionTrackUrl] = useState<string | null>(null);
  const previewTrackUrlRef = useRef<string | null>(null);
  const clipSignature = useMemo(() => clips.map((clip) => clip.id).join("|"), [clips]);
  const isManualOrderMode = sortBy === "manual" && filterBy === "all";

  const previewClip = clips.find(c => c.id === previewClipId);
  const editingClip = clips.find(c => c.id === editingCaptionClipId);

  // Keep latest clip payload while preserving user drag order.
  useEffect(() => {
    setOrderedClips((prev) => {
      if (prev.length === 0) {
        return sortClipsByStoredOrder(clips);
      }

      const nextById = new Map(clips.map((clip) => [clip.id, clip]));
      const merged: ClipType[] = [];

      for (const existing of prev) {
        const fresh = nextById.get(existing.id);
        if (fresh) {
          merged.push(fresh);
          nextById.delete(existing.id);
        }
      }

      for (const fresh of sortClipsByStoredOrder(Array.from(nextById.values()))) {
        merged.push(fresh);
      }

      return merged;
    });
  }, [clips]);

  useEffect(() => {
    setSelected([]);
    onSelect([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipSignature]);

  const revokePreviewTrackUrl = useCallback(() => {
    if (previewTrackUrlRef.current) {
      URL.revokeObjectURL(previewTrackUrlRef.current);
      previewTrackUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!previewClip?.captionSrt) {
      revokePreviewTrackUrl();
      setPreviewCaptionTrackUrl(null);
      return;
    }

    revokePreviewTrackUrl();
    const trackUrl = srtToVttDataUrl(previewClip.captionSrt);
    previewTrackUrlRef.current = trackUrl;
    setPreviewCaptionTrackUrl(trackUrl);

    return () => {
      if (previewTrackUrlRef.current === trackUrl) {
        URL.revokeObjectURL(trackUrl);
        previewTrackUrlRef.current = null;
      }
    };
  }, [previewClip?.captionSrt, previewClip?.id, revokePreviewTrackUrl]);

  useEffect(() => {
    return () => {
      revokePreviewTrackUrl();
    };
  }, [revokePreviewTrackUrl]);

  function toggle(clipId: string) {
    setSelected((prev) => {
      const next = prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId];
      onSelect(next);
      return next;
    });
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return "bg-green-500 hover:bg-green-600";
    if (score >= 60) return "bg-yellow-500 hover:bg-yellow-600";
    return "bg-orange-500 hover:bg-orange-600";
  }

  function formatFactorName(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  async function handleBulkCaptionGeneration() {
    if (selected.length === 0) return;

    setIsBulkGenerating(true);
    try {
      await Promise.all(selected.map((clipId) => onGenerateCaptions(clipId)));
    } finally {
      setIsBulkGenerating(false);
    }
  }

  async function handleBulkExport(preset: string) {
    if (selected.length === 0 || !projectId) return;

    setIsBulkExporting(true);
    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clipIds: selected,
          preset
        }),
        cache: "no-store",
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        throw new Error("Failed to queue export");
      }

      toast({
        title: "Export queued",
        description: `Exporting ${selected.length} clip${selected.length > 1 ? "s" : ""} as ${preset.replace(/_/g, " ")}`
      });

      if (onExportQueued) {
        await onExportQueued();
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Please try again."
      });
    } finally {
      setIsBulkExporting(false);
    }
  }

  // Drag-and-drop handler
  function handleDragEnd(event: DragEndEvent) {
    if (!isManualOrderMode) return;
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = orderedClips.findIndex(clip => clip.id === active.id);
    const newIndex = orderedClips.findIndex(clip => clip.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = [...orderedClips];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);

    setOrderedClips(newOrder);

    // Persist order to backend
    if (projectId) {
      fetch(`/api/projects/${projectId}/clip-order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: newOrder.map(c => c.id) }),
        cache: "no-store"
      }).catch(err => console.error("Failed to persist clip order:", err));
    }
  }

  // Filter and sort clips
  const displayedClips = useMemo(() => {
    let result = [...orderedClips];

    // Apply filters
    if (filterBy !== "all") {
      result = result.filter(clip => {
        const score = clip.viralityScore ?? 0;
        if (filterBy === "high") return score >= 80;
        if (filterBy === "medium") return score >= 60 && score < 80;
        if (filterBy === "low") return score < 60;
        return true;
      });
    }

    // Apply sorting
    if (sortBy === "virality-desc") {
      result.sort((a, b) => (b.viralityScore ?? 0) - (a.viralityScore ?? 0));
    } else if (sortBy === "virality-asc") {
      result.sort((a, b) => (a.viralityScore ?? 0) - (b.viralityScore ?? 0));
    } else if (sortBy === "duration-desc") {
      result.sort((a, b) => (b.endMs - b.startMs) - (a.endMs - a.startMs));
    } else if (sortBy === "duration-asc") {
      result.sort((a, b) => (a.endMs - a.startMs) - (b.endMs - b.startMs));
    } else if (sortBy === "chronological") {
      result.sort((a, b) => a.startMs - b.startMs);
    }

    return result;
  }, [orderedClips, filterBy, sortBy]);

  if (clips.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No clips yet</CardTitle>
          <CardDescription>Run highlight detection to surface candidate clips.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter and Sort Controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem showIndicator value="manual">Manual Order</SelectItem>
                  <SelectItem showIndicator value="virality-desc">Highest Virality</SelectItem>
                  <SelectItem showIndicator value="virality-asc">Lowest Virality</SelectItem>
                  <SelectItem showIndicator value="duration-desc">Longest First</SelectItem>
                  <SelectItem showIndicator value="duration-asc">Shortest First</SelectItem>
                  <SelectItem showIndicator value="chronological">Chronological</SelectItem>
                </SelectContent>
              </Select>
            </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem showIndicator value="all">All Clips ({clips.length})</SelectItem>
                <SelectItem showIndicator value="high">High Score (80+)</SelectItem>
                <SelectItem showIndicator value="medium">Medium (60-79)</SelectItem>
                <SelectItem showIndicator value="low">Low (&lt;60)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Badge variant="outline" className="ml-auto">
            Showing {displayedClips.length} of {clips.length} clips
          </Badge>
        </CardContent>
      </Card>

      {!isManualOrderMode ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Reordering is enabled only in <span className="font-medium">Manual Order</span> with <span className="font-medium">All Clips</span> filter.
        </div>
      ) : null}

      {/* Bulk Actions Bar */}
      {selected.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-3">
            <p className="text-sm font-medium">
              {selected.length} clip{selected.length > 1 ? "s" : ""} selected
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={isBulkGenerating || !!loadingClipId}
                onClick={handleBulkCaptionGeneration}
              >
                {isBulkGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Captions
                  </>
                )}
              </Button>
              {projectId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBulkExporting || !projectId}
                    >
                      {isBulkExporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Export All
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkExport("shorts_9x16_1080")}>
                      Shorts (9:16)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkExport("square_1x1_1080")}>
                      Square (1:1)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkExport("portrait_4x5_1080")}>
                      Portrait Feed (4:5)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkExport("landscape_16x9_1080")}>
                      Landscape (16:9)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clips Grid */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayedClips.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-4">
            {displayedClips.map((clip, index) => (
              <SortableClipCard
                key={clip.id}
                clip={clip}
                index={index}
                isSelected={selected.includes(clip.id)}
                onToggle={toggle}
                onGenerateCaptions={onGenerateCaptions}
                loadingClipId={loadingClipId}
                onPreview={setPreviewClipId}
                onEditCaptions={setEditingCaptionClipId}
                getScoreColor={getScoreColor}
                formatFactorName={formatFactorName}
                dragEnabled={isManualOrderMode}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewClipId} onOpenChange={(open) => {
        if (!open) {
          setPreviewClipId(null);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewClip?.title || "Clip Preview"}</DialogTitle>
            <DialogDescription>
              Preview with captions • {previewClip && formatDuration(previewClip.endMs - previewClip.startMs)}
            </DialogDescription>
          </DialogHeader>
          {previewClip?.previewPath && (
            <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden">
              <video
                src={previewClip.previewPath}
                controls
                autoPlay
                className="w-full h-full"
                key={previewClip.id}
                crossOrigin="anonymous"
              >
                {previewCaptionTrackUrl && (
                  <track
                    kind="captions"
                    src={previewCaptionTrackUrl}
                    srcLang="en"
                    label="English"
                    default
                  />
                )}
              </video>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Caption Editor Dialog */}
      <CaptionEditorDialog
        open={!!editingCaptionClipId}
        onOpenChange={(open) => !open && setEditingCaptionClipId(null)}
        clipId={editingCaptionClipId || ""}
        clipTitle={editingClip?.title}
        previewPath={editingClip?.previewPath}
        captionSrt={editingClip?.captionSrt}
        onSave={onExportQueued || (() => {})}
      />
    </div>
  );
}
