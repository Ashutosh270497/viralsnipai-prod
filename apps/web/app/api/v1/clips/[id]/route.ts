export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { authenticatePlatformApiRequest, platformApiError, platformApiSuccess } from "@/lib/platform/api-keys";
import { serializePublicClip } from "@/lib/platform/public-api";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticatePlatformApiRequest(request, ["clips:read"]);
  if (!auth.ok) return auth.response;

  const clip = await (prisma as any).clip.findFirst({
    where: {
      id: params.id,
      project: {
        userId: auth.context.userId,
        ...(auth.context.workspaceId ? { workspaceId: auth.context.workspaceId } : {}),
      },
    },
  });
  if (!clip) return platformApiError("Clip not found", 404);

  return platformApiSuccess({ clip: serializePublicClip(clip) });
}
