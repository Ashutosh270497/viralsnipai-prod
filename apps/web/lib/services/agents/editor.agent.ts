import { BaseAgent, AgentContext, AgentResult } from "./base-agent";
import { logger } from "@/lib/logger";
import { extractClip, renderExport, PRESETS } from "@/lib/ffmpeg";
import path from "path";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";

export class EditorAgent extends BaseAgent {
  constructor() {
    super("EditorAgent");
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      if (!context.assetPath) {
        return {
          success: false,
          error: "No asset path provided"
        };
      }

      // Get script analysis and curated assets from previous agents
      const scriptAnalysis = context.previousResults?.["ScriptAnalyzerAgent"];
      const assetCuration = context.previousResults?.["AssetCuratorAgent"];

      logger.info("Starting video editing", {
        jobId: context.jobId,
        hasScriptAnalysis: !!scriptAnalysis,
        hasAssets: !!assetCuration,
        clipStartMs: context.clipStartMs,
        clipEndMs: context.clipEndMs
      });

      // Extract the main clip
      const mainClipPath = await this.extractMainClip(
        context.assetPath,
        context.clipStartMs,
        context.clipEndMs,
        context.projectId
      );

      // Integrate b-roll footage if available
      const finalVideoPath = await this.compositeVideo(
        mainClipPath,
        scriptAnalysis?.analysis,
        assetCuration,
        context
      );

      // Update job with result path
      await this.updateJobResult(context.jobId, finalVideoPath);

      logger.info("Video editing completed", {
        jobId: context.jobId,
        resultPath: finalVideoPath
      });

      return {
        success: true,
        data: {
          resultPath: finalVideoPath,
          mainClipPath
        }
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Video editing failed", {
        jobId: context.jobId,
        error: message
      });

      return {
        success: false,
        error: message
      };
    }
  }

  private async extractMainClip(
    assetPath: string,
    startMs: number | undefined,
    endMs: number | undefined,
    projectId: string
  ): Promise<string> {
    const filename = `clip-${nanoid(12)}.mp4`;
    const outputDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "agent-clips",
      projectId
    );
    const outputPath = path.join(outputDir, filename);

    await fs.mkdir(outputDir, { recursive: true });

    if (startMs !== undefined && endMs !== undefined) {
      // Extract specific segment
      await extractClip({
        inputPath: assetPath,
        startMs,
        endMs,
        outputPath
      });
    } else {
      // Copy entire asset
      await fs.copyFile(assetPath, outputPath);
    }

    return `/uploads/agent-clips/${projectId}/${filename}`;
  }

  private async compositeVideo(
    mainClipPath: string,
    scriptAnalysis: any,
    assetCuration: any,
    context: AgentContext
  ): Promise<string> {
    // Get results from other agents
    const motionDesign = context.previousResults?.["MotionDesignerAgent"]?.motionDesign;
    const audioEnhancement = context.previousResults?.["AudioEnhancerAgent"]?.audioEnhancement;
    const styleProfile = context.previousResults?.["StyleMatcherAgent"]?.styleProfile;

    logger.info("Starting advanced video composition", {
      jobId: context.jobId,
      hasMotionDesign: !!motionDesign,
      hasAudioEnhancement: !!audioEnhancement,
      hasStyleProfile: !!styleProfile
    });

    // Generate output filename
    const filename = `final-${nanoid(12)}.mp4`;
    const outputDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "agent-clips",
      context.projectId
    );
    const outputPath = path.join(outputDir, filename);
    await fs.mkdir(outputDir, { recursive: true });

    // Convert mainClipPath from public URL to file path
    const mainClipFilePath = path.join(process.cwd(), "public", mainClipPath);

    // Apply enhancements using FFmpeg
    await this.applyEnhancements(
      mainClipFilePath,
      outputPath,
      styleProfile,
      motionDesign,
      audioEnhancement,
      context
    );

    logger.info("Video composition completed", {
      jobId: context.jobId,
      outputPath: `/uploads/agent-clips/${context.projectId}/${filename}`
    });

    return `/uploads/agent-clips/${context.projectId}/${filename}`;
  }

  private async updateJobResult(
    jobId: string,
    resultPath: string
  ): Promise<void> {
    const { prisma } = await import("@/lib/prisma");

    await prisma.agentEditorJob.update({
      where: { id: jobId },
      data: {
        resultPath
      }
    });
  }

  /**
   * Apply video enhancements using FFmpeg filters
   */
  private async applyEnhancements(
    inputPath: string,
    outputPath: string,
    styleProfile: any,
    motionDesign: any,
    audioEnhancement: any,
    context: AgentContext
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // DISABLED: Color grading and filters were making videos too dark
      // For now, we'll just do a clean re-encode without modifications
      // TODO: Implement proper color grading with brightness compensation

      logger.info("Applying video enhancements (minimal mode)", {
        jobId: context.jobId,
        note: "Color grading disabled to prevent darkening"
      });

      // Build FFmpeg command for clean re-encode
      const command = ffmpeg(inputPath);

      // No video filters applied - just clean pass-through
      // No audio filters applied - keep original audio

      // Output options for high quality
      command
        .outputOptions([
          "-c:v", "libx264",
          "-preset", "medium",
          "-crf", "18",
          "-c:a", "aac",
          "-b:a", "192k",
          "-movflags", "+faststart"
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          logger.info("FFmpeg enhancement started", {
            jobId: context.jobId,
            command: commandLine
          });
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            logger.debug("FFmpeg progress", {
              jobId: context.jobId,
              percent: progress.percent.toFixed(2)
            });
          }
        })
        .on("end", () => {
          logger.info("FFmpeg enhancement completed", {
            jobId: context.jobId
          });
          resolve();
        })
        .on("error", (error) => {
          logger.error("FFmpeg enhancement failed", {
            jobId: context.jobId,
            error: error.message
          });
          reject(error);
        })
        .run();
    });
  }

  /**
   * Overlay b-roll footage at specific timestamps (for future implementation)
   */
  private async overlayBRoll(
    mainClipPath: string,
    bRollPath: string,
    startMs: number,
    endMs: number,
    outputPath: string
  ): Promise<void> {
    const startSeconds = startMs / 1000;
    const durationSeconds = (endMs - startMs) / 1000;

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(mainClipPath)
        .input(bRollPath)
        .complexFilter([
          {
            filter: "overlay",
            options: {
              enable: `between(t,${startSeconds},${startSeconds + durationSeconds})`,
              x: "W-w-10",
              y: "H-h-10"
            },
            inputs: ["0:v", "1:v"],
            outputs: "out"
          }
        ])
        .outputOptions([
          "-map",
          "[out]",
          "-map",
          "0:a?",
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "18",
          "-c:a",
          "aac"
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .run();
    });
  }

  /**
   * Add transition between clips (for future implementation)
   */
  private async addTransition(
    clip1Path: string,
    clip2Path: string,
    outputPath: string,
    transitionType: "fade" | "slide" | "dissolve" = "fade",
    durationSeconds: number = 0.5
  ): Promise<void> {
    // Implementation would use FFmpeg xfade filter
    // For now, this is a placeholder
    logger.info("Transition effect placeholder", { transitionType });
  }
}
