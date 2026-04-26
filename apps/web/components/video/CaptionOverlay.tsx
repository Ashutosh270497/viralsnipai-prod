"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { isPlaceholderCaptionText } from "@/lib/caption-quality";
import type { CaptionEntry } from "@/lib/srt-utils";
import type { ClipCaptionStyleConfig } from "@/lib/repurpose/caption-style-config";

export interface CaptionOverlayProps {
  /** All caption entries for the clip (clip-relative ms). */
  entries: CaptionEntry[];
  /** Current playback position in milliseconds. Update via video `timeupdate`. */
  currentMs: number;
  /** Whether captions are visible. */
  visible: boolean;
  /** Caption appearance from the clip's captionStyle. */
  style: ClipCaptionStyleConfig;
  /** Optional extra class on the overlay container. */
  className?: string;
}

/**
 * Custom caption overlay rendered on top of a `<video>` element.
 *
 * Usage:
 * ```tsx
 * <div className="relative">
 *   <video ref={videoRef} src={...} />
 *   <CaptionOverlay
 *     entries={parsedEntries}
 *     currentMs={currentMs}
 *     visible={captionsEnabled}
 *     style={clip.captionStyle}
 *   />
 * </div>
 * ```
 *
 * Mount inside a `position: relative` container that wraps the video.
 * The overlay is `pointer-events-none` so it never blocks video controls.
 */
export function CaptionOverlay({
  entries,
  currentMs,
  visible,
  style,
  className,
}: CaptionOverlayProps) {
  const activeText = useMemo(() => {
    const active = entries.find(
      (e) => currentMs >= e.startMs && currentMs < e.endMs
    );
    if (!active || isPlaceholderCaptionText(active.text)) return null;
    return active.text.trim();
  }, [entries, currentMs]);

  if (!visible || !activeText) return null;

  // Vertical position
  const positionClass =
    style.position === "top"
      ? "top-[12%]"
      : style.position === "middle"
      ? "top-1/2 -translate-y-1/2"
      : "bottom-[10%]";

  // Background colour with opacity baked in
  const bgColor = style.background
    ? hexWithOpacity(style.backgroundColor, style.backgroundOpacity)
    : "transparent";

  // Text shadow / stroke for readability without a background box
  const textShadow = style.outline
    ? `0 0 4px ${style.outlineColor}, 0 1px 3px ${style.outlineColor}`
    : undefined;

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 max-w-[86%] -translate-x-1/2 px-3 py-1 text-center leading-snug",
        positionClass,
        className
      )}
      style={{
        color: style.primaryColor,
        fontSize: scaleFontSize(style.fontSize),
        fontFamily: style.fontFamily || "sans-serif",
        fontWeight: 700,
        lineHeight: 1.35,
        backgroundColor: bgColor,
        borderRadius: style.background ? "6px" : undefined,
        WebkitTextStroke: style.outline
          ? `1px ${style.outlineColor}`
          : undefined,
        textShadow,
      }}
    >
      {activeText}
    </div>
  );
}

/** Scale the stored font-size (designed for ~540px canvas) to the preview area. */
function scaleFontSize(stored: number): string {
  // The stored value is calibrated for a full-height portrait canvas (~540px).
  // Preview videos are typically 240px tall — scale proportionally.
  const scaled = Math.max(12, Math.round(stored * (240 / 540)));
  return `${scaled}px`;
}

/** Combine a hex colour with a 0–1 opacity into a CSS rgba-compatible hex8 string. */
function hexWithOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}
