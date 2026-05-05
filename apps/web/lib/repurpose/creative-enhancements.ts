import { z } from "zod";

import {
  normalizeClipCaptionStyle,
  type ClipCaptionStyleConfig,
  type HookOverlay,
} from "@/lib/repurpose/caption-style-config";

export const CLIP_ENHANCEMENT_TYPES = [
  "b_roll",
  "text_overlay",
  "emoji",
  "keyword_highlight",
  "cta_card",
  "sound_effect",
  "music_bed",
] as const;

export type ClipEnhancementType = (typeof CLIP_ENHANCEMENT_TYPES)[number];

export type ClipEnhancement = {
  id: string;
  clipId: string;
  type: ClipEnhancementType;
  startMs: number;
  endMs: number;
  payload: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export const clipEnhancementPayloadSchema = z.record(z.any()).default({});

export const clipEnhancementSchema = z
  .object({
    type: z.enum(CLIP_ENHANCEMENT_TYPES),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(1),
    payload: clipEnhancementPayloadSchema,
    enabled: z.boolean().default(true),
  })
  .refine((value) => value.endMs > value.startMs, {
    message: "endMs must be greater than startMs",
    path: ["endMs"],
  });

export const clipEnhancementPatchSchema = z
  .object({
    type: z.enum(CLIP_ENHANCEMENT_TYPES).optional(),
    startMs: z.number().int().min(0).optional(),
    endMs: z.number().int().min(1).optional(),
    payload: clipEnhancementPayloadSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (value) => {
      if (value.startMs === undefined || value.endMs === undefined) return true;
      return value.endMs > value.startMs;
    },
    { message: "endMs must be greater than startMs", path: ["endMs"] },
  );

export type ClipEnhancementInput = z.infer<typeof clipEnhancementSchema>;

export const bRollSuggestionSchema = z.object({
  searchQuery: z.string().min(1).max(120),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  reason: z.string().max(500).default(""),
  visualStyle: z.string().max(120).default("editorial b-roll"),
  priority: z.number().min(0).max(100).default(50),
});

export const bRollSuggestionsResponseSchema = z.object({
  suggestions: z.array(bRollSuggestionSchema).max(8),
  warnings: z.array(z.string()).default([]),
});

export type BrollSuggestion = z.infer<typeof bRollSuggestionSchema>;

export function clampEnhancementToClip<T extends { startMs: number; endMs: number }>(
  input: T,
  clipDurationMs: number,
): T | null {
  const duration = Math.max(1, Math.round(clipDurationMs));
  const startMs = Math.max(0, Math.min(duration - 1, Math.round(input.startMs)));
  const endMs = Math.max(startMs + 100, Math.min(duration, Math.round(input.endMs)));
  if (endMs <= startMs) return null;
  return { ...input, startMs, endMs };
}

export function normalizeEnhancementPayload(
  type: ClipEnhancementType,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (type === "text_overlay" || type === "cta_card") {
    return {
      text: getString(payload.text, type === "cta_card" ? "Follow for more" : "Key moment"),
      position: getChoice(payload.position, ["top", "center", "bottom"], type === "cta_card" ? "bottom" : "top"),
      align: getChoice(payload.align, ["left", "center", "right"], "center"),
      style: getString(payload.style, type === "cta_card" ? "cta" : "bold"),
      textColor: normalizeHex(payload.textColor, "#FFFFFF"),
      backgroundColor: normalizeHex(payload.backgroundColor, type === "cta_card" ? "#2563EB" : "#000000"),
      backgroundOpacity: getNumber(payload.backgroundOpacity, 0, 1, type === "cta_card" ? 0.76 : 0.55),
      fontSize: getNumber(payload.fontSize, 24, 140, type === "cta_card" ? 54 : 62),
      bold: payload.bold !== false,
      italic: payload.italic === true,
    };
  }

  if (type === "emoji") {
    return {
      emoji: getString(payload.emoji, "✨").slice(0, 8),
      label: getString(payload.label, ""),
      position: getChoice(payload.position, ["top", "center", "bottom"], "center"),
      align: getChoice(payload.align, ["left", "center", "right"], "center"),
      fontSize: getNumber(payload.fontSize, 36, 150, 86),
    };
  }

  if (type === "keyword_highlight") {
    return {
      keyword: getString(payload.keyword, getString(payload.text, "keyword")).slice(0, 40),
      color: normalizeHex(payload.color, "#FACC15"),
      position: getChoice(payload.position, ["top", "center", "bottom"], "center"),
      align: getChoice(payload.align, ["left", "center", "right"], "center"),
      fontSize: getNumber(payload.fontSize, 28, 140, 68),
    };
  }

  if (type === "b_roll") {
    return {
      searchQuery: getString(payload.searchQuery, getString(payload.query, "relevant b-roll")),
      reason: getString(payload.reason, ""),
      visualStyle: getString(payload.visualStyle, "editorial"),
      priority: getNumber(payload.priority, 0, 100, 50),
      mediaUrl: typeof payload.mediaUrl === "string" ? payload.mediaUrl : null,
      assetPath: typeof payload.assetPath === "string" ? payload.assetPath : null,
    };
  }

  if (type === "sound_effect" || type === "music_bed") {
    return {
      label: getString(payload.label, type === "music_bed" ? "Background music" : "Sound effect"),
      volume: getNumber(payload.volume, 0, 1, type === "music_bed" ? 0.18 : 0.65),
      fadeInMs: getNumber(payload.fadeInMs, 0, 5000, 0),
      fadeOutMs: getNumber(payload.fadeOutMs, 0, 5000, 0),
      muteOriginal: payload.muteOriginal === true,
      normalizeLoudness: payload.normalizeLoudness !== false,
      audioUrl: typeof payload.audioUrl === "string" ? payload.audioUrl : null,
    };
  }

  return payload;
}

export function buildEnhancementRenderPlan(enhancements: ClipEnhancement[]) {
  const enabled = enhancements.filter((item) => item.enabled);
  return {
    overlays: enabled.filter((item) =>
      ["text_overlay", "emoji", "keyword_highlight", "cta_card"].includes(item.type),
    ),
    bRoll: enabled.filter((item) => item.type === "b_roll"),
    audio: enabled.filter((item) => item.type === "sound_effect" || item.type === "music_bed"),
    warnings: enabled
      .filter((item) => item.type === "b_roll" && !item.payload.mediaUrl && !item.payload.assetPath)
      .map((item) => `B-roll "${String(item.payload.searchQuery ?? item.id)}" has no media attached yet.`),
  };
}

export function mergeEnhancementsIntoCaptionStyle(
  captionStyle: unknown,
  enhancements: ClipEnhancement[],
): ClipCaptionStyleConfig {
  const style = normalizeClipCaptionStyle(captionStyle);
  const enhancementOverlays = enhancementsToHookOverlays(enhancements);
  return {
    ...style,
    hookOverlays: [...style.hookOverlays, ...enhancementOverlays].slice(0, 12),
    keywordHighlightEnabled:
      style.keywordHighlightEnabled ||
      enhancements.some((enhancement) => enhancement.enabled && enhancement.type === "keyword_highlight"),
    emojiEnabled:
      style.emojiEnabled ||
      enhancements.some((enhancement) => enhancement.enabled && enhancement.type === "emoji"),
  };
}

export function enhancementsToHookOverlays(enhancements: ClipEnhancement[]): HookOverlay[] {
  return enhancements
    .filter((enhancement) => enhancement.enabled)
    .map((enhancement) => {
      if (enhancement.type === "text_overlay" || enhancement.type === "cta_card") {
        const payload = normalizeEnhancementPayload(enhancement.type, enhancement.payload);
        return {
          id: enhancement.id,
          text: String(payload.text),
          startMs: enhancement.startMs,
          endMs: enhancement.endMs,
          position: payload.position as HookOverlay["position"],
          align: payload.align as HookOverlay["align"],
          fontSize: Number(payload.fontSize),
          textColor: String(payload.textColor),
          backgroundColor: String(payload.backgroundColor),
          backgroundOpacity: Number(payload.backgroundOpacity),
          bold: Boolean(payload.bold),
          italic: Boolean(payload.italic),
        };
      }

      if (enhancement.type === "emoji") {
        const payload = normalizeEnhancementPayload(enhancement.type, enhancement.payload);
        return {
          id: enhancement.id,
          text: [payload.emoji, payload.label].filter(Boolean).join(" "),
          startMs: enhancement.startMs,
          endMs: enhancement.endMs,
          position: payload.position as HookOverlay["position"],
          align: payload.align as HookOverlay["align"],
          fontSize: Number(payload.fontSize),
          textColor: "#FFFFFF",
          backgroundColor: "#000000",
          backgroundOpacity: 0,
          bold: true,
          italic: false,
        };
      }

      if (enhancement.type === "keyword_highlight") {
        const payload = normalizeEnhancementPayload(enhancement.type, enhancement.payload);
        return {
          id: enhancement.id,
          text: String(payload.keyword).toUpperCase(),
          startMs: enhancement.startMs,
          endMs: enhancement.endMs,
          position: payload.position as HookOverlay["position"],
          align: payload.align as HookOverlay["align"],
          fontSize: Number(payload.fontSize),
          textColor: String(payload.color),
          backgroundColor: "#000000",
          backgroundOpacity: 0.2,
          bold: true,
          italic: false,
        };
      }

      return null;
    })
    .filter((overlay): overlay is HookOverlay => overlay !== null);
}

export function serializeEnhancement(row: any): ClipEnhancement {
  return {
    id: row.id,
    clipId: row.clipId,
    type: row.type,
    startMs: row.startMs,
    endMs: row.endMs,
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
    enabled: Boolean(row.enabled),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function getString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function getChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === "string" && (choices as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function normalizeHex(input: unknown, fallback: string) {
  if (typeof input !== "string") return fallback;
  const value = input.trim();
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value) ? value.toUpperCase() : fallback;
}
