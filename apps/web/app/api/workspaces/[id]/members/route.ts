export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentDbUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { addWorkspaceMemberSchema, assertWorkspaceAccess } from "@/lib/platform/workspaces";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentDbUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const role = await assertWorkspaceAccess(user.id, params.id, "client");
  if (!role) return ApiResponseBuilder.forbidden("Workspace access required");

  const members = await (prisma as any).workspaceMember.findMany({
    where: { workspaceId: params.id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return ApiResponseBuilder.success({ members });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentDbUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const role = await assertWorkspaceAccess(user.id, params.id, "admin");
  if (!role) return ApiResponseBuilder.forbidden("Workspace admin access required");

  const parsed = addWorkspaceMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid workspace member payload", { errors: parsed.error.flatten() });
  }

  const member = await (prisma as any).workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: params.id, userId: parsed.data.userId } },
    update: { role: parsed.data.role },
    create: { workspaceId: params.id, userId: parsed.data.userId, role: parsed.data.role },
  });

  return ApiResponseBuilder.success({ member }, "Workspace member saved");
}
