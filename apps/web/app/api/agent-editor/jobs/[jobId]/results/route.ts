export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";

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

  if (job.status !== "completed") {
    return fail(400, "Job is not completed yet");
  }

  // Group assets by type for easier frontend consumption
  const assetsByType = job.assets.reduce(
    (acc, asset) => {
      if (!acc[asset.type]) {
        acc[asset.type] = [];
      }
      acc[asset.type].push(asset);
      return acc;
    },
    {} as Record<string, typeof job.assets>
  );

  return ok({
    job: {
      id: job.id,
      status: job.status,
      resultPath: job.resultPath,
      completedAt: job.completedAt
    },
    assets: assetsByType,
    logs: job.logs
  });
}
