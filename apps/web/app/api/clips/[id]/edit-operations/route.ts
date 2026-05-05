export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/utils/error-handler";
import { clipEditOperationSchema } from "./schema";

async function authorizeClipAccess(clipId: string, userId: string): Promise<Response | null> {
  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
    select: {
      id: true,
      project: {
        select: { userId: true },
      },
    },
  });

  if (!clip) {
    return ApiResponseBuilder.notFound("Clip not found");
  }
  if (clip.project.userId !== userId) {
    return ApiResponseBuilder.forbidden("Access denied");
  }
  return null;
}

export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized("Authentication required");
    }

    const authorizationError = await authorizeClipAccess(params.id, user.id);
    if (authorizationError) {
      return authorizationError;
    }

    const operations = await prisma.clipEditOperation.findMany({
      where: { clipId: params.id },
      orderBy: { createdAt: "asc" },
    });

    return ApiResponseBuilder.success({ operations });
  },
);

export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponseBuilder.unauthorized("Authentication required");
    }

    const json = await request.json();
    const parsed = clipEditOperationSchema.safeParse(json);
    if (!parsed.success) {
      return ApiResponseBuilder.badRequest("Invalid request body", {
        errors: parsed.error.flatten(),
      });
    }

    const authorizationError = await authorizeClipAccess(params.id, user.id);
    if (authorizationError) {
      return authorizationError;
    }

    const operation = await prisma.clipEditOperation.create({
      data: {
        clipId: params.id,
        type: parsed.data.type,
        startMs: parsed.data.startMs ?? null,
        endMs: parsed.data.endMs ?? null,
        payload: parsed.data.payload ?? undefined,
      },
    });

    return ApiResponseBuilder.success({ operation }, "Edit operation saved");
  },
);
