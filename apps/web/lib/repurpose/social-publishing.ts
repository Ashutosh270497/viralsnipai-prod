import { randomBytes } from "crypto";
import { z } from "zod";

import { openRouterJson } from "@/lib/ai/providers/openrouter-reasoning-provider";

export const SOCIAL_PLATFORMS = [
  "youtube_shorts",
  "instagram_reels",
  "tiktok",
  "x",
  "linkedin",
  "facebook_reels",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_POST_STATUSES = [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
] as const;

export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export const SHARE_LINK_PERMISSIONS = ["view", "review", "approve"] as const;
export type ShareLinkPermission = (typeof SHARE_LINK_PERMISSIONS)[number];

export const socialPlatformSchema = z.enum(SOCIAL_PLATFORMS);
export const socialPostStatusSchema = z.enum(SOCIAL_POST_STATUSES);
export const shareLinkPermissionSchema = z.enum(SHARE_LINK_PERMISSIONS);

export const socialPostDraftSchema = z.object({
  projectId: z.string().min(1),
  clipId: z.string().min(1),
  exportJobId: z.string().min(1).nullable().optional(),
  platform: socialPlatformSchema,
  title: z.string().max(120).nullable().optional(),
  description: z.string().max(2800).nullable().optional(),
  hashtags: z.array(z.string().trim().min(1).max(60)).max(30).optional().default([]),
  cta: z.string().max(240).nullable().optional(),
  thumbnailUrl: z.string().max(2048).nullable().optional(),
  videoUrl: z.string().max(2048).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});

export const socialPostPatchSchema = socialPostDraftSchema.partial().extend({
  status: socialPostStatusSchema.optional(),
});

export const scheduleSocialPostSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const socialCaptionGenerationSchema = z.object({
  platform: socialPlatformSchema,
  clipTitle: z.string().optional().default(""),
  clipSummary: z.string().optional().default(""),
  transcriptExcerpt: z.string().optional().default(""),
  audience: z.string().optional(),
  tone: z.string().optional(),
  cta: z.string().optional(),
});

export const shareLinkCreateSchema = z.object({
  projectId: z.string().min(1),
  clipId: z.string().min(1).nullable().optional(),
  permission: shareLinkPermissionSchema.optional().default("view"),
  expiresAt: z.string().datetime().nullable().optional(),
});

const GeneratedSocialCopySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2800),
  hashtags: z.array(z.string().min(1).max(60)).max(20),
  cta: z.string().nullable().optional(),
  titleVariations: z.array(z.string().min(1).max(120)).max(5).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
});

const GeneratedSocialCopyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "hashtags"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    cta: { type: ["string", "null"] },
    titleVariations: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

export type GeneratedSocialCopy = z.infer<typeof GeneratedSocialCopySchema> & { model: string };

export function generateShareToken() {
  return randomBytes(24).toString("base64url");
}

