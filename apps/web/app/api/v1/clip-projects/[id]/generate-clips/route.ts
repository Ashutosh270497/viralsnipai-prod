export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { z } from "zod";

import { container } from "@/lib/infrastructure/di/container";
import { TYPES } from "@/lib/infrastructure/di/types";
import { GenerateAutoHighlightsUseCase } from "@/lib/application/use-cases/GenerateAutoHighlightsUseCase";
import { prisma } from "@/lib/prisma";
import { authenticatePlatformApiRequest, platformApiError, platformApiSuccess } from "@/lib/platform/api-keys";

const generateSchema = z.object({
  assetId: z.string().min(1),
  target: z.number().int().min(1).max(8).optional(),
  clipLengthPreset: z.enum(["short", "balanced", "detailed"]).optional().default("balanced"),
  mode: z.enum(["replace", "merge", "append"]).optional().default("merge"),
  model: z.string().trim().min(1).optional(),
  audience: z.string().trim().max(160).optional(),
  tone: z.string().trim().max(160).optional(),
  brief: z.string().trim().max(600).optional(),
  callToAction: z.string().trim().max(200).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticatePlatformApiRequest(request, ["clips:write"]);
  if (!auth.ok) return auth.response;

  const parsed = generateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return platformApiError("Invalid generate-clips payload", 400, parsed.error.flatten());

  const asset = await (prisma as any).asset.findFirst({
    where: {
      id: parsed.data.assetId,
      projectId: params.id,
      project: {
        userId: auth.context.userId,
        ...(auth.context.workspaceId ? { workspaceId: auth.context.workspaceId } : {}),
      },
    },
    select: { id: true },
  });
  if (!asset) return platformApiError("Asset not found", 404);

  const useCase = container.get<GenerateAutoHighlightsUseCase>(TYPES.GenerateAutoHighlightsUseCase);
  const result = await useCase.execute({
    assetId: parsed.data.assetId,
    userId: auth.context.userId,
    options: {
      targetClipCount: parsed.data.target,
      clipLengthPreset: parsed.data.clipLengthPreset,
      mode: parsed.data.mode,
      model: parsed.data.model,
      audience: parsed.data.audience,
      tone: parsed.data.tone,
      brief: parsed.data.brief,
      callToAction: parsed.data.callToAction,
    },
  });

  return platformApiSuccess({
    assetId: result.assetId,
    clips: result.clips,
    analytics: result.analytics,
  });
}
