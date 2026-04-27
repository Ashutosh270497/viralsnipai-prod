"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig } from "remotion";
import type { ClipCaptionStyleConfig, HookOverlay } from "@/lib/repurpose/caption-style-config";
import type { SmartReframePlan } from "@/lib/media/smart-reframe";
import type { CaptionEntry } from "@/lib/srt-utils";

const FPS = 30;
const COMPOSITION_WIDTH = 1080;
const COMPOSITION_HEIGHT = 1920;

function normalizeEntryText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface RemotionClipPreviewHandle {
  seekToMs: (ms: number) => void;
}

interface RemotionClipPreviewProps {
  previewPath: string;
  entries: CaptionEntry[];
  captionStyle: ClipCaptionStyleConfig;
  subtitlesEnabled: boolean;
  durationMs: number;
  smartReframePlan?: SmartReframePlan | null;
  onTimeUpdate?: (ms: number) => void;
}

interface RemotionCompositionProps {
  previewPath: string;
  entries: CaptionEntry[];
  captionStyle: ClipCaptionStyleConfig;
  subtitlesEnabled: boolean;
  smartReframePlan?: SmartReframePlan | null;
}

function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

function animationTiming(type: ClipCaptionStyleConfig["animation"]["type"], speed: ClipCaptionStyleConfig["animation"]["speed"]) {
  const speedMultiplier = speed === "fast" ? 0.72 : speed === "slow" ? 1.35 : 1;
  const introMs = 220 * speedMultiplier;
  const outroMs = 180 * speedMultiplier;

  return {
    introMs,
    outroMs,
    supportsMotion: type !== "none" && type !== "karaoke",
  };
}

function findActiveCaption(entries: CaptionEntry[], currentMs: number) {
  return (
    entries.find((entry) => currentMs >= entry.startMs && currentMs < entry.endMs) ??
    entries[0] ??
    null
  );
}

function findActiveHook(overlays: HookOverlay[], currentMs: number) {
  return overlays.find((overlay) => currentMs >= overlay.startMs && currentMs <= overlay.endMs) ?? null;
}

function getCaptionMotionStyle({
  entry,
  currentMs,
  captionStyle,
}: {
  entry: CaptionEntry | null;
  currentMs: number;
  captionStyle: ClipCaptionStyleConfig;
}) {
  if (!entry) {
    return { opacity: 0, transform: "translateX(-50%)" };
  }

  const { type, speed } = captionStyle.animation;
  const { introMs, outroMs, supportsMotion } = animationTiming(type, speed);
  const sinceStart = Math.max(0, currentMs - entry.startMs);
  const untilEnd = Math.max(0, entry.endMs - currentMs);
  const intro = clampProgress(sinceStart / introMs);
  const outro = clampProgress(untilEnd / outroMs);
  const visibility = Math.min(intro, outro);

  if (!supportsMotion) {
    return { opacity: 1, transform: "translateX(-50%)" };
  }

  if (type === "fade") {
    return { opacity: visibility, transform: "translateX(-50%)" };
  }

  if (type === "slide") {
    const offset = (1 - intro) * 70;
    return { opacity: visibility, transform: `translateX(-50%) translateY(${offset}px)` };
  }

  if (type === "pop") {
    const scale = 0.82 + 0.18 * intro;
    return { opacity: visibility, transform: `translateX(-50%) scale(${scale.toFixed(3)})` };
  }

  if (type === "bounce") {
    const bounce = Math.sin(intro * Math.PI) * 16;
    const scale = 0.9 + 0.1 * intro;
    return {
      opacity: visibility,
      transform: `translateX(-50%) translateY(${-bounce.toFixed(2)}px) scale(${scale.toFixed(3)})`,
    };
  }

  return { opacity: 1, transform: "translateX(-50%)" };
}

function getPositionStyle(
  position: ClipCaptionStyleConfig["position"],
  safeZone: SmartReframePlan["safeZone"] | null | undefined,
  safeZoneAware: boolean
) {
  const safeBottomPct = safeZoneAware && safeZone ? Math.max(0.06, Math.min(0.32, safeZone.bottomPct)) : 0.1;
  const safeTopPct = safeZoneAware && safeZone ? Math.max(0.08, Math.min(0.3, safeZone.topPct)) : 0.14;

  if (position === "top") {
    return { top: `${Math.round(safeTopPct * 100)}%` };
  }
  if (position === "middle") {
    return { top: "50%" };
  }
  return { bottom: `${Math.round(safeBottomPct * 100)}%` };
}

function getHookPositionStyle(position: HookOverlay["position"], align: HookOverlay["align"]) {
  const horizontal =
    align === "left"
      ? { left: "8%", transform: "none", textAlign: "left" as const }
      : align === "right"
        ? { right: "8%", transform: "none", textAlign: "right" as const }
        : { left: "50%", transform: "translateX(-50%)", textAlign: "center" as const };

  const vertical =
    position === "top"
      ? { top: "10%" }
      : position === "center"
        ? { top: "50%" }
        : { bottom: "16%" };

  return { ...horizontal, ...vertical };
}

function splitCaptionWords(text: string) {
  return normalizeEntryText(text).split(/\s+/).filter(Boolean);
}

