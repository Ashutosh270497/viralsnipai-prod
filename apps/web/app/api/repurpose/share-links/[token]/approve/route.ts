export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { token: string } }) {
  const link = await (prisma as any).shareLink.findUnique({
    where: { token: params.token },
    include: { clip: true },
  });

  if (!link) return ApiResponseBuilder.notFound("Share link not found");
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return ApiResponseBuilder.forbidden("Share link has expired");
  }
  if (link.permission !== "approve") {
    return ApiResponseBuilder.forbidden("This share link does not allow approval");
  }
  if (!link.clipId) {
    return ApiResponseBuilder.badRequest("Project-level share links cannot approve a specific clip");
  }

  const clip = await prisma.clip.update({
    where: { id: link.clipId },
    data: { reviewStatus: "approved", version: { increment: 1 } },
  });

  return ApiResponseBuilder.success(
    {
      clipId: clip.id,
      reviewStatus: clip.reviewStatus,
    },
    "Clip approved",
  );
}
