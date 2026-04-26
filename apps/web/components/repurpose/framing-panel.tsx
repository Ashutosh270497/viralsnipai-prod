"use client";

import { useState, useCallback } from "react";
import {
  Crop,
  Loader2,
  RefreshCw,
  User,
  ScanFace,
  RotateCcw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { SmartReframeMode, SmartReframePlan } from "@/lib/media/smart-reframe";

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRAME_MODES: Array<{
  value: SmartReframeMode;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    value: "smart_auto",
    label: "Stable Smart Crop",
    description: "Detect face, fall back to person, then center",
    icon: ScanFace,
  },
  {
    value: "dynamic_auto",
    label: "Dynamic Auto Tracking",
    description: "Smooth crop keyframes from face/person motion",
    icon: ScanFace,
  },
  {
    value: "dynamic_face",
    label: "Dynamic Face Tracking",
    description: "Track the primary face with anti-jitter smoothing",
    icon: ScanFace,
  },
  {
    value: "dynamic_person",
    label: "Dynamic Person Tracking",
    description: "Track the primary person body through movement",
    icon: User,
  },
  {
    value: "smart_face",
    label: "Stable Face Crop",
    description: "Center on detected face only",
    icon: ScanFace,
  },
  {
    value: "smart_person",
    label: "Stable Person Crop",
    description: "Center on detected person body",
    icon: User,
  },
  {
    value: "center_crop",
    label: "Center Crop",
    description: "Geometric center — no detection",
    icon: Crop,
  },
  {
    value: "blurred_background",
    label: "Blurred Background",
    description: "Blur-pad pillarbox (Phase 2)",
    icon: Crop,
  },
];

const STRATEGY_LABELS: Record<string, string> = {
  face_tracking: "Face detected",
  person_tracking: "Person detected",
  center_crop: "Center crop",
  blurred_background: "Blurred bg",
};

const SMOOTHNESS_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

const SUBJECT_POSITION_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "slightly_up", label: "Slightly up" },
  { value: "slightly_down", label: "Slightly down" },
] as const;

const CONFIDENCE_COLOR = (c: number) => {
  if (c >= 0.7) return "text-emerald-400";
  if (c >= 0.4) return "text-amber-400";
  return "text-muted-foreground/50";
};

// ── Component ─────────────────────────────────────────────────────────────────

interface FramingPanelProps {
  clipId: string;
  /** Current SmartReframePlan from clip.viralityFactors.metadata.smartReframe */
  smartReframePlan?: SmartReframePlan | null;
  /** Called after successful re-analysis so the parent can refresh clip data */
  onAnalysisComplete: () => void;
}

