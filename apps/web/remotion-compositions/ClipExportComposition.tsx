// @ts-nocheck — This file is compiled by @remotion/bundler (webpack), not tsc.
//               Remotion v4 requires moduleResolution: "bundler" which differs
//               from the Next.js project config. Type-check via remotion/tsconfig.json.
/**
 * Remotion export composition — server-side equivalent of RemotionClipPreview.
 *
 * Key differences from the browser preview:
 *   - Uses OffthreadVideo instead of Video (frame-accurate server rendering)
 *   - Registered via registerRoot() for @remotion/bundler + renderMedia()
 *   - Accepts serialised JSON inputProps from renderMedia()
 *
 * Animation parity with the browser preview is intentional so what users see
 * in the editor is exactly what gets exported.
 */

import { AbsoluteFill, Composition, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import type { ClipCaptionStyleConfig, HookOverlay } from "@/lib/repurpose/caption-style-config";
import type { CaptionEntry } from "@/lib/srt-utils";
import type { SmartReframePlan } from "@/lib/media/smart-reframe";

// ── Constants ─────────────────────────────────────────────────────────────────

export const REMOTION_COMPOSITION_ID = "ClipExportComposition";
export const REMOTION_FPS = 30;
export const REMOTION_WIDTH = 1080;
export const REMOTION_HEIGHT = 1920;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClipExportCompositionProps {
  /** file:// URI pointing to the pre-cropped source clip extracted by FFmpeg. */
  previewUrl: string;
  durationMs: number;
  entries: CaptionEntry[];
  captionStyle: ClipCaptionStyleConfig;
  captionsEnabled: boolean;
  /** Watermark text rendered as a lower-right branded overlay (null = no watermark). */
  watermarkText: string | null;
  smartReframePlan?: SmartReframePlan | null;
}

// ── Helpers (mirror of RemotionClipPreview helpers) ───────────────────────────

function clampProgress(v: number) {
  return Math.min(1, Math.max(0, v));
}

function normalizeEntryText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function getAnimationTiming(
  type: ClipCaptionStyleConfig["animation"]["type"],
  speed: ClipCaptionStyleConfig["animation"]["speed"]
) {
  const mult = speed === "fast" ? 0.72 : speed === "slow" ? 1.35 : 1;
  const introMs = 220 * mult;
  const outroMs = 180 * mult;
  return { introMs, outroMs, supportsMotion: type !== "none" && type !== "karaoke" };
}

function findActiveCaption(entries: CaptionEntry[], currentMs: number): CaptionEntry | null {
  return entries.find((e) => currentMs >= e.startMs && currentMs < e.endMs) ?? entries[0] ?? null;
}

function findActiveHook(overlays: HookOverlay[], currentMs: number): HookOverlay | null {
  return overlays.find((o) => currentMs >= o.startMs && currentMs <= o.endMs) ?? null;
}

function getCaptionMotionStyle(
  entry: CaptionEntry | null,
  currentMs: number,
  captionStyle: ClipCaptionStyleConfig
): React.CSSProperties {
  if (!entry) return { opacity: 0, transform: "translateX(-50%)" };

  const { type, speed } = captionStyle.animation;
  const { introMs, outroMs, supportsMotion } = getAnimationTiming(type, speed);

  if (!supportsMotion) return { opacity: 1, transform: "translateX(-50%)" };

  const sinceStart = Math.max(0, currentMs - entry.startMs);
  const untilEnd = Math.max(0, entry.endMs - currentMs);
  const intro = clampProgress(sinceStart / introMs);
  const outro = clampProgress(untilEnd / outroMs);
  const visibility = Math.min(intro, outro);

  if (type === "fade") {
    return { opacity: visibility, transform: "translateX(-50%)" };
  }
  if (type === "slide") {
    return { opacity: visibility, transform: `translateX(-50%) translateY(${(1 - intro) * 70}px)` };
  }
  if (type === "pop") {
    const scale = 0.82 + 0.18 * intro;
    return { opacity: visibility, transform: `translateX(-50%) scale(${scale.toFixed(3)})` };
  }
  if (type === "bounce") {
    const bounce = Math.sin(intro * Math.PI) * 16;
    const scale = 0.9 + 0.1 * intro;
    return { opacity: visibility, transform: `translateX(-50%) translateY(${-bounce.toFixed(2)}px) scale(${scale.toFixed(3)})` };
  }
  return { opacity: 1, transform: "translateX(-50%)" };
}

function getPositionStyle(
  position: ClipCaptionStyleConfig["position"],
  safeZone?: SmartReframePlan["safeZone"] | null,
  safeZoneAware?: boolean
): React.CSSProperties {
  const safeBottomPct = safeZoneAware && safeZone ? Math.max(0.06, Math.min(0.32, safeZone.bottomPct)) : 0.1;
  const safeTopPct = safeZoneAware && safeZone ? Math.max(0.08, Math.min(0.3, safeZone.topPct)) : 0.14;

  if (position === "top") return { top: `${Math.round(safeTopPct * 100)}%` };
  if (position === "middle") return { top: "50%" };
  return { bottom: `${Math.round(safeBottomPct * 100)}%` };
}

function getHookPositionStyle(
  position: HookOverlay["position"],
  align: HookOverlay["align"]
): React.CSSProperties {
  const horizontal: React.CSSProperties =
    align === "left"
      ? { left: "8%", textAlign: "left" }
      : align === "right"
        ? { right: "8%", textAlign: "right" }
        : { left: "50%", transform: "translateX(-50%)", textAlign: "center" };

  const vertical: React.CSSProperties =
    position === "top" ? { top: "10%" } : position === "center" ? { top: "50%" } : { bottom: "16%" };

  return { ...horizontal, ...vertical };
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// ── Caption text component (mirrors RemotionCaptionText in preview) ────────────

function CaptionText({
  entry,
  currentMs,
  captionStyle,
}: {
  entry: CaptionEntry | null;
  currentMs: number;
  captionStyle: ClipCaptionStyleConfig;
}) {
  const text = normalizeEntryText(entry?.text ?? "");
  if (!text) return null;

  const useWordHighlight =
    captionStyle.animation.type === "karaoke" ||
    captionStyle.animation.wordHighlight ||
    captionStyle.karaoke;

  if (!useWordHighlight || !entry) {
    return <>{text}</>;
  }

  const words = text.split(/\s+/).filter(Boolean);
  const progress = clampProgress((currentMs - entry.startMs) / Math.max(1, entry.endMs - entry.startMs));
  const activeIndex = Math.min(words.length - 1, Math.floor(progress * words.length));

  return (
    <>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          style={{ color: i <= activeIndex ? captionStyle.emphasisColor : captionStyle.primaryColor }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

// ── Main composition ──────────────────────────────────────────────────────────

function ClipExportComposition({
  previewUrl,
  entries,
  captionStyle,
  captionsEnabled,
  watermarkText,
  smartReframePlan,
}: ClipExportCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = Math.round((frame / fps) * 1000);

  const activeCaption = captionsEnabled ? findActiveCaption(entries, currentMs) : null;
  const activeHook = findActiveHook(captionStyle.hookOverlays, currentMs);
  const motionStyle = getCaptionMotionStyle(activeCaption, currentMs, captionStyle);
  const positionStyle = getPositionStyle(
    captionStyle.position,
    smartReframePlan?.safeZone,
    captionStyle.safeZoneAware
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      {/* Source video (OffthreadVideo for accurate server-side frame extraction) */}
      <OffthreadVideo
        src={previewUrl}
        style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "black" }}
      />

      {/* Timed hook overlays */}
      {activeHook ? (
        <div
          style={{
            position: "absolute",
            maxWidth: "82%",
            padding: "18px 26px",
            borderRadius: 22,
            color: activeHook.textColor,
            backgroundColor: hexToRgba(activeHook.backgroundColor, activeHook.backgroundOpacity),
            fontSize: activeHook.fontSize,
            fontWeight: activeHook.bold ? 800 : 600,
            fontStyle: activeHook.italic ? "italic" : "normal",
            lineHeight: 1.08,
            boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
            ...getHookPositionStyle(activeHook.position, activeHook.align),
          }}
        >
          {activeHook.text}
        </div>
      ) : null}

      {/* Animated captions */}
      {captionsEnabled && activeCaption ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            maxWidth: "86%",
            padding: captionStyle.background ? "16px 26px" : "0",
            borderRadius: 22,
            textAlign: captionStyle.align,
            color: captionStyle.primaryColor,
            fontSize: captionStyle.fontSize,
            fontFamily: captionStyle.fontFamily,
            fontWeight: 800,
            lineHeight: 1.08,
            WebkitTextStroke: captionStyle.outline ? `2px ${captionStyle.outlineColor}` : undefined,
            textShadow: captionStyle.outline
              ? `0 4px 18px ${captionStyle.outlineColor}`
              : "0 4px 18px rgba(0,0,0,0.45)",
            backgroundColor: captionStyle.background
              ? hexToRgba(captionStyle.backgroundColor, captionStyle.backgroundOpacity)
              : "transparent",
            ...positionStyle,
            ...motionStyle,
          }}
        >
          <CaptionText entry={activeCaption} currentMs={currentMs} captionStyle={captionStyle} />
        </div>
      ) : null}

      {/* Branded watermark — bottom-right, consistent with FFmpeg watermark position */}
      {watermarkText ? (
        <div
          style={{
            position: "absolute",
            bottom: 48,
            right: 36,
            fontSize: 28,
            fontFamily: "Arial",
            fontWeight: 700,
            color: "rgba(255,255,255,0.75)",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            letterSpacing: 1,
            pointerEvents: "none",
          }}
        >
          {watermarkText}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

// ── Root (required by Remotion for registerRoot) ──────────────────────────────

const DEFAULT_PROPS: ClipExportCompositionProps = {
  previewUrl: "",
  durationMs: 60_000,
  entries: [],
  captionStyle: {
    presetId: "modern",
    fontFamily: "Arial",
    fontSize: 54,
    primaryColor: "#FFFFFF",
    emphasisColor: "#34d399",
    position: "bottom",
    outline: true,
    outlineColor: "#000000",
    background: true,
    backgroundColor: "#0B0B12",
    backgroundOpacity: 0.42,
    karaoke: false,
    maxWordsPerLine: 7,
    align: "center",
    animation: { type: "none", wordHighlight: false, speed: "normal" },
    safeZoneAware: true,
    hookOverlays: [],
  },
  captionsEnabled: true,
  watermarkText: null,
  smartReframePlan: null,
};

export function ClipExportRoot() {
  return (
    <Composition
      id={REMOTION_COMPOSITION_ID}
      component={ClipExportComposition}
      durationInFrames={Math.round((DEFAULT_PROPS.durationMs / 1000) * REMOTION_FPS)}
      fps={REMOTION_FPS}
      width={REMOTION_WIDTH}
      height={REMOTION_HEIGHT}
      defaultProps={DEFAULT_PROPS}
    />
  );
}
