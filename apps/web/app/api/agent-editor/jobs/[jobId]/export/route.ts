export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import path from "path";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, ok, parseJson } from "@/lib/api";
import { logger } from "@/lib/logger";
import { exportForPlatform, PlatformExportOptions } from "@/lib/video-optimization";

const exportSchema = z.object({
  platform: z.enum(["youtube", "tiktok", "instagram", "twitter", "linkedin"]),
  quality: z.enum(["high", "medium", "low"]).default("high")
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

  const parsed = await parseJson(request, exportSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const { platform, quality } = parsed.data;

  try {
    // Convert result path to file system path
    const inputPath = path.join(process.cwd(), "public", job.resultPath);

    // Generate output directory
    const outputDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "exports",
      job.projectId
    );

    logger.info("Starting platform export", {
      jobId: params.jobId,
      platform,
      quality,
      inputPath
    });

    // Export video for platform
    const outputPath = await exportForPlatform(inputPath, outputDir, {
      platform,
      quality
    } as PlatformExportOptions);

    // Convert file path to public URL
    const publicPath = outputPath.replace(
      path.join(process.cwd(), "public"),
      ""
    );

    logger.info("Platform export completed", {
      jobId: params.jobId,
      platform,
      publicPath
    });

    return ok({
      exportPath: publicPath,
      platform,
      quality
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error("Platform export failed", {
      jobId: params.jobId,
      platform,
      error: errorMessage
    });

    return fail(500, `Export failed: ${errorMessage}`);
  }
}
