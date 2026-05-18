"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Film } from "lucide-react";

import { SafeThumbnailImage } from "@/components/repurpose/safe-thumbnail-image";
import { ReviewStatusBadge } from "@/components/repurpose/quality-indicators";
import { Button } from "@/components/ui/button";
import { cn, formatDuration } from "@/lib/utils";
import type { ClipReviewStatus } from "@/lib/types";

export type V1ClipSortMode = "score" | "newest" | "exportReady";

type TopClipStripClip = {
  id: string;
  title?: string | null;
  thumbnail?: string | null;
  startMs: number;
  endMs: number;
  viralityScore?: number | null;
  createdAt?: string | Date | null;
  reviewStatus?: ClipReviewStatus | null;
};

export function sortV1ClipsForStrip(
  clips: TopClipStripClip[],
  sortMode: V1ClipSortMode,
  getReviewStatus: (clip: TopClipStripClip) => ClipReviewStatus,
) {
  return [...clips].sort((a, b) => {
    if (sortMode === "newest") {
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    }
    if (sortMode === "exportReady") {
      const statusRank = (clip: TopClipStripClip) =>
        getReviewStatus(clip) === "export_ready" ? 1 : 0;
      return statusRank(b) - statusRank(a) || (b.viralityScore ?? 0) - (a.viralityScore ?? 0);
    }
    return (b.viralityScore ?? 0) - (a.viralityScore ?? 0);
  });
}

export function TopClipStrip({
  clips,
  activeClipId,
  selectedClipIds,
  sortMode,
  onSortModeChange,
  getReviewStatus,
  onSelectClip,
}: {
  clips: TopClipStripClip[];
  activeClipId: string;
  selectedClipIds: string[];
  sortMode: V1ClipSortMode;
  onSortModeChange: (mode: V1ClipSortMode) => void;
  getReviewStatus: (clip: TopClipStripClip) => ClipReviewStatus;
  onSelectClip: (id: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeCardRef = useRef<HTMLButtonElement | null>(null);
  const sortedClips = useMemo(
    () => sortV1ClipsForStrip(clips, sortMode, getReviewStatus),
    [clips, getReviewStatus, sortMode],
  );

  useEffect(() => {
    const activeCard = activeCardRef.current;
    if (!activeCard || typeof activeCard.scrollIntoView !== "function") return;
    activeCard.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeClipId, sortMode]);

  const scrollStrip = (direction: -1 | 1) => {
    const strip = stripRef.current;
    if (!strip || typeof strip.scrollBy !== "function") return;
    strip.scrollBy({ left: direction * 320, behavior: "smooth" });
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/55 p-3 shadow-sm shadow-black/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Generated clips</h3>
            <span className="rounded-full border border-border/50 bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground/65">
              {clips.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Pick a clip from the strip, then edit the preview and transcript below.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="clip-strip-sort">
            Sort generated clips
          </label>
          <select
            id="clip-strip-sort"
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as V1ClipSortMode)}
            className="h-9 rounded-xl border border-border/55 bg-background px-3 text-xs font-semibold text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          >
            <option value="score">Best first</option>
            <option value="newest">Newest</option>
            <option value="exportReady">Export ready</option>
          </select>
          <div className="hidden gap-1 sm:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => scrollStrip(-1)}
              aria-label="Scroll clips left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => scrollStrip(1)}
              aria-label="Scroll clips right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative mt-3 min-w-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-card/95 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card/95 to-transparent" />
        <div
          ref={stripRef}
          className="flex min-w-0 snap-x gap-3 overflow-x-auto scroll-smooth px-1 pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin]"
        >
          {sortedClips.map((clip, index) => {
            const isActive = clip.id === activeClipId;
            const isQueued = selectedClipIds.includes(clip.id);
            const duration = clip.endMs - clip.startMs;
            return (
              <button
                key={clip.id}
                ref={isActive ? activeCardRef : null}
                type="button"
                onClick={() => onSelectClip(clip.id)}
                className={cn(
                  "group grid w-[190px] shrink-0 snap-start grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-2xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-[230px] md:w-[260px] lg:w-[280px]",
                  isActive
                    ? "border-primary/60 bg-primary/10 shadow-sm shadow-primary/15"
                    : "border-border/45 bg-background/45 hover:border-border hover:bg-muted/25",
                )}
                aria-pressed={isActive}
                aria-label={`Select ${clip.title || `clip ${index + 1}`}`}
                title={clip.title || `Clip ${index + 1}`}
              >
                <SafeThumbnailImage
                  src={clip.thumbnail}
                  alt={clip.title || `Clip ${index + 1}`}
                  className="h-16 w-16 rounded-xl"
                  fallbackIcon={<Film className="h-5 w-5 text-muted-foreground/25" />}
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="line-clamp-2 text-xs font-semibold leading-4 text-foreground">
                      {clip.title || `Clip ${index + 1}`}
                    </p>
                    {isActive ? (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                        Selected
                      </span>
                    ) : isQueued ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground/65">
                    <span className="rounded-full bg-muted/35 px-2 py-0.5 font-mono">
                      {formatDuration(duration)}
                    </span>
                    {clip.viralityScore != null ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-200">
                        {clip.viralityScore}/100
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <ReviewStatusBadge status={getReviewStatus(clip)} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
