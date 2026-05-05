export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/utils/error-handler";

export const DELETE = withErrorHandling(
  async (
    _request: Request,
    { params }: { params: { id: string; operationId: string } },
  ) => {
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized("Authentication required");
    }

    const operation = await prisma.clipEditOperation.findUnique({
      where: { id: params.operationId },
      select: {
        id: true,
        clipId: true,
        clip: {
          select: {
            project: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!operation || operation.clipId !== params.id) {
      return ApiResponseBuilder.notFound("Edit operation not found");
    }
    if (operation.clip.project.userId !== user.id) {
      return ApiResponseBuilder.forbidden("Access denied");
    }

    await prisma.clipEditOperation.delete({ where: { id: params.operationId } });

    return ApiResponseBuilder.success({ deleted: true }, "Edit operation deleted");
  },
);
