export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { queueExportJob } from "@/lib/render-queue";
import { ApiResponseBuilder } from "@/lib/api/response";
import { serializeExportJob } from "@/lib/repurpose/export-jobs";

export async function POST(_request: Request, { params }: { params: { jobId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return ApiResponseBuilder.unauthorized("Authentication required");
  }

  const exportRecord = await prisma.export.findFirst({
    where: { id: params.jobId, project: { userId: user.id } },
  });
  if (!exportRecord) {
    return ApiResponseBuilder.notFound("Export job not found");
  }

  if (exportRecord.status !== "failed" && exportRecord.status !== "cancelled") {
    return ApiResponseBuilder.badRequest("Only failed or cancelled export jobs can be retried");
  }

  const retried = await prisma.export.update({
    where: { id: exportRecord.id },
    data: {
      status: "queued",
      progress: 0,
      phase: "queued",
      error: null,
      startedAt: null,
      completedAt: null,
    } as any,
  });

  const queued = await queueExportJob(retried.id);
  return ApiResponseBuilder.success({ job: serializeExportJob(retried), queued }, "Export job requeued");
}
