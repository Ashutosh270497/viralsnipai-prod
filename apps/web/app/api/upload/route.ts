export const dynamic = "force-dynamic";
export const revalidate = 0;

import path from "path";
import os from "os";
import { promises as fs } from "fs";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { probeDuration } from "@/lib/ffmpeg";
import { saveBuffer } from "@/lib/storage";
import { ApiResponseBuilder, ErrorCodes } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import {
  assertMediaUsageAllowed,
  assertV1UploadRuntimeConfig,
  getMaxUploadBytes,
  getMaxVideoDurationSeconds,
  recordMediaUsage,
  resolveUserPlanForMedia,
  V1_UPLOAD_EXTENSIONS,
  V1_UPLOAD_MIME_TYPES,
} from "@/lib/media/v1-media-policy";
import { assertSameOriginRequest } from "@/lib/security/origin";
import { consumeV1RateLimit, rateLimitResponse, V1_RATE_LIMITS } from "@/lib/security/rate-limit";

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
    routeKey: "upload",
    rules: V1_RATE_LIMITS.UPLOAD,
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit, "Too many upload attempts. Please wait and try again.");
  }

  logger.info("Upload started", { userId: user.id });

  try {
    assertV1UploadRuntimeConfig();

    const formData = await request.formData();
    const projectId = formData.get("projectId");
    const file = formData.get("file");

    if (typeof projectId !== "string" || !(file instanceof File)) {
      return ApiResponseBuilder.badRequest("Invalid upload payload. Include projectId and file.");
    }

    const extension = path.extname(file.name).toLowerCase();
    if (!V1_UPLOAD_MIME_TYPES.has(file.type) || !V1_UPLOAD_EXTENSIONS.has(extension)) {
      return ApiResponseBuilder.errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Unsupported media file. Upload MP4, MOV, WebM, MP3, WAV, or M4A.",
        415,
        { allowedMimeTypes: [...V1_UPLOAD_MIME_TYPES], allowedExtensions: [...V1_UPLOAD_EXTENSIONS] }
      );
    }

    if (file.size <= 0) {
      return ApiResponseBuilder.validationError("The uploaded file is empty.");
    }

    const maxUploadBytes = getMaxUploadBytes();
    if (file.size > maxUploadBytes) {
      return ApiResponseBuilder.errorResponse(
        ErrorCodes.FILE_UPLOAD_FAILED,
        `File exceeds ${formatUploadLimit(maxUploadBytes)} upload limit.`,
        413
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id }
    });

    if (!project) {
      return ApiResponseBuilder.notFound("Project not found");
    }

    const billingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, subscriptionTier: true },
    });
    const plan = resolveUserPlanForMedia(billingUser ?? {});
    const usageGate = await assertMediaUsageAllowed({
      userId: user.id,
      plan,
      feature: "video_upload",
    });
    if (!usageGate.allowed) {
      return ApiResponseBuilder.errorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Monthly upload limit reached for your ${plan} plan.`,
        429,
        { limit: usageGate.limit, used: usageGate.used }
      );
    }

    // Current upload path buffers the full file in memory. Keep MAX_UPLOAD_MB
    // conservative; true 4 GB support needs streaming upload to disk/S3 before
    // this route can safely accept production-scale files.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!looksLikeSupportedMedia(buffer, extension)) {
      return ApiResponseBuilder.validationError("The uploaded file is not a valid MP4, MOV, WebM, MP3, WAV, or M4A file.");
    }

    const durationSec = await probeUploadedVideoDuration(buffer, extension);
    const maxDurationSec = getMaxVideoDurationSeconds();
    if (durationSec > maxDurationSec) {
      return ApiResponseBuilder.validationError(
        `Video is too long. Maximum duration is ${Math.floor(maxDurationSec / 60)} minutes.`,
        { maxDurationSeconds: maxDurationSec, durationSeconds: durationSec }
      );
    }

    const saved = await saveBuffer(buffer, {
      prefix: `${projectId}/assets/`,
      extension,
      contentType: file.type
    });

    const asset = await prisma.asset.create({
      data: {
        projectId: project.id,
        type: file.type.startsWith("audio/") ? "audio" : "video",
        path: saved.url,
        storagePath: saved.storagePath,
        durationSec
      }
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() }
    });

    await recordMediaUsage({
      userId: user.id,
      feature: "video_upload",
      metadata: {
        projectId: project.id,
        assetId: asset.id,
        fileName: file.name,
        fileSize: file.size,
        durationSec,
      },
    });

    logger.info("Upload completed", {
      userId: user.id,
      projectId: project.id,
      assetId: asset.id,
      durationSec,
      size: file.size,
    });

    return ApiResponseBuilder.successResponse({ asset });
  } catch (error) {
    logger.error("Upload failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return ApiResponseBuilder.errorResponse(
      ErrorCodes.FILE_UPLOAD_FAILED,
      error instanceof Error ? error.message : "Upload failed. Please try again.",
      500
    );
  }
}

function looksLikeSupportedMedia(buffer: Buffer, extension: string) {
  if (buffer.length < 12) return false;

  if (extension === ".webm") {
    return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }

  if (extension === ".mp4" || extension === ".mov" || extension === ".m4a") {
    return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  }

  if (extension === ".wav") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WAVE";
  }

  if (extension === ".mp3") {
    const tag = buffer.subarray(0, 3).toString("ascii");
    const hasId3 = tag === "ID3";
    const hasFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    return hasId3 || hasFrameSync;
  }

  return false;
}

function formatUploadLimit(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${Number((mb / 1024).toFixed(1)).toLocaleString()} GB`;
  }
  return `${Math.floor(mb)} MB`;
}

async function probeUploadedVideoDuration(buffer: Buffer, extension: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "viralsnip-upload-"));
  const tempPath = path.join(tempDir, `source${extension}`);

  try {
    await fs.writeFile(tempPath, buffer);
    const duration = await probeDuration(tempPath);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Invalid video duration.");
    }
    return Math.round(duration);
  } catch {
    throw new Error("The uploaded video could not be read. Please export it again and retry.");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
  }
}
