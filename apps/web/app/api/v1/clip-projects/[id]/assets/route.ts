export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { authenticatePlatformApiRequest, platformApiError, platformApiSuccess } from "@/lib/platform/api-keys";
import { serializePublicAsset } from "@/lib/platform/public-api";

const assetSchema = z.object({
  type: z.enum(["video", "audio"]).default("video"),
  path: z.string().trim().min(1).max(2048),
  storagePath: z.string().trim().min(1).max(2048).optional(),
  durationSec: z.number().int().positive().nullable().optional(),
  sourceWidth: z.number().int().positive().nullable().optional(),
  sourceHeight: z.number().int().positive().nullable().optional(),
  transcript: z.string().nullable().optional(),
  sourceLanguage: z.string().trim().min(2).max(12).optional().default("en"),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticatePlatformApiRequest(request, ["assets:write"]);
  if (!auth.ok) return auth.response;

  const project = await (prisma as any).project.findFirst({
    where: {
      id: params.id,
      userId: auth.context.userId,
      ...(auth.context.workspaceId ? { workspaceId: auth.context.workspaceId } : {}),
    },
    select: { id: true },
  });
  if (!project) return platformApiError("Project not found", 404);

  const parsed = assetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return platformApiError("Invalid asset payload", 400, parsed.error.flatten());

  const asset = await (prisma as any).asset.create({
    data: {
      projectId: params.id,
      type: parsed.data.type,
      path: parsed.data.path,
      storagePath: parsed.data.storagePath ?? parsed.data.path,
      durationSec: parsed.data.durationSec ?? null,
      sourceWidth: parsed.data.sourceWidth ?? null,
      sourceHeight: parsed.data.sourceHeight ?? null,
      transcript: parsed.data.transcript ?? null,
      sourceLanguage: parsed.data.sourceLanguage,
    },
  });

  return platformApiSuccess({ asset: serializePublicAsset(asset) }, 201);
}
