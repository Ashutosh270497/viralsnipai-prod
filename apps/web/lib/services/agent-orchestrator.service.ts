import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { BaseAgent, AgentContext, AgentResult } from "./agents/base-agent";

export interface OrchestratorConfig {
  agents: BaseAgent[];
  maxRetries?: number;
  retryDelay?: number;
}

export class AgentOrchestrator {
  private agents: BaseAgent[];
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: OrchestratorConfig) {
    this.agents = config.agents;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelay = config.retryDelay ?? 5000;
  }

  /**
   * Process a job by running all agents in sequence
   */
  async processJob(jobId: string): Promise<void> {
    try {
      // Fetch job details
      const job = await prisma.agentEditorJob.findUnique({
        where: { id: jobId },
        include: {
          project: {
            include: {
              assets: true,
              clips: true
            }
          }
        }
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Update job status to processing
      await prisma.agentEditorJob.update({
        where: { id: jobId },
        data: {
          status: "processing",
          progress: {
            totalAgents: this.agents.length,
            completedAgents: 0,
            currentAgent: null
          }
        }
      });

      logger.info("Starting agent orchestration", {
        jobId,
        agentCount: this.agents.length
      });

      // Get clip and asset details if clipId is provided
      let clip = null;
      let asset = null;

      if (job.clipId) {
        clip = await prisma.clip.findUnique({
          where: { id: job.clipId },
          include: {
            asset: true
          }
        });

        if (!clip) {
          throw new Error(`Clip ${job.clipId} not found`);
        }

        asset = clip.asset;
      } else {
        // Use the primary asset from the project
        asset = job.project.assets[0];
      }

      if (!asset) {
        throw new Error("No asset found for processing");
      }

      // Build agent context
      const context: AgentContext = {
        jobId: job.id,
        projectId: job.projectId,
        clipId: job.clipId ?? undefined,
        userId: job.userId,
        config: (job.config as Record<string, any>) ?? {},
        transcript: asset.transcript ?? undefined,
        clipStartMs: clip?.startMs,
        clipEndMs: clip?.endMs,
        assetPath: asset.storagePath,
        previousResults: {}
      };

      // Execute agents in sequence
      let completedCount = 0;

      for (const agent of this.agents) {
        // Check if job has been cancelled before starting next agent
        const currentJob = await prisma.agentEditorJob.findUnique({
          where: { id: jobId },
          select: { status: true }
        });

        if (currentJob?.status === "failed") {
          logger.info("Job was cancelled, stopping orchestration", { jobId });
          return; // Exit early without throwing error
        }

        logger.info(`Executing agent`, {
          jobId,
          agentName: agent.constructor.name,
          progress: `${completedCount}/${this.agents.length}`
        });

        const result = await this.executeAgentWithRetry(agent, context);

        if (!result.success) {
          throw new Error(
            `Agent ${agent.constructor.name} failed: ${result.error}`
          );
        }

        // Store agent results for next agents
        if (result.data) {
          context.previousResults![agent.constructor.name] = result.data;
        }

        completedCount++;

        // Update job progress
        await prisma.agentEditorJob.update({
          where: { id: jobId },
          data: {
            progress: {
              totalAgents: this.agents.length,
              completedAgents: completedCount,
              currentAgent: agent.constructor.name,
              lastCompletedAgent: agent.constructor.name
            }
          }
        });
      }

      // All agents completed successfully
      await this.completeJob(jobId, context);

      logger.info("Agent orchestration completed successfully", {
        jobId,
        agentCount: this.agents.length
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Agent orchestration failed", {
        jobId,
        error: errorMessage
      });

      await this.failJob(jobId, errorMessage);
    }
  }

  /**
   * Execute an agent with retry logic
   */
  private async executeAgentWithRetry(
    agent: BaseAgent,
    context: AgentContext
  ): Promise<AgentResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        logger.info(`Retrying agent`, {
          jobId: context.jobId,
          agentName: agent.constructor.name,
          attempt,
          maxRetries: this.maxRetries
        });

        await this.delay(this.retryDelay);
      }

      const result = await agent.run(context);

      if (result.success) {
        return result;
      }

      lastError = result.error;
    }

    return {
      success: false,
      error: lastError ?? "Unknown error after all retries"
    };
  }

  /**
   * Mark job as completed
   */
  private async completeJob(
    jobId: string,
    context: AgentContext
  ): Promise<void> {
    // The Editor agent should have set the resultPath
    // If not, we'll leave it null for now
    await prisma.agentEditorJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        progress: {
          totalAgents: this.agents.length,
          completedAgents: this.agents.length,
          status: "completed"
        }
      }
    });
  }

  /**
   * Mark job as failed
   */
  private async failJob(jobId: string, error: string): Promise<void> {
    await prisma.agentEditorJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: error,
        completedAt: new Date()
      }
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a default orchestrator with all 6 production agents
 */
export function createDefaultOrchestrator(): AgentOrchestrator {
  // Lazy import to avoid issues during initial load
  const {
    ScriptAnalyzerAgent,
    AssetCuratorAgent,
    MotionDesignerAgent,
    AudioEnhancerAgent,
    StyleMatcherAgent,
    EditorAgent
  } = require("./agents");

  const agents: BaseAgent[] = [
    new ScriptAnalyzerAgent(),    // 1. Analyze transcript for key moments
    new AssetCuratorAgent(),       // 2. Curate b-roll and assets
    new MotionDesignerAgent(),     // 3. Design transitions and animations
    new AudioEnhancerAgent(),      // 4. Enhance audio and music
    new StyleMatcherAgent(),       // 5. Apply style and branding
    new EditorAgent()              // 6. Final composition
  ];

  return new AgentOrchestrator({
    agents,
    maxRetries: 2,
    retryDelay: 5000
  });
}
