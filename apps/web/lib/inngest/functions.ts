import { inngest } from "./client";
import { createDefaultOrchestrator } from "@/lib/services/agent-orchestrator.service";
import { logger } from "@/lib/logger";

/**
 * Inngest function to process agent editor jobs
 * This runs in the background, outside of HTTP request lifecycle
 */
export const processAgentJob = inngest.createFunction(
  {
    id: "process-agent-job",
    name: "Process Agent Editor Job",
    retries: 2,
    rateLimit: {
      // Limit to 5 concurrent jobs to manage API costs and resources
      limit: 5,
      period: "1m"
    }
  },
  { event: "agent-editor/job.created" },
  async ({ event, step }) => {
    const { jobId } = event.data;

    logger.info("Starting agent job processing (Inngest)", { jobId });

    try {
      // Create orchestrator and process job
      const orchestrator = createDefaultOrchestrator();

      await step.run("process-job", async () => {
        await orchestrator.processJob(jobId);
      });

      logger.info("Agent job completed successfully (Inngest)", { jobId });

      return {
        success: true,
        jobId
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Agent job failed (Inngest)", {
        jobId,
        error: errorMessage
      });

      throw error; // Let Inngest handle retries
    }
  }
);

// Export all functions
export const functions = [processAgentJob];
