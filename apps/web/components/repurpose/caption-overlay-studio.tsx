"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Type } from "lucide-react";

import { CAPTION_STYLES } from "@/lib/constants/caption-styles";
import {
  createDefaultHookOverlay,
  normalizeClipCaptionStyle,
  type ClipCaptionStyleConfig,
  type HookOverlay,
} from "@/lib/repurpose/caption-style-config";
import type { CaptionEntry } from "@/lib/srt-utils";
import { cn } from "@/lib/utils";

interface CaptionOverlayStudioProps {
  value?: ClipCaptionStyleConfig | null;
  onChange: (value: ClipCaptionStyleConfig) => void;
  sampleCaption?: string;
  previewPath?: string | null;
  captionEntries?: CaptionEntry[];
}

const POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
] as const;

const OVERLAY_POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
] as const;

const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const;

const ANIMATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "karaoke", label: "Karaoke" },
  { value: "pop", label: "Pop" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "bounce", label: "Bounce" },
] as const;

const SPEED_OPTIONS = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
] as const;

export function CaptionOverlayStudio({
  value,
  onChange,
  sampleCaption,
  previewPath,
  captionEntries = [],
}: CaptionOverlayStudioProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const safeValue = useMemo(() => normalizeClipCaptionStyle(value), [value]);
  const selectedStyle = CAPTION_STYLES.find((style) => style.id === safeValue.presetId) ?? CAPTION_STYLES[0];
  const activeHook = useMemo(
    () => safeValue.hookOverlays.find((overlay) => currentMs >= overlay.startMs && currentMs <= overlay.endMs),
    [currentMs, safeValue.hookOverlays]
  );
  const activeCaption = useMemo(() => {
    const activeEntry = captionEntries.find((entry) => currentMs >= entry.startMs && currentMs <= entry.endMs);
    return activeEntry?.text?.trim() || sampleCaption?.trim() || "Your styled caption preview appears here.";
  }, [captionEntries, currentMs, sampleCaption]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const syncCurrentTime = () => {
      setCurrentMs(Math.round(video.currentTime * 1000));
    };

    const resetLoop = () => {
      setCurrentMs(0);
    };

    video.addEventListener("timeupdate", syncCurrentTime);
    video.addEventListener("loadedmetadata", syncCurrentTime);
    video.addEventListener("seeked", syncCurrentTime);
    video.addEventListener("ended", resetLoop);

    return () => {
      video.removeEventListener("timeupdate", syncCurrentTime);
      video.removeEventListener("loadedmetadata", syncCurrentTime);
      video.removeEventListener("seeked", syncCurrentTime);
      video.removeEventListener("ended", resetLoop);
    };
  }, [previewPath]);

  const updateOverlay = (overlayId: string, updates: Partial<HookOverlay>) => {
    onChange({
      ...safeValue,
      hookOverlays: safeValue.hookOverlays.map((overlay) =>
        overlay.id === overlayId ? { ...overlay, ...updates } : overlay
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-xl border border-border/40 bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Type className="h-4 w-4 text-violet-400" />
            <div>
              <p className="text-sm font-semibold text-foreground">Caption theme</p>
              <p className="text-xs text-muted-foreground/55">
                Style burned captions for exports and live preview.
              </p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {CAPTION_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...safeValue,
                    presetId: style.id,
                    primaryColor: style.colors.power === "#FFFFFF" ? safeValue.primaryColor : "#FFFFFF",
                    emphasisColor: style.colors.emotion,
                  })
                }
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  safeValue.presetId === style.id
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-border/40 bg-muted/20 hover:bg-muted/40"
                )}
              >
                <p className="text-sm font-medium text-foreground">{style.name}</p>
                <p className="mt-1 text-xs text-muted-foreground/55">{style.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Font family">
              <input
                value={safeValue.fontFamily}
                onChange={(event) => onChange({ ...safeValue, fontFamily: event.target.value })}
                className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-sm outline-none focus:border-primary/50"
                placeholder="Arial"
              />
            </Field>
            <Field label="Caption position">
              <div className="flex gap-2">
                {POSITION_OPTIONS.map((option) => (
                  <TogglePill
                    key={option.value}
                    active={safeValue.position === option.value}
                    onClick={() => onChange({ ...safeValue, position: option.value })}
                    label={option.label}
                  />
                ))}
              </div>
            </Field>
            <Field label="Text align">
              <div className="flex gap-2">
                {ALIGN_OPTIONS.map((option) => (
                  <TogglePill
                    key={option.value}
                    active={safeValue.align === option.value}
                    onClick={() => onChange({ ...safeValue, align: option.value })}
                    label={option.label}
                  />
                ))}
              </div>
            </Field>
            <Field label={`Font size ${safeValue.fontSize}px`}>
              <input
                type="range"
                min={28}
                max={96}
                step={2}
                value={safeValue.fontSize}
                onChange={(event) =>
                  onChange({ ...safeValue, fontSize: Number(event.target.value) })
                }
                className="w-full accent-violet-500"
              />
            </Field>
            <Field label={`Words per line ${safeValue.maxWordsPerLine}`}>
              <input
                type="range"
                min={2}
                max={12}
                step={1}
                value={safeValue.maxWordsPerLine}
                onChange={(event) =>
                  onChange({ ...safeValue, maxWordsPerLine: Number(event.target.value) })
                }
                className="w-full accent-violet-500"
              />
            </Field>
            <Field label={`Background ${Math.round(safeValue.backgroundOpacity * 100)}%`}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(safeValue.backgroundOpacity * 100)}
                onChange={(event) =>
                  onChange({
                    ...safeValue,
                    backgroundOpacity: Number(event.target.value) / 100,
                  })
                }
                className="w-full accent-violet-500"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ColorField
              label="Text"
              value={safeValue.primaryColor}
              onChange={(next) => onChange({ ...safeValue, primaryColor: next })}
            />
            <ColorField
              label="Accent"
              value={safeValue.emphasisColor}
              onChange={(next) => onChange({ ...safeValue, emphasisColor: next })}
            />
            <ColorField
              label="Background"
              value={safeValue.backgroundColor}
              onChange={(next) => onChange({ ...safeValue, backgroundColor: next })}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <TogglePill
              active={safeValue.outline}
              onClick={() => onChange({ ...safeValue, outline: !safeValue.outline })}
              label={safeValue.outline ? "Outline on" : "Outline off"}
            />
            <TogglePill
              active={safeValue.background}
              onClick={() => onChange({ ...safeValue, background: !safeValue.background })}
              label={safeValue.background ? "Background on" : "Background off"}
            />
            <TogglePill
              active={safeValue.karaoke}
              onClick={() =>
                onChange({
                  ...safeValue,
                  karaoke: !safeValue.karaoke,
                  animation: {
                    ...safeValue.animation,
                    type: !safeValue.karaoke ? "karaoke" : "none",
                    wordHighlight: !safeValue.karaoke,
                  },
                })
              }
              label={safeValue.karaoke ? "Karaoke on" : "Karaoke off"}
            />
            <TogglePill
              active={safeValue.safeZoneAware}
              onClick={() => onChange({ ...safeValue, safeZoneAware: !safeValue.safeZoneAware })}
              label={safeValue.safeZoneAware ? "Safe-zone on" : "Safe-zone off"}
            />
          </div>

          <div className="mt-4 rounded-lg border border-border/40 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/55">
              Caption animation
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <Field label="Type">
                <div className="flex flex-wrap gap-2">
                  {ANIMATION_OPTIONS.map((option) => (
                    <TogglePill
                      key={option.value}
                      active={safeValue.animation.type === option.value}
                      onClick={() =>
                        onChange({
                          ...safeValue,
                          karaoke: option.value === "karaoke",
                          animation: {
                            ...safeValue.animation,
                            type: option.value,
                            wordHighlight:
                              option.value === "karaoke" ? true : safeValue.animation.wordHighlight,
                          },
                        })
                      }
                      label={option.label}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Speed">
                <div className="flex gap-2">
                  {SPEED_OPTIONS.map((option) => (
                    <TogglePill
                      key={option.value}
                      active={safeValue.animation.speed === option.value}
                      onClick={() =>
                        onChange({
                          ...safeValue,
                          animation: { ...safeValue.animation, speed: option.value },
                        })
                      }
                      label={option.label}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Highlight">
                <TogglePill
                  active={safeValue.animation.wordHighlight}
                  onClick={() =>
                    onChange({
                      ...safeValue,
                      animation: {
                        ...safeValue.animation,
                        wordHighlight: !safeValue.animation.wordHighlight,
                      },
                    })
                  }
                  label={safeValue.animation.wordHighlight ? "Word highlight on" : "Word highlight off"}
                />
              </Field>
            </div>
            {safeValue.animation.type !== "none" ? (
              <p className="mt-3 text-[11px] leading-5 text-amber-300/75">
                Animation settings are saved for this clip. Current FFmpeg exports burn static captions; unsupported animation falls back safely.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border/40 bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground">Live preview</p>
          <p className="mt-1 text-xs text-muted-foreground/55">
            Real clip preview with live caption and hook overlay styling.
          </p>

          <div className="relative mt-4 overflow-hidden rounded-xl border border-border/40 bg-zinc-950 aspect-[9/16]">
            {previewPath ? (
              <video
                ref={videoRef}
                src={previewPath}
                className="h-full w-full object-cover"
                preload="metadata"
                playsInline
                muted
                loop
                controls
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 px-6 text-center text-xs text-muted-foreground/55">
                Playable preview is unavailable for this clip. Regenerate captions or rebuild the clip preview to watch it here.
              </div>
            )}

            {activeHook ? (
              <PreviewOverlay overlay={activeHook} />
            ) : null}

            <div
              className={cn(
                "absolute left-1/2 max-w-[86%] -translate-x-1/2 rounded-xl px-4 py-2 text-center shadow-lg",
                "pointer-events-none",
                safeValue.position === "top" && "top-[12%]",
                safeValue.position === "middle" && "top-1/2 -translate-y-1/2",
                safeValue.position === "bottom" && "bottom-[11%]"
              )}
              style={{
                color: safeValue.primaryColor,
                fontSize: `${Math.max(18, Math.round(safeValue.fontSize * 0.38))}px`,
                fontFamily: safeValue.fontFamily,
                textAlign: safeValue.align,
                WebkitTextStroke: safeValue.outline ? `1px ${safeValue.outlineColor}` : undefined,
                backgroundColor: safeValue.background
                  ? `${safeValue.backgroundColor}${Math.round(safeValue.backgroundOpacity * 255)
                      .toString(16)
                      .padStart(2, "0")}`
                  : "transparent",
              }}
            >
              <span className={cn("font-semibold", safeValue.animation.type === "pop" && "scale-[1.03]", safeValue.animation.type === "fade" && "opacity-90")}>
                {activeCaption}
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/40 to-transparent" />
          </div>

          <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground/60">
            {selectedStyle.name} preset · {safeValue.animation.type} animation · {safeValue.hookOverlays.length} hook overlay
            {safeValue.hookOverlays.length === 1 ? "" : "s"}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border/40 bg-muted/30 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Hook overlays</p>
            <p className="text-xs text-muted-foreground/55">
              Timed text callouts that appear on top of the clip during export.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...safeValue,
                hookOverlays: [...safeValue.hookOverlays, createDefaultHookOverlay()],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/15"
          >
            <Plus className="h-3.5 w-3.5" />
            Add hook
          </button>
        </div>

        {safeValue.hookOverlays.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-sm text-muted-foreground/45">
            No hook overlay yet. Add one for intro punch, CTA, or quote emphasis.
          </div>
        ) : (
          <div className="space-y-3">
            {safeValue.hookOverlays.map((overlay, index) => (
              <div key={overlay.id} className="rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Hook {index + 1}</p>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...safeValue,
                        hookOverlays: safeValue.hookOverlays.filter((item) => item.id !== overlay.id),
                      })
                    }
                    className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/15"
                    aria-label={`Delete overlay ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.6fr))]">
                  <Field label="Text">
                    <input
                      value={overlay.text}
                      onChange={(event) => updateOverlay(overlay.id, { text: event.target.value })}
                      className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-sm outline-none focus:border-primary/50"
                      placeholder="What should appear on screen?"
                    />
                  </Field>
                  <Field label="Start ms">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={overlay.startMs}
                      onChange={(event) =>
                        updateOverlay(overlay.id, { startMs: Number(event.target.value) || 0 })
                      }
                      className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-sm outline-none focus:border-primary/50"
                    />
                  </Field>
                  <Field label="End ms">
                    <input
                      type="number"
                      min={overlay.startMs + 100}
                      step={100}
                      value={overlay.endMs}
                      onChange={(event) =>
                        updateOverlay(overlay.id, { endMs: Number(event.target.value) || overlay.endMs })
                      }
                      className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-sm outline-none focus:border-primary/50"
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <Field label="Vertical">
                    <div className="flex gap-2">
                      {OVERLAY_POSITION_OPTIONS.map((option) => (
                        <TogglePill
                          key={option.value}
                          active={overlay.position === option.value}
                          onClick={() => updateOverlay(overlay.id, { position: option.value })}
                          label={option.label}
                        />
                      ))}
                    </div>
                  </Field>
                  <Field label="Align">
                    <div className="flex gap-2">
                      {ALIGN_OPTIONS.map((option) => (
                        <TogglePill
                          key={option.value}
                          active={overlay.align === option.value}
                          onClick={() => updateOverlay(overlay.id, { align: option.value })}
                          label={option.label}
                        />
                      ))}
                    </div>
                  </Field>
                  <Field label={`Size ${overlay.fontSize}px`}>
                    <input
                      type="range"
                      min={24}
                      max={140}
                      step={2}
                      value={overlay.fontSize}
                      onChange={(event) =>
                        updateOverlay(overlay.id, { fontSize: Number(event.target.value) })
                      }
                      className="w-full accent-violet-500"
                    />
                  </Field>
                  <Field label={`Background ${Math.round(overlay.backgroundOpacity * 100)}%`}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(overlay.backgroundOpacity * 100)}
                      onChange={(event) =>
                        updateOverlay(overlay.id, {
                          backgroundOpacity: Number(event.target.value) / 100,
                        })
                      }
                      className="w-full accent-violet-500"
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <ColorField
                    label="Text color"
                    value={overlay.textColor}
                    onChange={(next) => updateOverlay(overlay.id, { textColor: next })}
                  />
                  <ColorField
                    label="BG color"
                    value={overlay.backgroundColor}
                    onChange={(next) => updateOverlay(overlay.id, { backgroundColor: next })}
                  />
                  <Field label="Font weight">
                    <TogglePill
                      active={overlay.bold}
                      onClick={() => updateOverlay(overlay.id, { bold: !overlay.bold })}
                      label={overlay.bold ? "Bold" : "Regular"}
                    />
                  </Field>
                  <Field label="Style">
                    <TogglePill
                      active={overlay.italic}
                      onClick={() => updateOverlay(overlay.id, { italic: !overlay.italic })}
                      label={overlay.italic ? "Italic" : "Normal"}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/45">
        {label}
      </p>
      {children}
    </div>
  );
}

function TogglePill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border/50 bg-muted/30 text-muted-foreground/70 hover:bg-muted/50"
      )}
    >
      {label}
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-border/50 bg-background px-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-5 w-5 rounded border-0 bg-transparent"
        />
        <span className="text-xs text-foreground/80">{value}</span>
      </label>
    </Field>
  );
}

function PreviewOverlay({ overlay }: { overlay: HookOverlay }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute max-w-[82%] rounded-xl px-4 py-2 text-center shadow-lg",
        overlay.position === "top" && "left-1/2 top-[10%] -translate-x-1/2",
        overlay.position === "center" && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        overlay.position === "bottom" && "left-1/2 bottom-[14%] -translate-x-1/2"
      )}
      style={{
        color: overlay.textColor,
        backgroundColor: `${overlay.backgroundColor}${Math.round(overlay.backgroundOpacity * 255)
          .toString(16)
          .padStart(2, "0")}`,
        fontSize: `${Math.max(18, Math.round(overlay.fontSize * 0.34))}px`,
        textAlign: overlay.align,
        fontWeight: overlay.bold ? 700 : 500,
        fontStyle: overlay.italic ? "italic" : "normal",
      }}
    >
      {overlay.text}
    </div>
  );
}
