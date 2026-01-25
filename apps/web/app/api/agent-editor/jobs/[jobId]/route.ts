export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { logger } from "@/lib/logger";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const job = await prisma.agentEditorJob.findFirst({
    where: {
      id: params.jobId,
      userId: user.id
    },
    include: {
      project: {
        select: {
          id: true,
          title: true
        }
      },
      assets: {
        orderBy: {
          createdAt: "asc"
        }
      },
      logs: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!job) {
    return fail(404, "Job not found");
  }

  return ok({ job });
}

export async function DELETE(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const job = await prisma.agentEditorJob.findFirst({
    where: {
      id: params.jobId,
      userId: user.id
    }
  });

  if (!job) {
    return fail(404, "Job not found");
  }

  // Only allow canceling jobs that are queued or processing
  if (job.status !== "queued" && job.status !== "processing") {
    return fail(400, "Cannot cancel job in current status");
  }

  // Update job status to failed with cancellation message
  await prisma.agentEditorJob.update({
    where: {
      id: params.jobId
    },
    data: {
      status: "failed",
      errorMessage: "Job cancelled by user",
      completedAt: new Date()
    }
  });

  logger.info("Cancelled agent editor job", {
    jobId: params.jobId,
    userId: user.id
  });

  // TODO: Signal the orchestrator to stop processing this job

  return ok({ message: "Job cancelled successfully" });
}

export async function PATCH(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const job = await prisma.agentEditorJob.findFirst({
    where: {
      id: params.jobId,
      userId: user.id
    }
  });

  if (!job) {
    return fail(404, "Job not found");
  }

  // This endpoint is for internal use by the orchestrator to update job progress
  // In production, this should be protected by an internal API key
  const body = await request.json();

  const updateData: any = {};

  if (body.status) {
    updateData.status = body.status;
  }

  if (body.currentAgent) {
    updateData.currentAgent = body.currentAgent;
  }

  if (body.progress) {
    updateData.progress = body.progress;
  }

  if (body.resultPath) {
    updateData.resultPath = body.resultPath;
  }

  if (body.errorMessage) {
    updateData.errorMessage = body.errorMessage;
  }

  if (body.status === "completed" || body.status === "failed") {
    updateData.completedAt = new Date();
  }

  const updatedJob = await prisma.agentEditorJob.update({
    where: {
      id: params.jobId
    },
    data: updateData
  });

  return ok({ job: updatedJob });
}
