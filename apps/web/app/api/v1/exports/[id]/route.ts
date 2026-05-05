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
  if (!exportJob) return platformApiError("Export not found", 404);

  return platformApiSuccess({ export: serializePublicExport(exportJob) });
}
