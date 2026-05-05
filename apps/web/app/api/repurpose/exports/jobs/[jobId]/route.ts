export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExportRuntimeState, isExportJobActive, queueExportJob } from "@/lib/render-queue";
import { ApiResponseBuilder } from "@/lib/api/response";
import { serializeExportJob } from "@/lib/repurpose/export-jobs";

const STALLED_QUEUED_RECOVERY_MS = 12_000;

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized("Authentication required");
  }

  let exportRecord = await prisma.export.findFirst({
    where: { id: params.jobId, project: { userId: user.id } },
  });

  if (!exportRecord) {
    return ApiResponseBuilder.notFound("Export job not found");
  }

  if (exportRecord.status === "queued" && !isExportJobActive(exportRecord.id)) {
    const ageMs = Date.now() - new Date(exportRecord.updatedAt).getTime();
    if (ageMs >= STALLED_QUEUED_RECOVERY_MS) {
      await queueExportJob(exportRecord.id);
      const refreshed = await prisma.export.findUnique({ where: { id: exportRecord.id } });
      if (refreshed) exportRecord = refreshed;
    }
  }

  const runtime = getExportRuntimeState(exportRecord.id);
  return ApiResponseBuilder.success({ job: serializeExportJob(exportRecord, runtime), runtime });
}
