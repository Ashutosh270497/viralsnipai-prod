export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createDefaultOrchestrator } from "@/lib/services/agent-orchestrator.service";

/**
 * Development endpoint to process jobs directly without Inngest
 * This is useful for local development when Inngest dev server is not running
 */
export async function POST(
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

  if (job.status !== "queued") {
    return fail(400, `Cannot process job in status: ${job.status}`);
  }

  logger.info("Starting direct job processing (dev mode)", {
    jobId: params.jobId,
    userId: user.id
  });

  // Process the job asynchronously in the background
  // Don't await this so the response returns immediately
  processJobInBackground(params.jobId).catch((error) => {
    logger.error("Background job processing failed", {
      jobId: params.jobId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  });

  return ok({
    message: "Job processing started",
    jobId: params.jobId
  });
}

async function processJobInBackground(jobId: string) {
  try {
    const orchestrator = createDefaultOrchestrator();
    await orchestrator.processJob(jobId);
    logger.info("Direct job processing completed", { jobId });
  } catch (error) {
    logger.error("Direct job processing failed", {
      jobId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw error;
  }
}
