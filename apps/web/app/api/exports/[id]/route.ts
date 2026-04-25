export const dynamic = "force-dynamic";
export const revalidate = 0;

import { promises as fs } from "fs";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExportRuntimeState, isExportJobActive, queueExportJob } from "@/lib/render-queue";
import { ApiResponseBuilder } from "@/lib/api/response";
import { publicExportMessage, toPublicExportStatus } from "@/lib/media/v1-media-policy";

const STALLED_QUEUED_RECOVERY_MS = 12_000;
const STALLED_PROCESSING_RECOVERY_MS = 45_000;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized("Authentication required");
  }

  let exportRecord = await prisma.export.findFirst({
    where: {
      id: params.id,
      project: {
        userId: user.id
      }
    }
  });

  if (!exportRecord) {
    return ApiResponseBuilder.notFound("Export not found");
  }

  if ((exportRecord.status === "queued" || exportRecord.status === "processing") && !isExportJobActive(exportRecord.id)) {
    const queuedAt = new Date(exportRecord.updatedAt).getTime();
    const ageMs = Date.now() - queuedAt;
    const stalledThreshold =
      exportRecord.status === "processing"
        ? STALLED_PROCESSING_RECOVERY_MS
        : STALLED_QUEUED_RECOVERY_MS;

    if (ageMs >= stalledThreshold) {
      const outputExists = exportRecord.storagePath
        ? await fs.access(exportRecord.storagePath).then(() => true).catch(() => false)
        : false;

      if (outputExists) {
        await prisma.export.update({
          where: { id: exportRecord.id },
          data: { status: "done", error: null },
        });
      } else {
        await prisma.export.update({
          where: { id: exportRecord.id },
          data: {
            status: "queued",
            error:
              exportRecord.status === "processing"
                ? "Recovered stalled render job and re-queued automatically."
                : exportRecord.error,
          },
        });
        await queueExportJob(exportRecord.id);
      }

      const refreshed = await prisma.export.findUnique({ where: { id: exportRecord.id } });
      if (refreshed) {
        exportRecord = refreshed;
      }
    }
  }

  const runtime = getExportRuntimeState(exportRecord.id);
  const publicStatus = toPublicExportStatus(exportRecord.status, runtime);

  return ApiResponseBuilder.successResponse({
    export: {
      ...exportRecord,
      status: publicStatus,
      internalStatus: exportRecord.status,
      downloadUrl: publicStatus === "completed" ? exportRecord.outputPath : null,
    },
    runtime,
    status: {
      value: publicStatus,
      message: publicExportMessage(publicStatus),
      progressPct:
        publicStatus === "completed"
          ? 100
          : publicStatus === "failed"
            ? 100
            : runtime?.progressPct ?? (publicStatus === "queued" ? 2 : 0),
      retryable: publicStatus === "retryable" || Boolean(runtime?.retryable),
    },
  });
}
