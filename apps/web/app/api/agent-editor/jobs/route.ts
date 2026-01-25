export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok, parseJson } from "@/lib/api";
import { logger } from "@/lib/logger";
import { inngest } from "@/lib/inngest/client";

const createJobSchema = z.object({
  clipId: z.string().optional(),
  projectId: z.string(),
  config: z
    .object({
      agents: z.array(z.string()).optional(),
      styleProfileId: z.string().optional(),
      targetDuration: z.number().optional(),
      audience: z.string().optional(),
      tone: z.string().optional(),
      callToAction: z.string().optional()
    })
    .optional()
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const parsed = await parseJson(request, createJobSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { data } = parsed;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: {
      id: data.projectId,
      userId: user.id
    }
  });

  if (!project) {
    return fail(404, "Project not found");
  }

  // If clipId is provided, verify clip ownership
  if (data.clipId) {
    const clip = await prisma.clip.findFirst({
      where: {
        id: data.clipId,
        projectId: data.projectId
      }
    });

    if (!clip) {
      return fail(404, "Clip not found");
    }
  }

  // Create the agent editor job
  const job = await prisma.agentEditorJob.create({
    data: {
      clipId: data.clipId,
      projectId: data.projectId,
      userId: user.id,
      status: "queued",
      config: data.config ?? {},
      progress: {}
    }
  });

  logger.info("Created agent editor job", {
    jobId: job.id,
    projectId: data.projectId,
    clipId: data.clipId,
    userId: user.id
  });

  // Trigger Inngest function to process the job in the background
  await inngest.send({
    name: "agent-editor/job.created",
    data: {
      jobId: job.id
    }
  });

  logger.info("Triggered Inngest job processing", { jobId: job.id });

  return ok({ job });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  const where: any = {
    userId: user.id
  };

  if (projectId) {
    where.projectId = projectId;
  }

  if (status) {
    where.status = status;
  }

  const jobs = await prisma.agentEditorJob.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          title: true
        }
      },
      assets: true,
      logs: {
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  return ok({ jobs });
}
