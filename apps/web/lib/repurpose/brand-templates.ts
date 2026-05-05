import { z } from "zod";

import {
  DEFAULT_CLIP_CAPTION_STYLE,
  normalizeClipCaptionStyle,
  type ClipCaptionStyleConfig,
} from "@/lib/repurpose/caption-style-config";
import {
  normalizeClipLayoutConfig,
  type ClipLayoutConfig,
} from "@/lib/repurpose/layout-config";
import { PROFESSIONAL_CAPTION_PRESETS } from "@/lib/repurpose/caption-studio";
import { PLATFORM_EXPORT_PRESETS, type PlatformExportPresetId } from "@/lib/repurpose/export-presets";
import type { Clip, ViralityFactors } from "@/lib/types";

export type BrandTemplateRecord = {
  id: string;
  userId?: string | null;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isBuiltIn?: boolean;
  captionStyle?: ClipCaptionStyleConfig | null;
  layoutConfig?: ClipLayoutConfig | null;
  overlayStyle?: Record<string, unknown> | null;
  logoAssetId?: string | null;
  logoUrl?: string | null;
  watermarkConfig?: Record<string, unknown> | null;
  introConfig?: Record<string, unknown> | null;
  outroConfig?: Record<string, unknown> | null;
  defaultCTA?: string | null;
  defaultPlatformPresets?: PlatformExportPresetId[];
  createdAt?: string;
  updatedAt?: string;
};

export const brandTemplateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(400).nullable().optional(),
  isDefault: z.boolean().optional(),
  captionStyle: z.record(z.any()).nullable().optional(),
  layoutConfig: z.record(z.any()).nullable().optional(),
  overlayStyle: z.record(z.any()).nullable().optional(),
  logoAssetId: z.string().max(160).nullable().optional(),
  logoUrl: z.string().max(1000).nullable().optional(),
  watermarkConfig: z.record(z.any()).nullable().optional(),
  introConfig: z.record(z.any()).nullable().optional(),
  outroConfig: z.record(z.any()).nullable().optional(),
  defaultCTA: z.string().max(220).nullable().optional(),
  defaultPlatformPresets: z.array(z.string()).nullable().optional(),
  builtinId: z.string().optional(),
});

export const brandTemplatePatchSchema = brandTemplateSchema.partial().extend({
  isDefault: z.boolean().optional(),
});

export const applyBrandTemplateSchema = z.object({
  scope: z.enum(["current_clip", "selected_clips", "project"]),
  clipId: z.string().optional(),
  clipIds: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  overwrite: z.boolean().default(false),
});

const cleanModernCaption = normalizeClipCaptionStyle(PROFESSIONAL_CAPTION_PRESETS.minimal_clean);
const boldCaption = normalizeClipCaptionStyle(PROFESSIONAL_CAPTION_PRESETS.hormozi_bold);
const podcastCaption = normalizeClipCaptionStyle(PROFESSIONAL_CAPTION_PRESETS.podcast_subtitle);
const newsCaption = normalizeClipCaptionStyle(PROFESSIONAL_CAPTION_PRESETS.news_explainer);
const gamingCaption = normalizeClipCaptionStyle(PROFESSIONAL_CAPTION_PRESETS.gaming_reaction);
const creatorCaption = normalizeClipCaptionStyle(PROFESSIONAL_CAPTION_PRESETS.creator_pop);

