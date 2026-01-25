export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";

/**
 * Debug endpoint to see job details including logs and errors
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    // Get latest job
    const latestJob = await prisma.agentEditorJob.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          include: {
            assets: {
              select: {
                id: true,
                storagePath: true,
                transcript: true,
                type: true
              }
            },
            clips: {
              select: {
                id: true,
                title: true,
                startMs: true,
                endMs: true
              }
            }
          }
        },
        logs: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!latestJob) {
      return ok({
        message: "No jobs found",
        jobs: []
      });
    }

    return ok({
      job: latestJob,
      debug: {
        hasTranscript: latestJob.project.assets.some(a => !!a.transcript),
        hasAssets: latestJob.project.assets.length > 0,
        hasClips: latestJob.project.clips.length > 0,
        logsCount: latestJob.logs.length,
        status: latestJob.status,
        errorMessage: latestJob.errorMessage,
        progress: latestJob.progress
      }
    });
  }

  // Get specific job
  const job = await prisma.agentEditorJob.findFirst({
    where: {
      id: jobId,
      userId: user.id
    },
    include: {
      project: {
        include: {
          assets: {
            select: {
              id: true,
              storagePath: true,
              transcript: true,
              type: true
            }
          },
          clips: {
            select: {
              id: true,
              title: true,
              startMs: true,
              endMs: true
            }
          }
        }
      },
      logs: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!job) {
    return fail(404, "Job not found");
  }

  return ok({
    job,
    debug: {
      hasTranscript: job.project.assets.some(a => !!a.transcript),
      hasAssets: job.project.assets.length > 0,
      hasClips: job.project.clips.length > 0,
      logsCount: job.logs.length,
      status: job.status,
      errorMessage: job.errorMessage,
      progress: job.progress
    }
  });
}