function RemotionCaptionText({
  entry,
  currentMs,
  captionStyle,
}: {
  entry: CaptionEntry | null;
  currentMs: number;
  captionStyle: ClipCaptionStyleConfig;
}) {
  const text = normalizeEntryText(entry?.text ?? "");
  const useWordHighlight =
    captionStyle.animation.type === "karaoke" ||
    captionStyle.animation.wordHighlight ||
    captionStyle.karaoke;

  if (!text) {
    return null;
  }

  if (!useWordHighlight || !entry) {
    return <>{text}</>;
  }

  const words = splitCaptionWords(text);
  const progress = clampProgress((currentMs - entry.startMs) / Math.max(1, entry.endMs - entry.startMs));
  const activeIndex = Math.min(words.length - 1, Math.floor(progress * words.length));

  return (
    <>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          style={{
            color: index <= activeIndex ? captionStyle.emphasisColor : captionStyle.primaryColor,
            transition: "color 90ms linear",
          }}
        >
          {word}
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

function RemotionClipComposition({
  previewPath,
  entries,
  captionStyle,
  subtitlesEnabled,
  smartReframePlan,
}: RemotionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = Math.round((frame / fps) * 1000);
  const activeCaption = subtitlesEnabled ? findActiveCaption(entries, currentMs) : null;
  const activeHook = findActiveHook(captionStyle.hookOverlays, currentMs);
  const motionStyle = getCaptionMotionStyle({ entry: activeCaption, currentMs, captionStyle });

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <Video
        src={previewPath}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: "black",
        }}
      />

      {activeHook ? (
        <div
          style={{
            position: "absolute",
            maxWidth: "80%",
            padding: "18px 26px",
            borderRadius: 22,
            color: activeHook.textColor,
            backgroundColor: `${activeHook.backgroundColor}${Math.round(activeHook.backgroundOpacity * 255)
              .toString(16)
              .padStart(2, "0")}`,
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

      {subtitlesEnabled && activeCaption ? (
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
            letterSpacing: 0,
            WebkitTextStroke: captionStyle.outline ? `2px ${captionStyle.outlineColor}` : undefined,
            textShadow: captionStyle.outline ? `0 4px 18px ${captionStyle.outlineColor}` : "0 4px 18px rgba(0,0,0,0.45)",
            backgroundColor: captionStyle.background
              ? `${captionStyle.backgroundColor}${Math.round(captionStyle.backgroundOpacity * 255)
                  .toString(16)
                  .padStart(2, "0")}`
              : "transparent",
            boxShadow: captionStyle.background ? "0 18px 50px rgba(0,0,0,0.35)" : "none",
            ...getPositionStyle(captionStyle.position, smartReframePlan?.safeZone, captionStyle.safeZoneAware),
            ...motionStyle,
          }}
        >
          <RemotionCaptionText entry={activeCaption} currentMs={currentMs} captionStyle={captionStyle} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

export const RemotionClipPreview = forwardRef<RemotionClipPreviewHandle, RemotionClipPreviewProps>(
  function RemotionClipPreview(
    {
      previewPath,
      entries,
      captionStyle,
      subtitlesEnabled,
      smartReframePlan,
      durationMs,
      onTimeUpdate,
    },
    ref
  ) {
    const playerRef = useRef<PlayerRef>(null);
    const durationInFrames = Math.max(1, Math.ceil((Math.max(durationMs, 1000) / 1000) * FPS));

    useImperativeHandle(
      ref,
      () => ({
        seekToMs(ms: number) {
          playerRef.current?.seekTo(Math.max(0, Math.round((ms / 1000) * FPS)));
        },
      }),
      []
    );

    useEffect(() => {
      const player = playerRef.current;
      if (!player || !onTimeUpdate) return;

      const handleTimeUpdate = ({ detail }: { detail: { frame: number } }) => {
        onTimeUpdate(Math.round((detail.frame / FPS) * 1000));
      };

      player.addEventListener("timeupdate", handleTimeUpdate);
      player.addEventListener("frameupdate", handleTimeUpdate);
      return () => {
        player.removeEventListener("timeupdate", handleTimeUpdate);
        player.removeEventListener("frameupdate", handleTimeUpdate);
      };
    }, [onTimeUpdate]);

    const inputProps = useMemo(
      () => ({
        previewPath,
        entries,
        captionStyle,
        subtitlesEnabled,
        smartReframePlan,
      }),
      [captionStyle, entries, previewPath, smartReframePlan, subtitlesEnabled]
    );

    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-black">
        <Player
          ref={playerRef}
          component={RemotionClipComposition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={COMPOSITION_WIDTH}
          compositionHeight={COMPOSITION_HEIGHT}
          fps={FPS}
          controls
          clickToPlay
          doubleClickToFullscreen
          acknowledgeRemotionLicense
          style={{
            width: "100%",
            maxHeight: 240,
            aspectRatio: "9 / 16",
            backgroundColor: "black",
          }}
          errorFallback={({ error }) => (
            <div className="flex min-h-[220px] items-center justify-center bg-black px-4 text-center text-xs text-white/60">
              Remotion preview failed: {error.message}
            </div>
          )}
        />
      </div>
    );
  }
);