export const BUILT_IN_BRAND_TEMPLATES: BrandTemplateRecord[] = [
  {
    id: "builtin:minimal_clean",
    name: "Minimal Clean",
    description: "Quiet captions, center crop, watermark-ready export defaults.",
    isDefault: false,
    isBuiltIn: true,
    captionStyle: cleanModernCaption,
    layoutConfig: layout("center_crop", "9:16"),
    overlayStyle: overlay("#FFFFFF", "#0B0B12", "top"),
    defaultCTA: "Follow for more.",
    defaultPlatformPresets: ["youtube_shorts", "instagram_reels", "tiktok"],
  },
  {
    id: "builtin:hormozi_bold",
    name: "Hormozi Bold",
    description: "Large punchy captions with yellow emphasis and CTA overlays.",
    isDefault: false,
    isBuiltIn: true,
    captionStyle: boldCaption,
    layoutConfig: layout("speaker_focus", "9:16"),
    overlayStyle: overlay("#FFFFFF", "#111827", "center", "#FACC15"),
    defaultCTA: "Save this and follow for the next part.",
    defaultPlatformPresets: ["youtube_shorts", "instagram_reels", "tiktok"],
  },
  {
    id: "builtin:podcast_pro",
    name: "Podcast Pro",
    description: "Professional lower captions and speaker-focused vertical framing.",
    isDefault: false,
    isBuiltIn: true,
    captionStyle: podcastCaption,
    layoutConfig: layout("podcast_two_speaker", "9:16"),
    overlayStyle: overlay("#F8FAFC", "#020617", "bottom"),
    defaultCTA: "Listen to the full episode.",
    defaultPlatformPresets: ["youtube_shorts", "linkedin", "x_video"],
  },
  {
    id: "builtin:founder_business",
    name: "Founder/Business",
    description: "Clean business look for product, founder, and thought-leadership clips.",
    isDefault: false,
    isBuiltIn: true,
    captionStyle: creatorCaption,
    layoutConfig: layout("screen_share_speaker", "4:5"),
    overlayStyle: overlay("#FFFFFF", "#1D4ED8", "top", "#93C5FD"),
    defaultCTA: "DM me for the playbook.",
    defaultPlatformPresets: ["linkedin", "x_video", "square_feed"],
  },
  {
    id: "builtin:educational",
    name: "Educational",
    description: "High-readability captions and safe zones for tutorials.",
    isDefault: false,
    isBuiltIn: true,
    captionStyle: normalizeClipCaptionStyle({
      ...DEFAULT_CLIP_CAPTION_STYLE,
      fontSize: 50,
      primaryColor: "#FFFFFF",
      emphasisColor: "#22C55E",
      backgroundColor: "#052E16",
      backgroundOpacity: 0.58,
    }),
    layoutConfig: layout("center_crop", "9:16"),
    overlayStyle: overlay("#FFFFFF", "#166534", "top", "#86EFAC"),
    defaultCTA: "Save this lesson for later.",
    defaultPlatformPresets: ["youtube_shorts", "instagram_reels", "linkedin"],
  },
  {
    id: "builtin:gaming_reaction",
    name: "Gaming/Reaction",
    description: "Energetic captions, bounce-ready styling, and reaction overlays.",
    isDefault: false,
    isBuiltIn: true,
    captionStyle: gamingCaption,
    layoutConfig: layout("picture_in_picture", "9:16"),
    overlayStyle: overlay("#FFFFFF", "#111827", "center", "#22C55E"),
    defaultCTA: "Follow for more reactions.",
    defaultPlatformPresets: ["tiktok", "youtube_shorts", "instagram_reels"],
  },
  {
    id: "builtin:news_explainer",
    name: "News Explainer",
    description: "Structured explainer look with strong contrast and square/portrait export defaults.",
    isDefault: false,
    isBuiltIn: true,
    captionStyle: newsCaption,
    layoutConfig: layout("square_letterbox", "1:1"),
    overlayStyle: overlay("#FFFFFF", "#0F172A", "top", "#60A5FA"),
    defaultCTA: "Share this with someone following the story.",
    defaultPlatformPresets: ["square_feed", "linkedin", "x_video"],
  },
];

export function serializeBrandTemplate(row: any): BrandTemplateRecord {
  return {
    id: row.id,
    userId: row.userId ?? null,
    name: row.name,
    description: row.description ?? null,
    isDefault: Boolean(row.isDefault),
    isBuiltIn: false,
    captionStyle: row.captionStyle ? normalizeClipCaptionStyle(row.captionStyle) : null,
    layoutConfig: row.layoutConfig ? normalizeClipLayoutConfig(row.layoutConfig) : null,
    overlayStyle: objectOrNull(row.overlayStyle),
    logoAssetId: row.logoAssetId ?? null,
    logoUrl: row.logoUrl ?? null,
    watermarkConfig: objectOrNull(row.watermarkConfig),
    introConfig: objectOrNull(row.introConfig),
    outroConfig: objectOrNull(row.outroConfig),
    defaultCTA: row.defaultCTA ?? null,
    defaultPlatformPresets: normalizePlatformPresets(row.defaultPlatformPresets),
    createdAt: dateToIso(row.createdAt),
    updatedAt: dateToIso(row.updatedAt),
  };
}

