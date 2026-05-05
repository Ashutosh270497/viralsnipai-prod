import {
  DEFAULT_CLIP_CAPTION_STYLE,
  normalizeClipCaptionStyle,
  type ClipCaptionStyleConfig,
} from "@/lib/repurpose/caption-style-config";
import { srtUtils, type CaptionEntry } from "@/lib/srt-utils";

export type CaptionAssistMode =
  | "cleanup"
  | "simplify"
  | "add_emojis"
  | "highlight_keywords"
  | "remove_fillers";

export type CaptionRenderMode = "burned_in" | "external_srt" | "off";

export const PROFESSIONAL_CAPTION_PRESETS: Record<string, ClipCaptionStyleConfig> = {
  minimal_clean: normalizeClipCaptionStyle({
    ...DEFAULT_CLIP_CAPTION_STYLE,
    presetId: "modern",
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: 700,
    primaryColor: "#FFFFFF",
    emphasisColor: "#38BDF8",
    background: false,
    outline: true,
    position: "bottom",
    animation: { type: "none", wordHighlight: false, speed: "normal" },
  }),
  hormozi_bold: normalizeClipCaptionStyle({
    ...DEFAULT_CLIP_CAPTION_STYLE,
    presetId: "viral",
    fontFamily: "Arial",
    fontSize: 64,
    fontWeight: 900,
    primaryColor: "#FFFFFF",
    emphasisColor: "#FACC15",
    background: true,
    backgroundOpacity: 0.2,
    outline: true,
    uppercase: true,
    animation: { type: "pop", wordHighlight: false, speed: "fast" },
  }),
  karaoke_highlight: normalizeClipCaptionStyle({
    ...DEFAULT_CLIP_CAPTION_STYLE,
    presetId: "karaoke",
    fontSize: 58,
    primaryColor: "#FFFFFF",
    emphasisColor: "#FACC15",
    karaoke: true,
    animation: { type: "karaoke", wordHighlight: true, speed: "normal" },
  }),
  podcast_subtitle: normalizeClipCaptionStyle({
    ...DEFAULT_CLIP_CAPTION_STYLE,
    presetId: "minimal",
    fontSize: 44,
    fontWeight: 600,
    primaryColor: "#F8FAFC",
    emphasisColor: "#F8FAFC",
    background: true,
    backgroundOpacity: 0.55,
    position: "bottom",
  }),
  news_explainer: normalizeClipCaptionStyle({
    ...DEFAULT_CLIP_CAPTION_STYLE,
    presetId: "business",
    fontFamily: "Arial",
    fontSize: 48,
    primaryColor: "#FFFFFF",
    emphasisColor: "#60A5FA",
    background: true,
    backgroundColor: "#0F172A",
    backgroundOpacity: 0.72,
  }),
  creator_pop: normalizeClipCaptionStyle({
    ...DEFAULT_CLIP_CAPTION_STYLE,
    presetId: "creator_pop",
    fontSize: 60,
    primaryColor: "#FFFFFF",
    emphasisColor: "#FB923C",
    background: true,
    backgroundOpacity: 0.3,
    animation: { type: "pop", wordHighlight: true, speed: "fast" },
  }),
  gaming_reaction: normalizeClipCaptionStyle({
    ...DEFAULT_CLIP_CAPTION_STYLE,
    presetId: "gaming",
    fontSize: 62,
    primaryColor: "#FFFFFF",
    emphasisColor: "#22C55E",
    backgroundColor: "#111827",
    animation: { type: "bounce", wordHighlight: true, speed: "fast" },
  }),
  no_captions: normalizeClipCaptionStyle({
    ...DEFAULT_CLIP_CAPTION_STYLE,
    presetId: "none",
    background: false,
    outline: false,
    animation: { type: "none", wordHighlight: false, speed: "normal" },
  }),
};

export function applyCaptionPreset(preset: string, current?: unknown): ClipCaptionStyleConfig {
  const normalizedCurrent = normalizeClipCaptionStyle(current);
  const selected = PROFESSIONAL_CAPTION_PRESETS[preset] ?? PROFESSIONAL_CAPTION_PRESETS.minimal_clean;
  return {
    ...normalizedCurrent,
    ...selected,
    hookOverlays: normalizedCurrent.hookOverlays,
  };
}

export function validateCaptionCues(entries: CaptionEntry[]): CaptionEntry[] {
  const sorted = entries
    .map((entry) => ({
      ...entry,
      text: String(entry.text ?? "").replace(/\s+/g, " ").trim(),
      startMs: Math.max(0, Math.round(entry.startMs)),
      endMs: Math.max(0, Math.round(entry.endMs)),
    }))
    .filter((entry) => entry.text.length > 0 && entry.endMs > entry.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  let cursor = 0;
  return sorted.map((entry, index) => {
    const startMs = Math.max(cursor, entry.startMs);
    const endMs = Math.max(startMs + 120, entry.endMs);
    cursor = endMs;
    return {
      ...entry,
      index: index + 1,
      startMs,
      endMs,
    };
  });
}

export function splitCaptionCue(entries: CaptionEntry[], cueIndex: number): CaptionEntry[] {
  const entry = entries[cueIndex];
  if (!entry) return entries;
  const words = entry.text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1 || entry.endMs <= entry.startMs + 240) {
    return entries;
  }
  const midpoint = Math.ceil(words.length / 2);
  const midMs = Math.round((entry.startMs + entry.endMs) / 2);
  return validateCaptionCues([
    ...entries.slice(0, cueIndex),
    { ...entry, text: words.slice(0, midpoint).join(" "), endMs: midMs },
    { ...entry, text: words.slice(midpoint).join(" "), startMs: midMs },
    ...entries.slice(cueIndex + 1),
  ]);
}

export function mergeCaptionCues(entries: CaptionEntry[], cueIndex: number): CaptionEntry[] {
  const current = entries[cueIndex];
  const next = entries[cueIndex + 1];
  if (!current || !next) return entries;
  return validateCaptionCues([
    ...entries.slice(0, cueIndex),
    {
      ...current,
      endMs: next.endMs,
      text: `${current.text} ${next.text}`.replace(/\s+/g, " ").trim(),
    },
    ...entries.slice(cueIndex + 2),
  ]);
}

export function hideCaptionCue(entries: CaptionEntry[], cueIndex: number): CaptionEntry[] {
  return validateCaptionCues(entries.filter((_, index) => index !== cueIndex));
}

export function buildCaptionRenderPlan(input: {
  captionStyle?: unknown;
  includeCaptions: boolean;
  captionSrt?: string | null;
}): {
  mode: CaptionRenderMode;
  renderer: "ffmpeg_static" | "remotion_animated" | "none";
  warnings: string[];
} {
  const style = normalizeClipCaptionStyle(input.captionStyle);
  const warnings: string[] = [];
  if (!input.includeCaptions || style.presetId === "none") {
    return { mode: input.captionSrt ? "external_srt" : "off", renderer: "none", warnings };
  }
  const animation = style.animation?.type ?? "none";
  if (animation !== "none") {
    warnings.push("Animated captions use Remotion when enabled; FFmpeg falls back to static burn-in.");
    return { mode: "burned_in", renderer: "remotion_animated", warnings };
  }
  return { mode: "burned_in", renderer: "ffmpeg_static", warnings };
}

export function srtToEntries(srt?: string | null): CaptionEntry[] {
  return validateCaptionCues(srt ? srtUtils.parseSRT(srt) : []);
}
