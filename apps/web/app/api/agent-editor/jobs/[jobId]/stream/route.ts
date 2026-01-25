export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify job ownership
  const job = await prisma.agentEditorJob.findFirst({
    where: {
      id: params.jobId,
      userId: user.id
    }
  });

  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial job status
      const sendUpdate = async () => {
        try {
          const currentJob = await prisma.agentEditorJob.findUnique({
            where: { id: params.jobId },
            include: {
              assets: true,
              logs: {
                orderBy: { createdAt: "desc" },
                take: 10
              }
            }
          });

          if (!currentJob) {
            controller.close();
            return false;
          }

          const data = JSON.stringify({
            id: currentJob.id,
            status: currentJob.status,
            currentAgent: currentJob.currentAgent,
            progress: currentJob.progress,
            resultPath: currentJob.resultPath,
            errorMessage: currentJob.errorMessage,
            completedAt: currentJob.completedAt,
            updatedAt: currentJob.updatedAt
          });

          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Close stream if job is completed or failed
          if (
            currentJob.status === "completed" ||
            currentJob.status === "failed"
          ) {
            return false; // Stop polling
          }

          return true; // Continue polling
        } catch (error) {
          console.error("SSE update error:", error);
          controller.close();
          return false;
        }
      };

      // Send initial update
      const shouldContinue = await sendUpdate();

      if (!shouldContinue) {
        controller.close();
        return;
      }

      // Poll for updates every 2 seconds
      const interval = setInterval(async () => {
        const shouldContinue = await sendUpdate();
        if (!shouldContinue) {
          clearInterval(interval);
          controller.close();
        }
      }, 2000);

      // Clean up on connection close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
