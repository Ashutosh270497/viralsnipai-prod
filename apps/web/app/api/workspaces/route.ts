export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentDbUser } from "@/lib/auth";
import { ApiResponseBuilder } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { createWorkspaceSchema, serializeWorkspace } from "@/lib/platform/workspaces";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const workspaces = await (prisma as any).workspace.findMany({
    where: {
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    include: { members: { select: { userId: true, role: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return ApiResponseBuilder.success({
    workspaces: workspaces.map((workspace: any) => ({
      ...serializeWorkspace(workspace),
      role: workspace.ownerId === user.id ? "owner" : workspace.members.find((m: any) => m.userId === user.id)?.role,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentDbUser();
  if (!user) return ApiResponseBuilder.unauthorized("Authentication required");

  const parsed = createWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return ApiResponseBuilder.badRequest("Invalid workspace payload", { errors: parsed.error.flatten() });
  }

  const workspace = await (prisma as any).$transaction(async (tx: any) => {
    const created = await tx.workspace.create({
      data: { name: parsed.data.name, ownerId: user.id, plan: user.subscriptionTier ?? user.plan ?? "free" },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: created.id, userId: user.id, role: "owner" },
    });
    return created;
  });

  return ApiResponseBuilder.success({ workspace: serializeWorkspace(workspace) }, "Workspace created");
}