export function getBuiltInBrandTemplate(id: string) {
  return BUILT_IN_BRAND_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function normalizeBrandTemplateInput(input: unknown, fallback?: BrandTemplateRecord) {
  const parsed = brandTemplateSchema.parse(input);
  const builtIn = parsed.builtinId ? getBuiltInBrandTemplate(parsed.builtinId) : null;
  const name = parsed.name ?? fallback?.name ?? builtIn?.name ?? "Brand template";
  return {
    name,
    description: parsed.description ?? fallback?.description ?? builtIn?.description ?? null,
    isDefault: parsed.isDefault ?? fallback?.isDefault ?? false,
    captionStyle: parsed.captionStyle
      ? normalizeClipCaptionStyle(parsed.captionStyle)
      : fallback?.captionStyle ?? builtIn?.captionStyle ?? cleanModernCaption,
    layoutConfig: parsed.layoutConfig
      ? normalizeClipLayoutConfig(parsed.layoutConfig)
      : fallback?.layoutConfig ?? builtIn?.layoutConfig ?? layout("center_crop", "9:16"),
    overlayStyle: objectOrNull(parsed.overlayStyle) ?? fallback?.overlayStyle ?? builtIn?.overlayStyle ?? overlay("#FFFFFF", "#0B0B12", "top"),
    logoAssetId: parsed.logoAssetId ?? fallback?.logoAssetId ?? builtIn?.logoAssetId ?? null,
    logoUrl: parsed.logoUrl ?? fallback?.logoUrl ?? builtIn?.logoUrl ?? null,
    watermarkConfig: objectOrNull(parsed.watermarkConfig) ?? fallback?.watermarkConfig ?? builtIn?.watermarkConfig ?? { enabled: true },
    introConfig: objectOrNull(parsed.introConfig) ?? fallback?.introConfig ?? builtIn?.introConfig ?? { enabled: false },
    outroConfig: objectOrNull(parsed.outroConfig) ?? fallback?.outroConfig ?? builtIn?.outroConfig ?? { enabled: false },
    defaultCTA: parsed.defaultCTA ?? fallback?.defaultCTA ?? builtIn?.defaultCTA ?? null,
    defaultPlatformPresets:
      normalizePlatformPresets(parsed.defaultPlatformPresets) ??
      fallback?.defaultPlatformPresets ??
      builtIn?.defaultPlatformPresets ??
      ["youtube_shorts", "instagram_reels", "tiktok"],
  };
}

export function buildClipUpdateFromBrandTemplate(
  clip: Pick<Clip, "viralityFactors" | "callToAction">,
  template: BrandTemplateRecord,
  options?: { overwrite?: boolean; appliedAt?: string },
) {
  const overwrite = options?.overwrite ?? false;
  const metadata = getMetadata(clip.viralityFactors);
  const layoutConfig = template.layoutConfig ? normalizeClipLayoutConfig(template.layoutConfig) : null;
  const exportSettings =
    metadata.exportSettings && typeof metadata.exportSettings === "object"
      ? { ...(metadata.exportSettings as Record<string, unknown>) }
      : {};

  if (layoutConfig) {
    exportSettings.layoutPreset = layoutConfig.preset;
    exportSettings.aspectRatio = layoutConfig.aspectRatio;
  }

  const nextMetadata = {
    ...metadata,
    ...(layoutConfig
      ? {
          layoutConfig,
          layoutPreset: layoutConfig.preset,
        }
      : {}),
    brandTemplateId: template.id,
    brandTemplateName: template.name,
    brandTemplateAppliedAt: options?.appliedAt ?? new Date().toISOString(),
    overlayStyle: template.overlayStyle ?? null,
    watermarkConfig: template.watermarkConfig ?? null,
    logoUrl: template.logoUrl ?? null,
    defaultPlatformPresets: template.defaultPlatformPresets ?? null,
    exportSettings,
  };

  return {
    captionStyle: template.captionStyle ? normalizeClipCaptionStyle(template.captionStyle) : undefined,
    callToAction: overwrite || !clip.callToAction ? template.defaultCTA ?? clip.callToAction ?? null : clip.callToAction,
    viralityFactors: mergeViralityMetadata(clip.viralityFactors, nextMetadata),
  };
}

export function buildNewClipBrandDefaults(template: BrandTemplateRecord | null | undefined): {
  captionStyle?: ClipCaptionStyleConfig;
  callToAction?: string;
  brandMetadata?: Record<string, unknown>;
} {
  if (!template) return {};
  return {
    captionStyle: template.captionStyle ? normalizeClipCaptionStyle(template.captionStyle) : undefined,
    callToAction: template.defaultCTA ?? undefined,
    brandMetadata: {
      brandTemplateId: template.id,
      brandTemplateName: template.name,
      brandTemplateAppliedAt: new Date().toISOString(),
      ...(template.layoutConfig
        ? {
            layoutConfig: normalizeClipLayoutConfig(template.layoutConfig),
            layoutPreset: normalizeClipLayoutConfig(template.layoutConfig).preset,
          }
        : {}),
      overlayStyle: template.overlayStyle ?? null,
      watermarkConfig: template.watermarkConfig ?? null,
      logoUrl: template.logoUrl ?? null,
      defaultPlatformPresets: template.defaultPlatformPresets ?? null,
    },
  };
}

function layout(preset: ClipLayoutConfig["preset"], aspectRatio: ClipLayoutConfig["aspectRatio"]) {
  return normalizeClipLayoutConfig({
    preset,
    aspectRatio,
    backgroundMode: preset === "square_letterbox" ? "letterbox" : "crop",
    reason: "Brand template default layout",
  });
}

function overlay(textColor: string, backgroundColor: string, position: string, highlightColor = "#34D399") {
  return {
    textColor,
    backgroundColor,
    highlightColor,
    position,
    backgroundOpacity: 0.62,
    fontSize: 62,
    bold: true,
  };
}

function normalizePlatformPresets(value: unknown): PlatformExportPresetId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const valid = new Set(Object.keys(PLATFORM_EXPORT_PRESETS));
  const presets = value.filter((item): item is PlatformExportPresetId => typeof item === "string" && valid.has(item));
  return presets.length > 0 ? Array.from(new Set(presets)) : undefined;
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as Record<string, unknown>) } as Record<string, unknown>)
    : null;
}

