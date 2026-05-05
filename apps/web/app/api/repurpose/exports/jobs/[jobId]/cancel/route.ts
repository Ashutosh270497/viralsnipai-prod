export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  if (exportRecord.status === "done" || exportRecord.status === "completed") {
    return ApiResponseBuilder.badRequest("Completed exports cannot be cancelled");
  }

  const cancelled = await prisma.export.update({
    where: { id: exportRecord.id },
    data: {
      status: "cancelled",
      progress: 100,
      phase: "cancelled",
      error: "Cancelled by user.",
      completedAt: new Date(),
    } as any,
  });

  return ApiResponseBuilder.success({ job: serializeExportJob(cancelled) }, "Export job cancelled");
}
