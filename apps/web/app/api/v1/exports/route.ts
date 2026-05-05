export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { z } from "zod";

import { container } from "@/lib/infrastructure/di/container";
import { TYPES } from "@/lib/infrastructure/di/types";
import { QueueExportUseCase } from "@/lib/application/use-cases/QueueExportUseCase";
import { prisma } from "@/lib/prisma";
import { authenticatePlatformApiRequest, platformApiError, platformApiSuccess } from "@/lib/platform/api-keys";
import { serializePublicExport } from "@/lib/platform/public-api";
import { PLATFORM_EXPORT_PRESET_VALUES, resolvePlatformExportPreset } from "@/lib/repurpose/export-presets";

const exportSchema = z.object({
  projectId: z.string().min(1),
  clipIds: z.array(z.string().min(1)).min(1).max(50),
  platformPreset: z.enum(PLATFORM_EXPORT_PRESET_VALUES).optional().default("youtube_shorts"),
  aspectRatio: z.enum(["9:16", "1:1", "4:5", "16:9"]).optional(),
  includeCaptions: z.boolean().optional().default(true),
  exportQuality: z.enum(["high", "standard"]).optional().default("high"),
});

export async function POST(request: NextRequest) {
  const auth = await authenticatePlatformApiRequest(request, ["exports:write"]);
  if (!auth.ok) return auth.response;

  const parsed = exportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return platformApiError("Invalid export payload", 400, parsed.error.flatten());

  const project = await (prisma as any).project.findFirst({
    where: {
      id: parsed.data.projectId,
      userId: auth.context.userId,
      ...(auth.context.workspaceId ? { workspaceId: auth.context.workspaceId } : {}),
    },
    include: { clips: { select: { id: true, reviewStatus: true } } },
  });
  if (!project) return platformApiError("Project not found", 404);

  const allowed = new Set(
    project.clips
      .filter((clip: { id: string; reviewStatus: string }) => clip.reviewStatus !== "rejected")
      .map((clip: { id: string }) => clip.id),
  );
  const clipIds = parsed.data.clipIds.filter((id) => allowed.has(id));
  if (clipIds.length === 0) return platformApiError("No eligible clips selected", 400);

  const platform = resolvePlatformExportPreset(parsed.data.platformPreset);
  const useCase = container.get<QueueExportUseCase>(TYPES.QueueExportUseCase);
  const output = await useCase.execute({
    projectId: project.id,
    clipIds,
    preset: platform.legacyPreset,
    platformPreset: platform.id,
    aspectRatio: parsed.data.aspectRatio ?? platform.aspectRatio,
    includeCaptions: parsed.data.includeCaptions,
    exportQuality: parsed.data.exportQuality,
    allowRejected: false,
    outputFormat: "mp4",
    userId: auth.context.userId,
  });

  return platformApiSuccess({ export: serializePublicExport(output.export), queued: output.queued }, 201);
}
