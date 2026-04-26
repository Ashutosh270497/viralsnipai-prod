import type { CaptionStyleId } from "@/lib/constants/caption-styles";

export type CaptionVerticalPosition = "top" | "middle" | "bottom";
export type OverlayVerticalPosition = "top" | "center" | "bottom";
export type OverlayHorizontalAlign = "left" | "center" | "right";
export type CaptionAnimationType = "none" | "karaoke" | "pop" | "fade" | "slide" | "bounce";
export type CaptionAnimationSpeed = "slow" | "normal" | "fast";

export interface CaptionAnimationConfig {
  type: CaptionAnimationType;
  wordHighlight: boolean;
  speed: CaptionAnimationSpeed;
}

export interface HookOverlay {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  position: OverlayVerticalPosition;
  align: OverlayHorizontalAlign;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  bold: boolean;
  italic: boolean;
}

export interface ClipCaptionStyleConfig {
  presetId: CaptionStyleId;
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  emphasisColor: string;
  position: CaptionVerticalPosition;
  outline: boolean;
  outlineColor: string;
  background: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  karaoke: boolean;
  maxWordsPerLine: number;
  align: OverlayHorizontalAlign;
  animation: CaptionAnimationConfig;
  safeZoneAware: boolean;
  hookOverlays: HookOverlay[];
}

export const DEFAULT_CLIP_CAPTION_STYLE: ClipCaptionStyleConfig = {
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
  animation: {
    type: "none",
    wordHighlight: false,
    speed: "normal",
  },
  safeZoneAware: true,
  hookOverlays: [],
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(input: unknown, fallback: string) {
  if (typeof input !== "string") {
    return fallback;
  }
  const value = input.trim();
  if (!/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value)) {
    return fallback;
  }
  if (value.length === 4) {
    return `#${value
      .slice(1)
      .split("")
      .map((part) => `${part}${part}`)
      .join("")
      .toUpperCase()}`;
  }
  return value.toUpperCase();
}

function normalizeStringChoice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function normalizeHookOverlay(input: unknown): HookOverlay | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const overlay = input as Record<string, unknown>;
  const text = typeof overlay.text === "string" ? overlay.text.trim() : "";
  if (!text) {
    return null;
  }

  const startMs = clampNumber(overlay.startMs, 0, 60 * 60 * 1000, 0);
  const endMs = clampNumber(overlay.endMs, startMs + 100, 60 * 60 * 1000, startMs + 2500);

  return {
    id: typeof overlay.id === "string" && overlay.id.trim() ? overlay.id : `overlay-${Math.random().toString(36).slice(2, 10)}`,
    text,
    startMs,
    endMs,
    position: normalizeStringChoice(overlay.position, ["top", "center", "bottom"], "top"),
    align: normalizeStringChoice(overlay.align, ["left", "center", "right"], "center"),
    fontSize: clampNumber(overlay.fontSize, 24, 140, 62),
    textColor: normalizeHex(overlay.textColor, "#FFFFFF"),
    backgroundColor: normalizeHex(overlay.backgroundColor, "#000000"),
    backgroundOpacity: clampNumber(overlay.backgroundOpacity, 0, 1, 0.55),
    bold: Boolean(overlay.bold),
    italic: Boolean(overlay.italic),
  };
}

export function normalizeClipCaptionStyle(
  input: unknown,
  fallback: ClipCaptionStyleConfig = DEFAULT_CLIP_CAPTION_STYLE
): ClipCaptionStyleConfig {
  if (!input || typeof input !== "object") {
    return {
      ...fallback,
      hookOverlays: [...fallback.hookOverlays],
    };
  }

  const raw = input as Record<string, unknown>;
  const hookOverlays = Array.isArray(raw.hookOverlays)
    ? raw.hookOverlays
        .map(normalizeHookOverlay)
        .filter((overlay): overlay is HookOverlay => overlay !== null)
        .slice(0, 6)
    : [...fallback.hookOverlays];

  return {
    presetId: normalizeStringChoice(raw.presetId, ["modern", "viral", "minimal", "gaming", "business"], fallback.presetId),
    fontFamily: typeof raw.fontFamily === "string" && raw.fontFamily.trim() ? raw.fontFamily.trim() : fallback.fontFamily,
    fontSize: clampNumber(raw.fontSize, 28, 96, fallback.fontSize),
    primaryColor: normalizeHex(raw.primaryColor, fallback.primaryColor),
    emphasisColor: normalizeHex(raw.emphasisColor, fallback.emphasisColor),
    position: normalizeStringChoice(raw.position, ["top", "middle", "bottom"], fallback.position),
    outline: typeof raw.outline === "boolean" ? raw.outline : fallback.outline,
    outlineColor: normalizeHex(raw.outlineColor, fallback.outlineColor),
    background: typeof raw.background === "boolean" ? raw.background : fallback.background,
    backgroundColor: normalizeHex(raw.backgroundColor, fallback.backgroundColor),
    backgroundOpacity: clampNumber(raw.backgroundOpacity, 0, 1, fallback.backgroundOpacity),
    karaoke: typeof raw.karaoke === "boolean" ? raw.karaoke : fallback.karaoke,
    maxWordsPerLine: clampNumber(raw.maxWordsPerLine, 2, 12, fallback.maxWordsPerLine),
    align: normalizeStringChoice(raw.align, ["left", "center", "right"], fallback.align),
    animation: normalizeCaptionAnimation(raw.animation, raw.karaoke, fallback.animation),
    safeZoneAware: typeof raw.safeZoneAware === "boolean" ? raw.safeZoneAware : fallback.safeZoneAware,
    hookOverlays,
  };
}

function normalizeCaptionAnimation(
  input: unknown,
  legacyKaraoke: unknown,
  fallback: CaptionAnimationConfig
): CaptionAnimationConfig {
  if (!input || typeof input !== "object") {
    return {
      ...fallback,
      type: legacyKaraoke === true ? "karaoke" : fallback.type,
      wordHighlight: legacyKaraoke === true ? true : fallback.wordHighlight,
    };
  }

  const raw = input as Record<string, unknown>;
  const type = normalizeStringChoice(
    raw.type,
    ["none", "karaoke", "pop", "fade", "slide", "bounce"],
    legacyKaraoke === true ? "karaoke" : fallback.type
  );

  return {
    type,
    wordHighlight: typeof raw.wordHighlight === "boolean" ? raw.wordHighlight : type === "karaoke",
    speed: normalizeStringChoice(raw.speed, ["slow", "normal", "fast"], fallback.speed),
  };
}

export function createDefaultHookOverlay(partial?: Partial<HookOverlay>): HookOverlay {
  return {
    id: partial?.id ?? `overlay-${Date.now().toString(36)}`,
    text: partial?.text ?? "Hook headline",
    startMs: partial?.startMs ?? 0,
    endMs: partial?.endMs ?? 2500,
    position: partial?.position ?? "top",
    align: partial?.align ?? "center",
    fontSize: partial?.fontSize ?? 62,
    textColor: partial?.textColor ?? "#FFFFFF",
    backgroundColor: partial?.backgroundColor ?? "#000000",
    backgroundOpacity: partial?.backgroundOpacity ?? 0.55,
    bold: partial?.bold ?? true,
    italic: partial?.italic ?? false,
  };
}
