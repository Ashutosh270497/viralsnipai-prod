export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import path from "path";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok, parseJson } from "@/lib/api";
import { logger } from "@/lib/logger";
import { generateThumbnails } from "@/lib/video-optimization";

const thumbnailSchema = z.object({
  count: z.number().min(1).max(10).default(3),
  timestamps: z.array(z.number()).optional()
});

export async function POST(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }

  // Verify job ownership
  const job = await prisma.agentEditorJob.findFirst({
    where: {
      id: params.jobId,
      userId: user.id
    }
  });

  if (!job) {
    return fail(404, "Job not found");
  }

  if (job.status !== "completed" || !job.resultPath) {
    return fail(400, "Job must be completed with a result video");
  }

  const parsed = await parseJson(request, thumbnailSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { count, timestamps } = parsed.data;

  try {
    // Convert result path to file system path
    const inputPath = path.join(process.cwd(), "public", job.resultPath);

    // Generate output directory
    const outputDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "thumbnails",
      job.projectId
    );

    logger.info("Starting thumbnail generation", {
      jobId: params.jobId,
      count,
      hasTimestamps: !!timestamps,
      inputPath
    });

    // Generate thumbnails
    const thumbnailPaths = await generateThumbnails({
      inputPath,
      outputDir,
      count,
      timestamps
    });

    // Convert file paths to public URLs
    const publicPaths = thumbnailPaths.map((p) =>
      p.replace(path.join(process.cwd(), "public"), "")
    );

    logger.info("Thumbnail generation completed", {
      jobId: params.jobId,
      count: publicPaths.length
    });

    return ok({
      thumbnails: publicPaths
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error("Thumbnail generation failed", {
      jobId: params.jobId,
      error: errorMessage
    });

    return fail(500, `Thumbnail generation failed: ${errorMessage}`);
  }
}
