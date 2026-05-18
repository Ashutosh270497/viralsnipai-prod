export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { container } from "@/lib/infrastructure/di/container";
import { TYPES } from "@/lib/infrastructure/di/types";
import { QueueExportUseCase } from "@/lib/application/use-cases/QueueExportUseCase";
import { ApiResponseBuilder, ErrorCodes } from "@/lib/api/response";
import {
  PLATFORM_EXPORT_PRESET_VALUES,
  resolvePlatformExportPreset,
  type ExportOutputType,
} from "@/lib/repurpose/export-presets";
import { createCompletedAssetExportJob, serializeExportJob } from "@/lib/repurpose/export-jobs";
import { getDefaultExportClipIds } from "@/lib/repurpose/review-workflow";
import {
  assertMediaUsageAllowed,
  recordMediaUsage,
  resolveUserPlanForMedia,
} from "@/lib/media/v1-media-policy";
import { assertSameOriginRequest } from "@/lib/security/origin";
import { consumeV1RateLimit, rateLimitResponse, V1_RATE_LIMITS } from "@/lib/security/rate-limit";

const jobSchema = z.object({
  projectId: z.string().min(1),
  clipIds: z.array(z.string().min(1)).optional(),
  selectionMode: z.enum(["selected", "approved", "export_ready", "eligible"]).optional().default("selected"),
  platformPreset: z.enum(PLATFORM_EXPORT_PRESET_VALUES).optional().default("youtube_shorts"),
  aspectRatio: z.enum(["9:16", "1:1", "4:5", "16:9"]).optional(),
  includeCaptions: z.boolean().optional().default(true),
  captionTrackId: z.string().nullable().optional(),
  layoutPreset: z.string().nullable().optional(),
  layoutConfig: z.record(z.any()).nullable().optional(),
  outputType: z.enum(["mp4", "srt", "vtt", "thumbnail", "zip"]).optional().default("mp4"),
  exportQuality: z.enum(["high", "standard"]).optional().default("high"),
  allowRejected: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const originError = assertSameOriginRequest(request);
  if (originError) return originError;

  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized("Authentication required");
  }

  const rateLimit = await consumeV1RateLimit({
    request,
    userId: user.id,
    routeKey: "export",
    rules: V1_RATE_LIMITS.EXPORT,
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit, "Exports are being requested too quickly. Please wait and try again.");
  }

  const json = await request.json().catch(() => null);
  const parsed = jobSchema.safeParse(json);
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid export job request", {
      errors: parsed.error.flatten(),
    });
  }

  const input = parsed.data;
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: user.id },
    include: { clips: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });

  if (!project) {
    return ApiResponseBuilder.notFound("Project not found");
  }

  const clipIds = resolveRequestedClipIds({
    requestedClipIds: input.clipIds ?? [],
    selectionMode: input.selectionMode,
    clips: project.clips,
    allowRejected: input.allowRejected,
  });

  if (clipIds.length === 0) {
    return ApiResponseBuilder.badRequest("No eligible clips selected for export");
  }

  if (input.outputType === "zip") {
    return ApiResponseBuilder.badRequest(
      "ZIP packaging is not available yet. Export MP4 clips first, then download completed assets individually."
    );
  }

  const platform = resolvePlatformExportPreset(input.platformPreset);

  if (input.outputType !== "mp4") {
    try {
      const exportRecord = await createCompletedAssetExportJob({
        projectId: project.id,
        userId: user.id,
        clipIds,
        outputType: input.outputType as Exclude<ExportOutputType, "mp4" | "zip">,
        platformPreset: platform.id,
      });

      return ApiResponseBuilder.success(
        { job: serializeExportJob(exportRecord), export: exportRecord },
        "Export asset created"
      );
    } catch (error) {
      return ApiResponseBuilder.badRequest(error instanceof Error ? error.message : "Could not create export asset");
    }
  }

  const billingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, subscriptionTier: true },
  });
  const plan = resolveUserPlanForMedia(billingUser ?? {});
  const usageGate = await assertMediaUsageAllowed({
    userId: user.id,
    plan,
    feature: "video_export",
  });

  if (!usageGate.allowed) {
    return ApiResponseBuilder.errorResponse(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      `Monthly export limit reached for your ${plan} plan.`,
      429,
      {
        limit: usageGate.limit,
        used: usageGate.used,
        remaining: 0,
      },
    );
  }

  const useCase = container.get<QueueExportUseCase>(TYPES.QueueExportUseCase);
  const output = await useCase.execute({
    projectId: project.id,
    clipIds,
    preset: platform.legacyPreset,
    platformPreset: platform.id,
    aspectRatio: input.aspectRatio ?? platform.aspectRatio,
    includeCaptions: input.includeCaptions,
    captionTrackId: input.captionTrackId ?? null,
    layoutPreset: input.layoutPreset ?? null,
    layoutConfig: input.layoutConfig ?? null,
    exportQuality: input.exportQuality,
    allowRejected: input.allowRejected,
    outputFormat: "mp4",
    userId: user.id,
  });

  // TODO: Replace simple check + record with transactional quota reservation
  // before scaling concurrent export workers.
  await recordMediaUsage({
    userId: user.id,
    feature: "video_export",
    metadata: {
      projectId: project.id,
      exportId: output.export.id,
      clipIds,
      clipCount: clipIds.length,
      platformPreset: platform.id,
      exportQuality: input.exportQuality,
      includeCaptions: input.includeCaptions,
    },
  });

  return ApiResponseBuilder.success(
    { job: serializeExportJob(output.export), export: output.export, queued: output.queued },
    "Export job queued"
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized("Authentication required");
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return ApiResponseBuilder.badRequest("projectId is required");
  }

  const exports = await prisma.export.findMany({
    where: { projectId, project: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ApiResponseBuilder.success({ jobs: exports.map((job) => serializeExportJob(job)) });
}

function resolveRequestedClipIds(params: {
  requestedClipIds: string[];
  selectionMode: "selected" | "approved" | "export_ready" | "eligible";
  clips: Array<{ id: string; reviewStatus: string }>;
  allowRejected: boolean;
}) {
  const eligibleClips = params.clips.filter((clip) => {
    if (params.allowRejected) return true;
    return clip.reviewStatus !== "rejected";
  });

  if (params.selectionMode === "approved") {
    return eligibleClips.filter((clip) => clip.reviewStatus === "approved").map((clip) => clip.id);
  }
  if (params.selectionMode === "export_ready") {
    return eligibleClips.filter((clip) => clip.reviewStatus === "export_ready").map((clip) => clip.id);
  }
  if (params.selectionMode === "eligible") {
    return getDefaultExportClipIds(eligibleClips as any);
  }

  const allowed = new Set(eligibleClips.map((clip) => clip.id));
  return params.requestedClipIds.filter((id) => allowed.has(id));
}
