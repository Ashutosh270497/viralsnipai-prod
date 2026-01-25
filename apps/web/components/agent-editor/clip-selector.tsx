"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface Clip {
  id: string;
  title: string | null;
  summary: string | null;
  startMs: number;
  endMs: number;
  thumbnail: string | null;
}

export function ClipSelector({
  clips,
  selectedClipId,
  onSelectClip,
  isLoading
}: {
  clips: Clip[];
  selectedClipId?: string;
  onSelectClip: (clipId: string) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <Label className="text-sm font-semibold tracking-tight">Clip</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="space-y-2.5">
        <Label className="text-sm font-semibold tracking-tight">Clip</Label>
        <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 p-6 text-center">
          <p className="text-xs font-semibold text-foreground">No clips found</p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Generate clips in RepurposeOS first
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold tracking-tight">
        Select clip to enhance
      </Label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((clip) => {
          const isSelected = clip.id === selectedClipId;
          const duration = (clip.endMs - clip.startMs) / 1000;

          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => onSelectClip(clip.id)}
              className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                isSelected
                  ? "border-violet-500 shadow-lg ring-2 ring-violet-200 dark:ring-violet-800"
                  : "border-border/40 hover:border-violet-300 hover:shadow-md"
              }`}
            >
              <div className="aspect-video w-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                {clip.thumbnail ? (
                  <img
                    src={clip.thumbnail}
                    alt={clip.title ?? "Clip thumbnail"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground/50">
                    <span className="text-xs">No thumbnail</span>
                  </div>
                )}
              </div>
              <div className="bg-card p-3 text-left">
                <h4 className="text-xs font-semibold line-clamp-1">
                  {clip.title || `Clip ${clip.id.slice(0, 8)}`}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {duration.toFixed(1)}s
                </p>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 rounded-full bg-violet-600 p-1 shadow-lg">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