function getMetadata(viralityFactors: unknown): Record<string, unknown> {
  if (!viralityFactors || typeof viralityFactors !== "object") return {};
  const metadata = (viralityFactors as { metadata?: unknown }).metadata;
  return metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};
}

function mergeViralityMetadata(
  viralityFactors: ViralityFactors | undefined | null,
  metadata: Record<string, unknown>,
): ViralityFactors {
  const current = (viralityFactors ?? {}) as Record<string, unknown>;
  return {
    hookStrength: typeof current.hookStrength === "number" ? current.hookStrength : 0,
    emotionalPeak: typeof current.emotionalPeak === "number" ? current.emotionalPeak : 0,
    storyArc: typeof current.storyArc === "number" ? current.storyArc : 0,
    pacing: typeof current.pacing === "number" ? current.pacing : 0,
    transcriptQuality: typeof current.transcriptQuality === "number" ? current.transcriptQuality : 0,
    shareability: typeof current.shareability === "number" ? current.shareability : undefined,
    reasoning: typeof current.reasoning === "string" ? current.reasoning : undefined,
    improvements: Array.isArray(current.improvements) ? (current.improvements as string[]) : undefined,
    enhancement: current.enhancement && typeof current.enhancement === "object" ? (current.enhancement as any) : undefined,
    qualitySignals: current.qualitySignals && typeof current.qualitySignals === "object" ? (current.qualitySignals as any) : undefined,
    reframePlans: Array.isArray(current.reframePlans) ? (current.reframePlans as any) : undefined,
    metadata,
  };
}

function dateToIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : undefined;
}
