export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/utils/error-handler";

export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized("Authentication required");
    }

    const clip = await prisma.clip.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        startMs: true,
        endMs: true,
        project: { select: { userId: true } },
      },
    });

    if (!clip) {
      return ApiResponseBuilder.notFound("Clip not found");
    }
    if (clip.project.userId !== user.id) {
      return ApiResponseBuilder.forbidden("Access denied");
    }

    const trimOperations = await prisma.clipEditOperation.findMany({
      where: {
        clipId: params.id,
        type: { in: ["trim_start", "trim_end"] },
      },
      orderBy: { createdAt: "asc" },
    });

    const originalBoundary = trimOperations
      .map((operation) => readOriginalBoundary(operation.payload))
      .find((boundary) => boundary !== null);

    const [, updatedClip] = await prisma.$transaction([
      prisma.clipEditOperation.deleteMany({ where: { clipId: params.id } }),
      originalBoundary
        ? prisma.clip.update({
            where: { id: params.id },
            data: {
              startMs: originalBoundary.startMs,
              endMs: originalBoundary.endMs,
              previewPath: null,
              version: { increment: 1 },
            },
          })
        : prisma.clip.update({
            where: { id: params.id },
            data: { version: { increment: 1 } },
          }),
    ]);

    return ApiResponseBuilder.success(
      { reset: true, clip: updatedClip, restoredBoundary: originalBoundary },
      "Edit operations reset",
    );
  },
);

function readOriginalBoundary(payload: unknown): { startMs: number; endMs: number } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const originalStartMs = Number(record.originalStartMs);
  const originalEndMs = Number(record.originalEndMs);
  if (
    Number.isInteger(originalStartMs) &&
    Number.isInteger(originalEndMs) &&
    originalEndMs > originalStartMs
  ) {
    return { startMs: originalStartMs, endMs: originalEndMs };
  }
  return null;
}
