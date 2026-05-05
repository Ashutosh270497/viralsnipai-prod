import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const WORKSPACE_ROLES = ["owner", "admin", "editor", "reviewer", "client"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export const addWorkspaceMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(WORKSPACE_ROLES),
});

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  reviewer: 2,
  client: 1,
};

export function canRoleManageWorkspace(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

export function roleAtLeast(role: string | null | undefined, minimum: WorkspaceRole) {
  const current = ROLE_RANK[(role ?? "client") as WorkspaceRole] ?? 0;
  return current >= ROLE_RANK[minimum];
}

export async function getWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  const workspace = await (prisma as any).workspace.findFirst({
    where: { id: workspaceId, ownerId: userId },
    select: { id: true },
  });
  if (workspace) return "owner";

  const member = await (prisma as any).workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

export async function assertWorkspaceAccess(userId: string, workspaceId: string, minimum: WorkspaceRole) {
  const role = await getWorkspaceRole(userId, workspaceId);
  return roleAtLeast(role, minimum) ? role : null;
}

export function serializeWorkspace(row: any) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    plan: row.plan,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}
