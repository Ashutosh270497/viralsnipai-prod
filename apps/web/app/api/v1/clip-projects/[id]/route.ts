export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { authenticatePlatformApiRequest, platformApiError, platformApiSuccess } from "@/lib/platform/api-keys";
import { serializePublicProject } from "@/lib/platform/public-api";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticatePlatformApiRequest(request, ["projects:read"]);
  if (!auth.ok) return auth.response;

  const project = await (prisma as any).project.findFirst({
    where: {
      id: params.id,
      userId: auth.context.userId,
      ...(auth.context.workspaceId ? { workspaceId: auth.context.workspaceId } : {}),
    },
    include: {
      assets: { orderBy: { createdAt: "desc" } },
      clips: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      exports: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return platformApiError("Project not found", 404);

  return platformApiSuccess({ project: serializePublicProject(project) });
}
