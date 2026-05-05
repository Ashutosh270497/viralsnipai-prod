export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentDbUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentDbUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const apiKey = await (prisma as any).apiKey.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, status: true },
  });
  if (!apiKey) return ApiResponseBuilder.notFound("API key not found");

  await (prisma as any).apiKey.update({
    where: { id: params.id },
    data: { status: "revoked", revokedAt: new Date() },
  });

  return ApiResponseBuilder.success({ id: params.id, status: "revoked" }, "API key revoked");
}