export function normalizeHashtags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`))
    .slice(0, 30);
}

export function platformLabel(platform: SocialPlatform | string) {
  switch (platform) {
    case "youtube_shorts":
      return "YouTube Shorts";
    case "instagram_reels":
      return "Instagram Reels";
    case "tiktok":
      return "TikTok";
    case "x":
      return "X";
    case "linkedin":
      return "LinkedIn";
    case "facebook_reels":
      return "Facebook Reels";
    default:
      return String(platform);
  }
}

export function platformGuidance(platform: SocialPlatform) {
  switch (platform) {
    case "youtube_shorts":
      return "Punchy title, concise description, 3-6 discoverability hashtags.";
    case "instagram_reels":
      return "Conversational hook, CTA, readable hashtags, creator tone.";
    case "tiktok":
      return "Native, direct, curiosity-first, sparse hashtags.";
    case "x":
      return "Short post copy, clear point of view, minimal hashtags.";
    case "linkedin":
      return "Professional context, outcome-led hook, useful takeaway.";
    case "facebook_reels":
      return "Accessible caption, broad appeal, low jargon.";
  }
}

export async function generatePlatformSocialCopy(
  input: z.infer<typeof socialCaptionGenerationSchema>,
): Promise<GeneratedSocialCopy> {
  const model = process.env.OPENROUTER_METADATA_MODEL ?? "google/gemini-3.1-flash-lite-preview";
  const result = await openRouterJson({
    model,
    schema: GeneratedSocialCopySchema,
    jsonSchema: GeneratedSocialCopyJsonSchema,
    system: [
      "You generate platform-specific social post metadata for short-form video clips.",
      "OpenRouter is used for creative copy only.",
      "Never create, infer, alter, or mention video timestamps.",
      "Return JSON only.",
    ].join("\n"),
    user: {
      ...input,
      platformLabel: platformLabel(input.platform),
      platformGuidance: platformGuidance(input.platform),
      transcriptExcerpt: input.transcriptExcerpt.slice(0, 3500),
    },
    maxTokens: 1400,
  });

  return {
    ...result.data,
    hashtags: normalizeHashtags(result.data.hashtags),
    titleVariations: result.data.titleVariations ?? [],
    warnings: result.data.warnings ?? [],
    model: result.model,
  };
}

export interface SocialPublisherAdapter {
  validateConnection(userId: string, platform: SocialPlatform): Promise<{ ok: boolean; reason?: string }>;
  publish(post: {
    id: string;
    platform: SocialPlatform;
    title?: string | null;
    description?: string | null;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    scheduledAt?: Date | string | null;
  }): Promise<{ externalId?: string; url?: string; status: "published" | "scheduled" }>;
  getStatus(post: { id: string }): Promise<{ status: SocialPostStatus; externalId?: string | null }>;
  deleteScheduled(post: { id: string }): Promise<{ ok: boolean }>;
}

export class MockPublisherAdapter implements SocialPublisherAdapter {
  async validateConnection(
    _userId: string,
    _platform: SocialPlatform,
  ): Promise<{ ok: boolean; reason?: string }> {
    return { ok: true };
  }

  async publish(post: {
    id: string;
    platform: SocialPlatform;
    title?: string | null;
    description?: string | null;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    scheduledAt?: Date | string | null;
  }): Promise<{ externalId?: string; url?: string; status: "published" | "scheduled" }> {
    const scheduledAt = post.scheduledAt ? new Date(post.scheduledAt).getTime() : null;
    const isFuture = typeof scheduledAt === "number" && scheduledAt > Date.now();
    return {
      externalId: `mock_${post.id}`,
      url: `/repurpose/export?mockPublished=${post.id}`,
      status: isFuture ? "scheduled" as const : "published" as const,
    };
  }

  async getStatus() {
    return { status: "published" as const };
  }

  async deleteScheduled() {
    return { ok: true };
  }
}

class PlaceholderPublisherAdapter implements SocialPublisherAdapter {
  constructor(private readonly label: string) {}

  async validateConnection(): Promise<{ ok: boolean; reason?: string }> {
    return {
      ok: false,
      reason: `${this.label} publishing is not connected yet. Save drafts and schedule with the mock adapter for now.`,
    };
  }

  async publish(_post: {
    id: string;
    platform: SocialPlatform;
    title?: string | null;
    description?: string | null;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    scheduledAt?: Date | string | null;
  }): Promise<{ externalId?: string; url?: string; status: "published" | "scheduled" }> {
    throw new Error(`${this.label} publishing is coming soon. Connect later when OAuth credentials are configured.`);
  }

  async getStatus(): Promise<{ status: SocialPostStatus; externalId?: string | null }> {
    return { status: "failed" as const };
  }

  async deleteScheduled() {
    return { ok: false };
  }
}

export class YouTubePublisherAdapter extends PlaceholderPublisherAdapter {
  constructor() { super("YouTube Shorts"); }
}

export class TikTokPublisherAdapter extends PlaceholderPublisherAdapter {
  constructor() { super("TikTok"); }
}

export class InstagramPublisherAdapter extends PlaceholderPublisherAdapter {
  constructor() { super("Instagram Reels"); }
}

export class XPublisherAdapter extends PlaceholderPublisherAdapter {
  constructor() { super("X"); }
}

export class LinkedInPublisherAdapter extends PlaceholderPublisherAdapter {
  constructor() { super("LinkedIn"); }
}

export function getPublisherAdapter(platform: SocialPlatform, mode: "mock" | "real" = "mock") {
  if (mode === "mock") return new MockPublisherAdapter();
  switch (platform) {
    case "youtube_shorts":
      return new YouTubePublisherAdapter();
    case "instagram_reels":
    case "facebook_reels":
      return new InstagramPublisherAdapter();
    case "tiktok":
      return new TikTokPublisherAdapter();
    case "x":
      return new XPublisherAdapter();
    case "linkedin":
      return new LinkedInPublisherAdapter();
  }
}

export function serializeSocialPost(row: any) {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    clipId: row.clipId,
    exportJobId: row.exportJobId ?? null,
    platform: row.platform,
    status: row.status,
    title: row.title ?? null,
    description: row.description ?? null,
    hashtags: normalizeHashtags(row.hashtags),
    cta: row.cta ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    videoUrl: row.videoUrl ?? null,
    scheduledAt: row.scheduledAt?.toISOString?.() ?? row.scheduledAt ?? null,
    publishedAt: row.publishedAt?.toISOString?.() ?? row.publishedAt ?? null,
    error: row.error ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

export function serializeShareLink(row: any) {
  return {
    id: row.id,
    projectId: row.projectId,
    clipId: row.clipId ?? null,
    token: row.token,
    permission: row.permission,
    expiresAt: row.expiresAt?.toISOString?.() ?? row.expiresAt ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    url: `/share/repurpose/${row.token}`,
  };
}
