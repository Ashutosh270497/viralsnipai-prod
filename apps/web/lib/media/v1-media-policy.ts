import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolvePlanTier, type PlanTier } from "@/lib/billing/plans";

export const V1_UPLOAD_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
export const V1_UPLOAD_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);

export type V1MediaUsageFeature = "video_upload" | "video_export";
export type PublicExportStatus = "queued" | "processing" | "completed" | "failed" | "retryable" | "cancelled";

const DEFAULT_UPLOAD_LIMITS: Record<PlanTier, number> = {
  free: 3,
  starter: 25,
  creator: 100,
  studio: 500,
};

const DEFAULT_EXPORT_LIMITS: Record<PlanTier, number> = {
  free: 5,
  starter: 50,
  creator: 250,
  studio: 1000,
};

export function getMaxUploadBytes() {
  return readPositiveInt("MAX_UPLOAD_MB", 500) * 1024 * 1024;
}

export function getMaxVideoDurationSeconds() {
  return readPositiveInt("MAX_VIDEO_DURATION_SECONDS", 60 * 60);
}

export function resolveUserPlanForMedia(user: {
  plan?: string | null;
  subscriptionTier?: string | null;
}) {
  return resolvePlanTier(user.subscriptionTier ?? user.plan ?? "free");
}

export function getMediaUsageLimit(plan: PlanTier, feature: V1MediaUsageFeature) {
  const envKey = feature === "video_upload"
    ? `V1_${plan.toUpperCase()}_MONTHLY_UPLOAD_LIMIT`
    : `V1_${plan.toUpperCase()}_MONTHLY_EXPORT_LIMIT`;
  const fallback = feature === "video_upload"
    ? DEFAULT_UPLOAD_LIMITS[plan]
    : DEFAULT_EXPORT_LIMITS[plan];

  return readPositiveInt(envKey, fallback);
}

export async function getMediaUsageCount(userId: string, feature: V1MediaUsageFeature) {
  const since = startOfCurrentMonth();
  return prisma.usageLog.count({
    where: {
      userId,
      feature,
      createdAt: { gte: since },
    },
  });
}

export async function assertMediaUsageAllowed(params: {
  userId: string;
  plan: PlanTier;
  feature: V1MediaUsageFeature;
}) {
  const limit = getMediaUsageLimit(params.plan, params.feature);
  const used = await getMediaUsageCount(params.userId, params.feature);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

export async function recordMediaUsage(params: {
  userId: string;
  feature: V1MediaUsageFeature;
  metadata?: Record<string, unknown>;
}) {
  return prisma.usageLog.create({
    data: {
      userId: params.userId,
      feature: params.feature,
      creditsUsed: 1,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export function toPublicExportStatus(
  status: string,
  runtime?: { stage?: string | null; retryable?: boolean | null } | null,
): PublicExportStatus {
  if (status === "done" || status === "completed") return "completed";
  if (status === "failed" && runtime?.retryable) return "retryable";
  if (status === "cancelled") return "cancelled";
  if (status === "processing" || status === "queued") return status;
  if (runtime?.stage === "retrying") return "retryable";
  return status === "failed" ? "failed" : "queued";
}

export function publicExportMessage(status: PublicExportStatus) {
  switch (status) {
    case "queued":
      return "Your export is waiting to start.";
    case "processing":
      return "Your export is rendering.";
    case "completed":
      return "Your export is ready to download.";
    case "retryable":
      return "The export hit a temporary issue and is retrying.";
    case "cancelled":
      return "This export was cancelled.";
    case "failed":
    default:
      return "The export failed. Please try again or choose fewer clips.";
  }
}

function readPositiveInt(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
