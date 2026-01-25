"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type AspectKey = "9:16" | "1:1" | "16:9";

const ASPECT_OPTIONS: Array<{ key: AspectKey; label: string; ratio: number }> = [
  { key: "9:16", label: "Vertical", ratio: 9 / 16 },
  { key: "1:1", label: "Square", ratio: 1 },
  { key: "16:9", label: "Landscape", ratio: 16 / 9 }
];

export interface PreviewCanvasProps {
  asset?: {
    path: string;
    durationSec?: number | null;
  } | null;
  selectedClip?: {
    startMs: number;
    endMs: number;
    title?: string | null;
  } | null;
  initialAspect?: AspectKey;
}

export function PreviewCanvas({ asset, selectedClip, initialAspect = "9:16" }: PreviewCanvasProps) {
  const [aspect, setAspect] = useState<AspectKey>(initialAspect);
  const aspectRatio = useMemo(() => ASPECT_OPTIONS.find((opt) => opt.key === aspect)?.ratio ?? 9 / 16, [aspect]);

  // Get max width based on aspect ratio to prevent layout shifts
  const maxWidth = useMemo(() => {
    if (aspect === "16:9") return "854px"; // Landscape (matches vertical height of 480px)
    if (aspect === "1:1") return "480px"; // Square
    return "480px"; // Vertical (9:16)
  }, [aspect]);

  return (
    <div className="space-y-4" data-testid="preview-canvas">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-xs text-muted-foreground">
            Safe areas show where captions and overlays will render across platforms.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {ASPECT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setAspect(option.key)}
              className={cn(
                "rounded-full border px-3 py-1 transition",
                option.key === aspect
                  ? "border-brand-500 bg-brand-500/15 text-brand-500"
                  : "border-border hover:border-brand-500/40"
              )}
              aria-pressed={option.key === aspect}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="relative flex w-full items-center justify-center overflow-hidden rounded-[28px] border border-border/60 bg-secondary/40 shadow-md transition-all duration-300"
        style={{ aspectRatio, maxWidth }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-[24px] border border-border/50 bg-black"
        >
          {asset?.path ? (
            <video src={asset.path} controls className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Upload an asset to preview
            </div>
          )}
          <SafeAreaGuides aspect={aspect} />
          {selectedClip ? (
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/60 px-4 py-2 text-xs text-white">
              <p className="font-semibold">{selectedClip.title ?? "Selected clip"}</p>
              <p className="text-[10px] text-white/70">
                {formatMs(selectedClip.startMs)} → {formatMs(selectedClip.endMs)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SafeAreaGuides({ aspect }: { aspect: AspectKey }) {
  const classes = {
    "9:16": "border-brand-500/40",
    "1:1": "border-brandAccent-500/50",
    "16:9": "border-brand-500/30"
  } as const;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className={cn("h-[92%] w-[92%] rounded-[18px] border border-dashed", classes[aspect])} />
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
