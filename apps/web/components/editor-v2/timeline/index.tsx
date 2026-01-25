"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Slider } from "@/components/ui/slider";
import { bindKeyboardShortcuts } from "@/lib/keyboard";
import { cn } from "@/lib/utils";

export interface TimelineClip {
  id: string;
  label?: string;
  startMs: number;
  endMs: number;
}

export interface TimelineProps {
  clips: TimelineClip[];
  activeClipId?: string;
  readOnly?: boolean;
  onSelect?: (clipId: string) => void;
  onSplit?: (clipId: string, atMs: number) => void;
  onTrim?: (clipId: string, range: { startMs: number; endMs: number }) => void;
}

interface DragState {
  clipId: string;
  type: "start" | "end" | "move";
  startClientX: number;
  initialStartMs: number;
  initialEndMs: number;
}

const BASE_PIXELS_PER_MS = 0.03; // 30ms per pixel

export function Timeline({ clips, activeClipId, readOnly, onSelect, onSplit, onTrim }: TimelineProps) {
  const [zoom, setZoom] = useState(1.2);
  const [playheadMs, setPlayheadMs] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [internalClips, setInternalClips] = useState<TimelineClip[]>(clips);

  const totalDuration = useMemo(() => {
    if (clips.length === 0) return 60_000;
    return Math.max(...clips.map((clip) => clip.endMs));
  }, [clips]);

  useEffect(() => {
    setInternalClips(clips);
  }, [clips]);

  useEffect(() => {
    if (!isPlaying) return;
    let animationFrame: number;
    const start = performance.now();
    const initial = playheadMs;
    const animate = (now: number) => {
      const elapsed = now - start;
      const next = initial + elapsed;
      setPlayheadMs(next >= totalDuration ? 0 : next);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, playheadMs, totalDuration]);

  useEffect(() => {
    const unsubscribe = bindKeyboardShortcuts([
      {
        key: " ",
        description: "Play or pause",
        handler: (event) => {
          event.preventDefault();
          setIsPlaying((state) => !state);
        }
      },
      {
        key: "s",
        description: "Split clip",
        handler: (event) => {
          event.preventDefault();
          const active = activeClipId ?? clips[0]?.id;
          if (active && onSplit) {
            onSplit(active, playheadMs);
          }
        }
      },
      {
        key: "i",
        description: "Set in",
        handler: (event) => {
          event.preventDefault();
          const active = activeClipId ?? clips[0]?.id;
          if (!active || !onTrim) return;
          const current = clips.find((clip) => clip.id === active);
          if (!current) return;
          const newStart = Math.min(playheadMs, current.endMs - 500);
          onTrim(active, { startMs: Math.max(0, newStart), endMs: current.endMs });
        }
      },
      {
        key: "o",
        description: "Set out",
        handler: (event) => {
          event.preventDefault();
          const active = activeClipId ?? clips[0]?.id;
          if (!active || !onTrim) return;
          const current = clips.find((clip) => clip.id === active);
          if (!current) return;
          const newEnd = Math.max(playheadMs, current.startMs + 500);
          onTrim(active, { startMs: current.startMs, endMs: Math.min(totalDuration, newEnd) });
        }
      }
    ]);
    return () => {
      unsubscribe();
    };
  }, [activeClipId, clips, onSplit, onTrim, playheadMs, totalDuration]);

  const pixelsPerMs = BASE_PIXELS_PER_MS * zoom;
  const trackWidth = Math.max(totalDuration * pixelsPerMs, 640);

  const getMsFromPosition = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      return x / pixelsPerMs;
    },
    [pixelsPerMs]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragStateRef.current || readOnly) return;
      const { clipId, type, startClientX, initialStartMs, initialEndMs } = dragStateRef.current;
      const deltaX = event.clientX - startClientX;
      const deltaMs = deltaX / pixelsPerMs;
      const updated = internalClips.map((clip) => {
        if (clip.id !== clipId) return clip;
        let nextStart = clip.startMs;
        let nextEnd = clip.endMs;
        if (type === "start") {
          nextStart = Math.max(0, Math.min(initialStartMs + deltaMs, initialEndMs - 500));
        } else if (type === "end") {
          nextEnd = Math.min(totalDuration, Math.max(initialEndMs + deltaMs, initialStartMs + 500));
        } else if (type === "move") {
          const length = initialEndMs - initialStartMs;
          nextStart = Math.max(0, Math.min(initialStartMs + deltaMs, totalDuration - length));
          nextEnd = nextStart + length;
        }
        return { ...clip, startMs: nextStart, endMs: nextEnd };
      });
      setInternalClips(updated);
    },
    [internalClips, pixelsPerMs, readOnly, totalDuration]
  );

  const handlePointerUp = useCallback(() => {
    const dragState = dragStateRef.current;
    if (!dragState || readOnly) return;
    const updatedClip = internalClips.find((clip) => clip.id === dragState.clipId);
    if (updatedClip && onTrim) {
      onTrim(updatedClip.id, { startMs: updatedClip.startMs, endMs: updatedClip.endMs });
    }
    dragStateRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove, internalClips, onTrim, readOnly]);

  const initiateDrag = useCallback(
    (clip: TimelineClip, type: DragState["type"], event: React.PointerEvent<HTMLSpanElement | HTMLDivElement>) => {
      if (readOnly) return;
      dragStateRef.current = {
        clipId: clip.id,
        type,
        startClientX: event.clientX,
        initialStartMs: clip.startMs,
        initialEndMs: clip.endMs
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, readOnly]
  );

  return (
    <div className="space-y-4" data-testid="timeline-v2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{isPlaying ? "Playing" : "Paused"}</span>
          <span>•</span>
          <span>{formatMs(playheadMs)} / {formatMs(totalDuration)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Zoom</span>
          <Slider
            className="w-32"
            min={0.5}
            max={2.5}
            step={0.1}
            value={[zoom]}
            onValueChange={(values) => setZoom(values[0] ?? 1)}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner">
        <div className="relative min-h-[120px]" style={{ width: trackWidth }} ref={trackRef}>
          <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-muted-foreground/70">
            {Array.from({ length: 6 }).map((_, index) => {
              const markerMs = (totalDuration / 5) * index;
              return (
                <div key={index} className="relative h-full">
                  <span
                    className="absolute top-0 -translate-y-1/2 border-l border-border/60"
                    style={{ left: markerMs * pixelsPerMs, height: "100%" }}
                  />
                  <span className="absolute left-0 top-0 translate-x-1 text-xs">{formatMs(markerMs)}</span>
                </div>
              );
            })}
          </div>
          {internalClips.map((clip) => (
            <TimelineSegment
              key={clip.id}
              clip={clip}
              active={clip.id === activeClipId}
              pixelsPerMs={pixelsPerMs}
              onSelect={() => onSelect?.(clip.id)}
              onDragStart={initiateDrag}
            />
          ))}
          <Playhead left={playheadMs * pixelsPerMs} />
        </div>
      </div>
    </div>
  );
}

function TimelineSegment({
  clip,
  active,
  pixelsPerMs,
  onSelect,
  onDragStart
}: {
  clip: TimelineClip;
  active?: boolean;
  pixelsPerMs: number;
  onSelect?: () => void;
  onDragStart: (clip: TimelineClip, type: DragState["type"], event: React.PointerEvent<HTMLSpanElement | HTMLDivElement>) => void;
}) {
  const width = Math.max((clip.endMs - clip.startMs) * pixelsPerMs, 12);
  const left = clip.startMs * pixelsPerMs;

  return (
    <div
      className={cn(
        "absolute top-8 flex h-16 cursor-pointer items-center rounded-xl border border-border/70 bg-brand-500/10 px-3 text-xs transition",
        active ? "border-brand-500 bg-brand-500/20" : "hover:border-brand-500/60"
      )}
      style={{ left, width }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect?.();
      }}
    >
      <span className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-xl bg-brand-500/40" onPointerDown={(event) => onDragStart(clip, "start", event)} />
      <span className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-xl bg-brand-500/40" onPointerDown={(event) => onDragStart(clip, "end", event)} />
      <div className="relative flex flex-1 flex-col gap-1 px-2">
        <span className="font-medium text-foreground">{clip.label ?? "Clip"}</span>
        <span className="text-[10px] text-muted-foreground">
          {formatMs(clip.startMs)} → {formatMs(clip.endMs)}
        </span>
      </div>
    </div>
  );
}

function Playhead({ left }: { left: number }) {
  return (
    <div className="pointer-events-none absolute top-0 flex h-full items-start" style={{ left }}>
      <div className="relative flex h-full flex-col items-center">
        <div className="h-3 w-3 -translate-y-2 rotate-45 rounded-sm bg-brandAccent-500" />
        <div className="h-full w-px bg-brandAccent-500" />
      </div>
    </div>
  );
}

function formatMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
