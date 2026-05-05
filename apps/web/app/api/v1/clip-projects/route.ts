export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { authenticatePlatformApiRequest, platformApiSuccess, platformApiError } from "@/lib/platform/api-keys";
import { serializePublicProject } from "@/lib/platform/public-api";

const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  topic: z.string().trim().max(240).nullable().optional(),
  sourceUrl: z.string().trim().max(2048).nullable().optional(),
  targetPlatform: z.string().trim().max(80).nullable().optional(),
  contentGoal: z.string().trim().max(80).nullable().optional(),
  workspaceId: z.string().min(1).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await authenticatePlatformApiRequest(request, ["projects:read"]);
  if (!auth.ok) return auth.response;

  const projects = await (prisma as any).project.findMany({
    where: {
      userId: auth.context.userId,
      ...(auth.context.workspaceId ? { workspaceId: auth.context.workspaceId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return platformApiSuccess({ projects: projects.map(serializePublicProject) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePlatformApiRequest(request, ["projects:write"]);
  if (!auth.ok) return auth.response;

  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return platformApiError("Invalid project payload", 400, parsed.error.flatten());

  const workspaceId = parsed.data.workspaceId ?? auth.context.workspaceId ?? null;
  if (auth.context.workspaceId && workspaceId !== auth.context.workspaceId) {
    return platformApiError("API key is scoped to a different workspace.", 403);
  }

  const project = await (prisma as any).project.create({
    data: {
      userId: auth.context.userId,
      workspaceId,
      title: parsed.data.title,
      topic: parsed.data.topic ?? null,
      sourceUrl: parsed.data.sourceUrl ?? null,
      targetPlatform: parsed.data.targetPlatform ?? null,
      contentGoal: parsed.data.contentGoal ?? null,
      status: "ready",
    },
  });

  return platformApiSuccess({ project: serializePublicProject(project) }, 201);
}
