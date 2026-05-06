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
  qualityMode: z.enum(["fast", "balanced", "best"]).optional().default("balanced"),
  clipIntent: z
    .enum(["auto", "viral_hooks", "educational", "contrarian", "story", "product_demo", "funny", "quotes"])
    .optional()
    .default("auto"),
  mode: z.enum(["replace", "merge", "append"]).optional().default("merge"),
  /**
   * Legacy raw model field. Public API users should route through qualityMode
   * and clipIntent; raw model IDs are not accepted in this API surface.
   */
  model: z.string().trim().min(1).optional(),
  debugModelOverride: z.string().trim().min(1).optional(),
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
  if (parsed.data.model || parsed.data.debugModelOverride) {
    return platformApiError(
      "Raw model overrides are not available through the public API. Use qualityMode and clipIntent.",
      400,
    );
  }

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
      qualityMode: parsed.data.qualityMode,
      clipIntent: parsed.data.clipIntent,
      mode: parsed.data.mode,
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
