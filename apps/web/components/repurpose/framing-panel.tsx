"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Crop,
  Loader2,
  RefreshCw,
  User,
  ScanFace,
  RotateCcw,
  Info,
  Sparkles,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { SmartReframeMode, SmartReframePlan, CropKeyframe } from "@/lib/media/smart-reframe";
import {
  ASPECT_RATIO_PRESETS,
  LAYOUT_PRESETS,
  buildCenteredCropBox,
  normalizeClipLayoutConfig,
  normalizeCropBox,
  type ClipLayoutConfig,
  type LayoutAspectRatio,
  type LayoutPreset,
} from "@/lib/repurpose/layout-config";

// ── Reframe mode definitions ──────────────────────────────────────────────────

type ModeDefinition = {
  value: SmartReframeMode;
  label: string;
  description: string;
  icon: React.ElementType;
  premium: boolean;
};

const REFRAME_MODES: ModeDefinition[] = [
  { value: "smart_auto",     label: "Stable Smart Crop",       description: "Detect face → person → center; one stable window",    icon: ScanFace, premium: false },
  { value: "dynamic_auto",   label: "Dynamic Auto Tracking",   description: "Smooth keyframed crop that follows face/person motion",icon: ScanFace, premium: true  },
  { value: "dynamic_face",   label: "Dynamic Face Tracking",   description: "Track the primary face with anti-jitter smoothing",   icon: ScanFace, premium: true  },
  { value: "dynamic_person", label: "Dynamic Person Tracking", description: "Track the primary person body through movement",       icon: User,     premium: true  },
  { value: "smart_face",     label: "Stable Face Crop",        description: "Center on detected face; single stable crop window",  icon: ScanFace, premium: false },
  { value: "smart_person",   label: "Stable Person Crop",      description: "Center on detected person; single stable crop window",icon: User,     premium: false },
  { value: "center_crop",    label: "Center Crop",             description: "Geometric center — no detection needed",              icon: Crop,     premium: false },
  { value: "blurred_background", label: "Blurred Background",  description: "Blur-pad pillarbox (coming in renderer polish)",       icon: Crop,     premium: true  },
];

const STRATEGY_LABELS: Record<string, string> = {
  face_tracking:     "Face detected",
  person_tracking:   "Person detected",
  center_crop:       "Center crop",
  blurred_background:"Blurred bg",
};

const SMOOTHNESS_OPTIONS = [
  { value: "low",    label: "Low"    },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High"   },
] as const;

const SUBJECT_POSITION_OPTIONS = [
  { value: "center",        label: "Center"       },
  { value: "slightly_up",   label: "Slightly up"  },
  { value: "slightly_down", label: "Slightly down"},
] as const;

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.7 ? "text-emerald-400" : c >= 0.4 ? "text-amber-400" : "text-muted-foreground/50";

const ASPECT_OPTIONS: LayoutAspectRatio[] = ["9:16", "1:1", "4:5", "16:9", "original"];
const LAYOUT_OPTIONS: LayoutPreset[] = [
  "full_screen_crop",
  "center_crop",
  "speaker_focus",
  "split_screen",
  "podcast_two_speaker",
  "screen_share_speaker",
  "picture_in_picture",
  "square_letterbox",
  "manual_crop",
];

function getSourceAspectRatio(sourceWidth?: number | null, sourceHeight?: number | null) {
  if (sourceWidth && sourceHeight && sourceWidth > 0 && sourceHeight > 0) {
    return sourceWidth / sourceHeight;
  }
  return 16 / 9;
}

function buildDefaultLayoutConfig(params: {
  layoutConfig?: ClipLayoutConfig | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
}) {
  const sourceAspectRatio = getSourceAspectRatio(params.sourceWidth, params.sourceHeight);
  return normalizeClipLayoutConfig(
    params.layoutConfig ?? {
      preset: "center_crop",
      aspectRatio: "9:16",
      cropBox: buildCenteredCropBox("9:16", sourceAspectRatio),
      backgroundMode: "crop",
      blurBackground: false,
      borderRadius: 0,
      padding: 0,
      safeZones: { top: 0.1, bottom: 0.2, left: 0.08, right: 0.08 },
      reframeConfidence: "medium",
      reason: "Center crop default for vertical short-form delivery.",
    }
  );
}

