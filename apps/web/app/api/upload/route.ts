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
  getMaxUploadBytes,
  getMaxVideoDurationSeconds,
  recordMediaUsage,
  resolveUserPlanForMedia,
  V1_UPLOAD_EXTENSIONS,
  V1_UPLOAD_MIME_TYPES,
} from "@/lib/media/v1-media-policy";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized("Authentication required");
  }

  logger.info("Upload started", { userId: user.id });

  try {
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
        "Unsupported video file. Upload an MP4, MOV, or WEBM file.",
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
        `File too large. Maximum upload size is ${Math.floor(maxUploadBytes / (1024 * 1024))} MB.`,
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!looksLikeSupportedVideo(buffer, extension)) {
      return ApiResponseBuilder.validationError("The uploaded file is not a valid MP4, MOV, or WEBM video.");
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
        type: "video",
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

function looksLikeSupportedVideo(buffer: Buffer, extension: string) {
  if (buffer.length < 12) return false;

  if (extension === ".webm") {
    return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }

  if (extension === ".mp4" || extension === ".mov") {
    return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  }

  return false;
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