export function FramingPanel({ clipId, smartReframePlan, onAnalysisComplete }: FramingPanelProps) {
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState<SmartReframeMode>(
    (smartReframePlan?.mode === "dynamic" && smartReframePlan.strategy === "face_tracking"
      ? "dynamic_face"
      : smartReframePlan?.mode === "dynamic" && smartReframePlan.strategy === "person_tracking"
      ? "dynamic_person"
      : smartReframePlan?.strategy === "face_tracking"
      ? "smart_face"
      : smartReframePlan?.strategy === "person_tracking"
      ? "smart_person"
      : smartReframePlan?.strategy === "center_crop"
      ? "center_crop"
      : "smart_auto") as SmartReframeMode
  );
  const [trackingSmoothness, setTrackingSmoothness] = useState<"low" | "medium" | "high">(
    smartReframePlan?.smoothing ?? "medium"
  );
  const [subjectPosition, setSubjectPosition] = useState<"center" | "slightly_up" | "slightly_down">(
    smartReframePlan?.subjectPosition ?? "center"
  );
  const [showTrackingOverlay, setShowTrackingOverlay] = useState(false);
  const [showSafeZoneOverlay, setShowSafeZoneOverlay] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = useCallback(
    async (mode: SmartReframeMode = selectedMode) => {
      setIsAnalyzing(true);
      try {
        const endpoint = mode.startsWith("dynamic_")
          ? `/api/clips/${clipId}/reframe/analyze-dynamic`
          : `/api/clips/${clipId}/reframe/analyze`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            trackingSmoothness,
            subjectPosition,
            captionSafeZoneEnabled: true,
          }),
          cache: "no-store",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Analysis failed");
        }

        toast({
          title: "Framing updated",
          description: "Smart reframe plan has been saved for this clip.",
        });
        onAnalysisComplete();
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Analysis failed",
          description: err instanceof Error ? err.message : "Could not run smart reframe analysis.",
        });
      } finally {
        setIsAnalyzing(false);
      }
    },
    [clipId, selectedMode, trackingSmoothness, subjectPosition, onAnalysisComplete, toast]
  );

  const handleResetToCenter = useCallback(async () => {
    setSelectedMode("center_crop");
    await handleAnalyze("center_crop");
  }, [handleAnalyze]);

  return (
    <div className="space-y-4">
      {/* Current plan status */}
      {smartReframePlan ? (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Current framing
            </p>
            <Badge
              variant="secondary"
              className={cn("text-[10px]", CONFIDENCE_COLOR(smartReframePlan.confidence))}
            >
              {smartReframePlan.mode === "dynamic" ? "Dynamic" : "Stable"} · {STRATEGY_LABELS[smartReframePlan.strategy] ?? smartReframePlan.strategy}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground/50 text-[10px] mb-0.5">Confidence</p>
              <p className={cn("font-semibold tabular-nums", CONFIDENCE_COLOR(smartReframePlan.confidence))}>
                {smartReframePlan.confidence > 0
                  ? `${(smartReframePlan.confidence * 100).toFixed(0)}%`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground/50 text-[10px] mb-0.5">Frames sampled</p>
              <p className="font-medium tabular-nums text-foreground/70">
                {smartReframePlan.sampledFrames}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground/50 text-[10px] mb-0.5">Face detections</p>
              <p className="font-medium tabular-nums text-foreground/70">
                {smartReframePlan.faceDetections}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground/50 text-[10px] mb-0.5">Crop keyframes</p>
              <p className="font-medium tabular-nums text-foreground/70">
                {smartReframePlan.cropPath?.length ?? 0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground/50 text-[10px] mb-0.5">Person detections</p>
              <p className="font-medium tabular-nums text-foreground/70">
                {smartReframePlan.personDetections}
              </p>
            </div>
          </div>

          {smartReframePlan.fallbackReason && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-400/80">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{smartReframePlan.fallbackReason}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-5 text-center">
          <Crop className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/60">No framing analysis yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground/40">
            Run analysis to center the speaker in your vertical clip.
          </p>
        </div>
      )}

      {/* Mode selector */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Reframe mode
        </p>
        <div className="space-y-1.5">
          {REFRAME_MODES.map((m) => {
            const Icon = m.icon;
            const isSelected = selectedMode === m.value;
            const isDisabled = m.value === "blurred_background"; // Phase 2

            return (
              <button
                key={m.value}
                disabled={isDisabled}
                onClick={() => setSelectedMode(m.value)}
                className={cn(
                  "w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors",
                  isSelected
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/40 bg-muted/20 hover:bg-muted/40",
                  isDisabled && "opacity-40 cursor-not-allowed"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", isSelected ? "text-primary" : "text-muted-foreground/50")} />
                <div className="min-w-0">
                  <p className={cn("font-medium", isSelected ? "text-foreground" : "text-foreground/70")}>
                    {m.label}
                    {isDisabled && (
                      <span className="ml-2 text-[9px] text-muted-foreground/40">(Phase 2)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{m.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Tracking smoothness
          </p>
          <div className="flex flex-wrap gap-2">
            {SMOOTHNESS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTrackingSmoothness(option.value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  trackingSmoothness === option.value
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Subject position
          </p>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_POSITION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSubjectPosition(option.value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  subjectPosition === option.value
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowTrackingOverlay((value) => !value)}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            showTrackingOverlay ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/40 bg-muted/20 text-muted-foreground"
          )}
        >
          Tracking overlay {showTrackingOverlay ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={() => setShowSafeZoneOverlay((value) => !value)}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            showSafeZoneOverlay ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/40 bg-muted/20 text-muted-foreground"
          )}
        >
          Safe-zone overlay {showSafeZoneOverlay ? "on" : "off"}
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => handleAnalyze()}
          disabled={isAnalyzing}
          className="flex-1 gap-1.5 text-xs"
          size="sm"
        >
          {isAnalyzing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {isAnalyzing ? "Analyzing..." : selectedMode.startsWith("dynamic_") ? "Re-analyze dynamic tracking" : "Re-analyze framing"}
        </Button>

        <Button
          onClick={handleResetToCenter}
          disabled={isAnalyzing}
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          title="Reset to center crop"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground/35 leading-relaxed">
        Analysis samples frames from the clip, detects faces/persons, and shifts the 9:16 crop window to keep the speaker centered. Applied to the next export.
      </p>
    </div>
  );
}