function LayoutCropPreview({
  thumbnail,
  layout,
  sourceWidth,
  sourceHeight,
}: {
  thumbnail?: string | null;
  layout: ClipLayoutConfig;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
}) {
  const sourceAspectRatio = getSourceAspectRatio(sourceWidth, sourceHeight);
  const crop = normalizeCropBox(layout.cropBox, buildCenteredCropBox(layout.aspectRatio, sourceAspectRatio));
  const previewRatio = ASPECT_RATIO_PRESETS[layout.aspectRatio].ratio ?? sourceAspectRatio;

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
      <div className="relative overflow-hidden rounded-lg bg-zinc-950" style={{ aspectRatio: `${sourceAspectRatio}` }}>
        {thumbnail ? (
          <Image src={thumbnail} alt="Manual crop preview" fill className="object-cover opacity-70" unoptimized />
        ) : (
          <div className="absolute inset-0 bg-zinc-800" />
        )}
        <div className="absolute inset-0 bg-black/45" />
        <div
          className="absolute border-2 border-cyan-400 bg-cyan-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.52)]"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.width * 100}%`,
            height: `${crop.height * 100}%`,
          }}
        >
          <div className="absolute inset-x-0 bottom-[20%] border-t border-red-400/70 border-dashed" />
          <div className="absolute inset-x-0 top-[10%] border-t border-amber-300/60 border-dashed" />
        </div>
      </div>
      <div className="relative mx-auto h-40 overflow-hidden rounded-xl border border-border/50 bg-zinc-950" style={{ aspectRatio: `${previewRatio}` }}>
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt="Output frame"
            fill
            className="object-cover"
            style={{
              width: `${100 / crop.width}%`,
              height: `${100 / crop.height}%`,
              left: `${(-crop.x / crop.width) * 100}%`,
              top: `${(-crop.y / crop.height) * 100}%`,
              maxWidth: "none",
            }}
            unoptimized
          />
        ) : null}
        <div className="absolute inset-x-2 bottom-[18%] rounded border border-red-400/50" />
        <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-semibold text-white/80">
          {layout.aspectRatio}
        </div>
      </div>
    </div>
  );
}

// ── Crop window preview ───────────────────────────────────────────────────────

function CropWindowPreview({
  thumbnail,
  plan,
  showTrackingOverlay,
  showSafeZoneOverlay,
}: {
  thumbnail?: string | null;
  plan: SmartReframePlan;
  showTrackingOverlay: boolean;
  showSafeZoneOverlay: boolean;
}) {
  const { sourceWidth, sourceHeight, cropWindow, safeZone, cropPath } = plan;
  if (!sourceWidth || !sourceHeight) return null;

  // Use source dimensions as the SVG coordinate system — no unit conversions needed
  const vbW = sourceWidth;
  const vbH = sourceHeight;
  const { x: cx, y: cy, width: cw, height: ch } = cropWindow;

  // Safe zone bands inside the crop window (in source pixels)
  const safeTopH   = ch * (safeZone?.topPct    ?? 0.10);
  const safeBottomY = cy + ch * (1 - (safeZone?.bottomPct ?? 0.20));
  const safeBottomH = ch * (safeZone?.bottomPct ?? 0.20);

  return (
    <div className="space-y-1.5">
      <div
        className="relative overflow-hidden rounded-lg bg-zinc-950"
        style={{ aspectRatio: `${vbW}/${vbH}` }}
      >
        {/* Thumbnail background */}
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt="Clip frame"
            fill
            className={cn("object-cover", showTrackingOverlay || showSafeZoneOverlay ? "opacity-55" : "opacity-80")}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-800" />
        )}

        {/* SVG overlay */}
        {(showTrackingOverlay || showSafeZoneOverlay) && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={`0 0 ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {showTrackingOverlay && (
              <>
                {/* Darken area outside crop window */}
                <defs>
                  <mask id="crop-cutout">
                    <rect x="0" y="0" width={vbW} height={vbH} fill="white" />
                    <rect x={cx} y={cy} width={cw} height={ch} fill="black" />
                  </mask>
                </defs>
                <rect x="0" y="0" width={vbW} height={vbH} fill="rgba(0,0,0,0.62)" mask="url(#crop-cutout)" />
                {/* Crop window border */}
                <rect x={cx} y={cy} width={cw} height={ch} fill="none" stroke="#3b82f6" strokeWidth={vbW * 0.004} />
                {/* Corner ticks */}
                {[
                  [cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch],
                ].map(([rx, ry], i) => (
                  <g key={i}>
                    <rect
                      x={i % 2 === 0 ? rx : rx - vbW * 0.02}
                      y={i < 2 ? ry : ry - vbH * 0.015}
                      width={vbW * 0.02}
                      height={vbH * 0.004}
                      fill="#3b82f6"
                    />
                    <rect
                      x={i % 2 === 0 ? rx : rx - vbW * 0.004}
                      y={i < 2 ? ry : ry - vbH * 0.015}
                      width={vbW * 0.004}
                      height={vbH * 0.015}
                      fill="#3b82f6"
                    />
                  </g>
                ))}

                {/* Crop path keyframes */}
                {Array.isArray(cropPath) && cropPath.length > 1 && (
                  <>
                    <polyline
                      points={cropPath.map((kf: CropKeyframe) =>
                        `${kf.x + kf.width / 2},${kf.y + kf.height / 2}`
                      ).join(" ")}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={vbW * 0.002}
                      strokeDasharray={`${vbW * 0.008} ${vbW * 0.006}`}
                      opacity="0.6"
                    />
                    {cropPath.map((kf: CropKeyframe, i: number) => {
                      const color = kf.detectionType === "interpolated" ? "#f59e0b" :
                                    kf.detectionType === "fallback"      ? "#ef4444" : "#3b82f6";
                      return (
                        <circle
                          key={i}
                          cx={kf.x + kf.width / 2}
                          cy={kf.y + kf.height / 2}
                          r={vbW * 0.006}
                          fill={color}
                          opacity="0.85"
                        />
                      );
                    })}
                  </>
                )}
              </>
            )}

            {/* Safe zone bands */}
            {showSafeZoneOverlay && (
              <>
                <rect x={cx} y={cy} width={cw} height={safeTopH} fill="rgba(251,191,36,0.30)" />
                <rect x={cx} y={safeBottomY} width={cw} height={safeBottomH} fill="rgba(239,68,68,0.30)" />
                {/* Caption zone label line */}
                <line
                  x1={cx} y1={safeBottomY} x2={cx + cw} y2={safeBottomY}
                  stroke="#ef4444" strokeWidth={vbW * 0.002} strokeDasharray={`${vbW * 0.01} ${vbW * 0.006}`} opacity="0.7"
                />
              </>
            )}
          </svg>
        )}

        {/* Floating labels */}
        <div className="absolute bottom-1 left-1 flex gap-1 flex-wrap pointer-events-none">
          {showTrackingOverlay && (
            <span className="text-[8px] rounded bg-blue-500/80 px-1.5 py-0.5 text-white font-medium">
              Crop
            </span>
          )}
          {showTrackingOverlay && Array.isArray(cropPath) && cropPath.length > 1 && (
            <span className="text-[8px] rounded bg-blue-400/70 px-1.5 py-0.5 text-white font-medium">
              {cropPath.length} keyframes
            </span>
          )}
          {showSafeZoneOverlay && (
            <span className="text-[8px] rounded bg-red-500/70 px-1.5 py-0.5 text-white font-medium">
              Caption zone
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      {(showTrackingOverlay || showSafeZoneOverlay) && Array.isArray(cropPath) && cropPath.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <LegendDot color="bg-blue-500" label="Detected" />
          <LegendDot color="bg-amber-400" label="Interpolated" />
          <LegendDot color="bg-red-400" label="Fallback" />
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn("h-2 w-2 rounded-full", color)} />
      <span className="text-[9px] text-muted-foreground/60">{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface FramingPanelProps {
  clipId: string;
  expectedVersion: number;
  /** Thumbnail image URL for the crop window preview. */
  thumbnail?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  /** Current SmartReframePlan from clip.viralityFactors.metadata.smartReframe */
  smartReframePlan?: SmartReframePlan | null;
  layoutConfig?: ClipLayoutConfig | null;
  selectedClipCount?: number;
  /** Whether this user is on a paid plan (enables dynamic tracking modes). */
  isPremium?: boolean;
  /** Called after successful re-analysis so the parent can refresh clip data */
  onAnalysisComplete: () => void;
  onApplyLayoutToSelected?: (layout: ClipLayoutConfig) => Promise<void>;
}

export function FramingPanel({
  clipId,
  expectedVersion,
  thumbnail,
  sourceWidth,
  sourceHeight,
  smartReframePlan,
  layoutConfig,
  selectedClipCount = 0,
  isPremium = false,
  onAnalysisComplete,
  onApplyLayoutToSelected,
}: FramingPanelProps) {
  const { toast } = useToast();
  const [layout, setLayout] = useState<ClipLayoutConfig>(() =>
    buildDefaultLayoutConfig({ layoutConfig, sourceWidth, sourceHeight })
  );

  const [selectedMode, setSelectedMode] = useState<SmartReframeMode>(() => {
    if (!smartReframePlan) return "smart_auto";
    if (smartReframePlan.mode === "dynamic") {
      return smartReframePlan.strategy === "face_tracking" ? "dynamic_face"
           : smartReframePlan.strategy === "person_tracking" ? "dynamic_person"
           : "dynamic_auto";
    }
    return smartReframePlan.strategy === "face_tracking"   ? "smart_face"
         : smartReframePlan.strategy === "person_tracking" ? "smart_person"
         : smartReframePlan.strategy === "center_crop"     ? "center_crop"
         : "smart_auto";
  });

  const [trackingSmoothness, setTrackingSmoothness] = useState<"low" | "medium" | "high">(
    smartReframePlan?.smoothing ?? "medium"
  );
  const [subjectPosition, setSubjectPosition] = useState<"center" | "slightly_up" | "slightly_down">(
    smartReframePlan?.subjectPosition ?? "center"
  );
  const [showTrackingOverlay, setShowTrackingOverlay] = useState(Boolean(smartReframePlan));
  const [showSafeZoneOverlay, setShowSafeZoneOverlay] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  useEffect(() => {
    setLayout(buildDefaultLayoutConfig({ layoutConfig, sourceWidth, sourceHeight }));
  }, [clipId, layoutConfig, sourceWidth, sourceHeight]);

  const isDynamic = selectedMode.startsWith("dynamic_");
  const isBlurred = selectedMode === "blurred_background";
  const requiresPremium = REFRAME_MODES.find((m) => m.value === selectedMode)?.premium ?? false;

  const handleAnalyze = useCallback(
    async (mode: SmartReframeMode = selectedMode) => {
      const modeRequiresPremium = REFRAME_MODES.find((m) => m.value === mode)?.premium ?? false;
      if (modeRequiresPremium && !isPremium) {
        toast({
          title: "Pro feature",
          description: "Dynamic tracking and blurred background are available on Creator and Studio plans.",
        });
        return;
      }
      if (mode === "blurred_background") {
        toast({ title: "Coming soon", description: "Blurred background export is planned for renderer polish." });
        return;
      }

      setIsAnalyzing(true);
      try {
        // All modes — stable and dynamic — share one endpoint.
        const res = await fetch(`/api/clips/${clipId}/reframe/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, trackingSmoothness, subjectPosition, captionSafeZoneEnabled: true }),
          cache: "no-store",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Analysis failed");
        }

        toast({ title: "Framing updated", description: "Smart reframe plan saved for this clip." });
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
    [clipId, selectedMode, trackingSmoothness, subjectPosition, isPremium, onAnalysisComplete, toast]
  );

  const handleResetToCenter = useCallback(async () => {
    setSelectedMode("center_crop");
    await handleAnalyze("center_crop");
  }, [handleAnalyze]);

  const patchLayout = useCallback(
    async (nextLayout: ClipLayoutConfig) => {
      setIsSavingLayout(true);
      try {
        const normalized = normalizeClipLayoutConfig(nextLayout);
        const res = await fetch(`/api/clips/${clipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion,
            layoutPreset: normalized.preset,
            aspectRatio: normalized.aspectRatio,
            layoutConfig: normalized,
          }),
          cache: "no-store",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? body?.message ?? "Could not save layout");
        }

        toast({ title: "Layout saved", description: "This clip will export with the selected crop and ratio." });
        onAnalysisComplete();
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Layout not saved",
          description: err instanceof Error ? err.message : "Refresh and try again.",
        });
      } finally {
        setIsSavingLayout(false);
      }
    },
    [clipId, expectedVersion, onAnalysisComplete, toast]
  );

  const updateLayout = useCallback(
    (patch: Partial<ClipLayoutConfig>) => {
      setLayout((current) => {
        const next = normalizeClipLayoutConfig({ ...current, ...patch });
        if (patch.aspectRatio && patch.aspectRatio !== current.aspectRatio) {
          next.cropBox = buildCenteredCropBox(
            patch.aspectRatio,
            getSourceAspectRatio(sourceWidth, sourceHeight)
          );
        }
        if (patch.preset && patch.preset !== current.preset) {
          next.reframeConfidence = LAYOUT_PRESETS[patch.preset].confidence;
          next.reason = LAYOUT_PRESETS[patch.preset].description;
          if (patch.preset === "square_letterbox") {
            next.aspectRatio = "1:1";
            next.backgroundMode = "letterbox";
            next.cropBox = buildCenteredCropBox("1:1", getSourceAspectRatio(sourceWidth, sourceHeight));
          } else if (patch.preset === "manual_crop") {
            next.backgroundMode = "crop";
          }
        }
        return next;
      });
    },
    [sourceHeight, sourceWidth]
  );

  const handleSaveLayout = useCallback(() => patchLayout(layout), [layout, patchLayout]);

  const handleApplyToSelected = useCallback(async () => {
    if (!onApplyLayoutToSelected || selectedClipCount === 0) {
      toast({ variant: "destructive", title: "Select clips first" });
      return;
    }
    setIsSavingLayout(true);
    try {
      await onApplyLayoutToSelected(normalizeClipLayoutConfig(layout));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Layout not applied",
        description: err instanceof Error ? err.message : "Refresh and try again.",
      });
    } finally {
      setIsSavingLayout(false);
    }
  }, [layout, onApplyLayoutToSelected, selectedClipCount, toast]);

  const handleResetLayout = useCallback(() => {
    setLayout(buildDefaultLayoutConfig({ sourceWidth, sourceHeight }));
  }, [sourceHeight, sourceWidth]);

  return (
    <div className="space-y-4">
      {/* ── Current plan status ──────────────────────────────────────────── */}
      {smartReframePlan ? (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Current framing
            </p>
            <Badge variant="secondary" className={cn("text-[10px]", CONFIDENCE_COLOR(smartReframePlan.confidence))}>
              {smartReframePlan.mode === "dynamic" ? "Dynamic" : "Stable"} · {STRATEGY_LABELS[smartReframePlan.strategy] ?? smartReframePlan.strategy}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Confidence"     value={smartReframePlan.confidence > 0 ? `${(smartReframePlan.confidence * 100).toFixed(0)}%` : "N/A"} highlight={CONFIDENCE_COLOR(smartReframePlan.confidence)} />
            <Stat label="Frames"         value={String(smartReframePlan.sampledFrames)} />
            <Stat label="Keyframes"      value={String(smartReframePlan.cropPath?.length ?? 0)} />
            <Stat label="Face detections"   value={String(smartReframePlan.faceDetections)} />
            <Stat label="Person detections" value={String(smartReframePlan.personDetections)} />
            {smartReframePlan.smoothing && <Stat label="Smoothing" value={smartReframePlan.smoothing} />}
          </div>

          {smartReframePlan.fallbackReason && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-400/80">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{smartReframePlan.fallbackReason}</span>
            </div>
          )}

          {/* Crop window / safe-zone visual preview */}
          {(showTrackingOverlay || showSafeZoneOverlay) && (
            <CropWindowPreview
              thumbnail={thumbnail}
              plan={smartReframePlan}
              showTrackingOverlay={showTrackingOverlay}
              showSafeZoneOverlay={showSafeZoneOverlay}
            />
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-5 text-center">
          <Crop className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/60">No framing analysis yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground/40">
            Run analysis to center the speaker in the 9:16 crop.
          </p>
        </div>
      )}

      {/* ── Layout preset and aspect ratio ──────────────────────────────── */}
      <div className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Layout engine
            </p>
            <p className="mt-1 text-xs text-muted-foreground/55">
              Choose the platform frame and crop that preview/export should use.
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {LAYOUT_PRESETS[layout.preset].label}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Aspect ratio
            </span>
            <select
              value={layout.aspectRatio}
              onChange={(event) => updateLayout({ aspectRatio: event.target.value as LayoutAspectRatio })}
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground"
            >
              {ASPECT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {ASPECT_RATIO_PRESETS[option].label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Layout preset
            </span>
            <select
              value={layout.preset}
              onChange={(event) => updateLayout({ preset: event.target.value as LayoutPreset })}
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground"
            >
              {LAYOUT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {LAYOUT_PRESETS[option].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <LayoutCropPreview
          thumbnail={thumbnail}
          layout={layout}
          sourceWidth={sourceWidth}
          sourceHeight={sourceHeight}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["x", "Crop X"],
            ["y", "Crop Y"],
            ["width", "Crop width"],
            ["height", "Crop height"],
          ] as const).map(([key, label]) => (
            <label key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/50">
                  {(layout.cropBox[key] * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={key === "width" || key === "height" ? 8 : 0}
                max={100}
                step={1}
                value={Math.round(layout.cropBox[key] * 100)}
                onChange={(event) => {
                  const value = Number(event.target.value) / 100;
                  updateLayout({
                    preset: "manual_crop",
                    cropBox: normalizeCropBox({ ...layout.cropBox, [key]: value }),
                  });
                }}
                className="w-full accent-primary"
              />
            </label>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            onClick={handleSaveLayout}
            disabled={isSavingLayout}
            className="gap-1.5 text-xs"
            size="sm"
          >
            {isSavingLayout ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save layout
          </Button>
          <Button
            type="button"
            onClick={handleApplyToSelected}
            disabled={isSavingLayout || selectedClipCount === 0}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
          >
            Apply to selected{selectedClipCount > 0 ? ` (${selectedClipCount})` : ""}
          </Button>
          <Button
            type="button"
            onClick={handleResetLayout}
            disabled={isSavingLayout}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset layout
          </Button>
        </div>
      </div>

      {/* ── Overlay toggles ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {(["tracking", "safeZone"] as const).map((key) => {
          const isOn   = key === "tracking" ? showTrackingOverlay : showSafeZoneOverlay;
          const label  = key === "tracking" ? "Crop overlay" : "Safe-zone overlay";
          const toggle = () => key === "tracking" ? setShowTrackingOverlay((v) => !v) : setShowSafeZoneOverlay((v) => !v);
          return (
            <button
              key={key}
              type="button"
              onClick={toggle}
              disabled={!smartReframePlan}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                isOn
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/40 bg-muted/20 text-muted-foreground/70",
                !smartReframePlan && "opacity-40 cursor-not-allowed"
              )}
            >
              {label} {isOn ? "on" : "off"}
            </button>
          );
        })}
      </div>

      {/* ── Reframe mode selector ────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Reframe mode
        </p>
        <div className="space-y-1.5">
          {REFRAME_MODES.map((m) => {
            const Icon       = m.icon;
            const isSelected = selectedMode === m.value;
            const blocked    = m.value === "blurred_background";
            const locked     = m.premium && !isPremium;

            return (
              <button
                key={m.value}
                disabled={blocked}
                onClick={() => setSelectedMode(m.value)}
                className={cn(
                  "w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors",
                  isSelected
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/40 bg-muted/20 hover:bg-muted/40",
                  blocked && "opacity-40 cursor-not-allowed"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", isSelected ? "text-primary" : "text-muted-foreground/50")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={cn("font-medium", isSelected ? "text-foreground" : "text-foreground/70")}>
                      {m.label}
                    </p>
                    {blocked && <span className="text-[9px] text-muted-foreground/40">(Coming soon)</span>}
                    {m.premium && !blocked && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                        isPremium
                          ? "bg-violet-500/15 text-violet-400"
                          : "bg-muted/60 text-muted-foreground/50"
                      )}>
                        <Sparkles className="h-2.5 w-2.5" />
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{m.description}</p>
                  {locked && isSelected && (
                    <p className="text-[10px] text-amber-400/80 mt-1">
                      Upgrade to Creator or Studio to export with dynamic tracking.
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tracking config (only for dynamic modes) ────────────────────── */}
      {isDynamic && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Tracking smoothness
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SMOOTHNESS_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setTrackingSmoothness(opt.value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    trackingSmoothness === opt.value
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Subject position
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECT_POSITION_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setSubjectPosition(opt.value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    subjectPosition === opt.value
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => handleAnalyze()} disabled={isAnalyzing} className="flex-1 gap-1.5 text-xs" size="sm">
          {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {isAnalyzing
            ? "Analyzing…"
            : requiresPremium && !isPremium
              ? "Upgrade to analyze"
              : isDynamic
                ? "Re-analyze dynamic tracking"
                : "Re-analyze framing"}
        </Button>
        <Button onClick={handleResetToCenter} disabled={isAnalyzing} variant="outline" size="sm" className="gap-1.5 text-xs" title="Reset to center crop">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground/35 leading-relaxed">
        Analysis samples frames, detects faces/persons, and shifts the crop to keep the subject inside the selected platform frame.
      </p>
    </div>
  );
}

// ── Tiny stat cell ────────────────────────────────────────────────────────────

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground/50 mb-0.5">{label}</p>
      <p className={cn("font-medium tabular-nums text-foreground/75 text-xs", highlight)}>{value}</p>
    </div>
  );
}
