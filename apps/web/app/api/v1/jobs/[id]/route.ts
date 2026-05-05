export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { authenticatePlatformApiRequest, platformApiError, platformApiSuccess } from "@/lib/platform/api-keys";
import { serializePublicExport } from "@/lib/platform/public-api";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticatePlatformApiRequest(request, ["exports:read"]);
  if (!auth.ok) return auth.response;

  const exportJob = await (prisma as any).export.findFirst({
    where: {
      id: params.id,
      project: {
        userId: auth.context.userId,
        ...(auth.context.workspaceId ? { workspaceId: auth.context.workspaceId } : {}),
      },
    },
  });
  if (exportJob) {
    return platformApiSuccess({ jobType: "export", job: serializePublicExport(exportJob) });
  }

  const ingestJob = await (prisma as any).youTubeIngestJob.findFirst({
    where: {
      id: params.id,
      project: {
        userId: auth.context.userId,
        ...(auth.context.workspaceId ? { workspaceId: auth.context.workspaceId } : {}),
      },
    },
  });
  if (ingestJob) {
    return platformApiSuccess({
      jobType: "youtube_ingest",
      job: {
        id: ingestJob.id,
        projectId: ingestJob.projectId,
        status: ingestJob.status,
        sourceUrl: ingestJob.sourceUrl,
        error: ingestJob.error ?? null,
        createdAt: ingestJob.createdAt?.toISOString?.() ?? ingestJob.createdAt,
        updatedAt: ingestJob.updatedAt?.toISOString?.() ?? ingestJob.updatedAt,
      },
    });
  }

  return platformApiError("Job not found", 404);
}
