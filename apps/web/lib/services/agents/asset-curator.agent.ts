import { BaseAgent, AgentContext, AgentResult } from "./base-agent";
import { logger } from "@/lib/logger";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

export interface PexelsVideo {
  id: number;
  url: string;
  duration: number;
  videoFiles: Array<{
    id: number;
    quality: string;
    fileType: string;
    width: number;
    height: number;
    link: string;
  }>;
}

export class AssetCuratorAgent extends BaseAgent {
  constructor() {
    super("AssetCuratorAgent");
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      // Get script analysis from previous agent
      const scriptAnalysis = context.previousResults?.["ScriptAnalyzerAgent"];

      if (!scriptAnalysis || !scriptAnalysis.analysis) {
        logger.warn("No script analysis found, using fallback suggestions", {
          jobId: context.jobId
        });
      }

      const bRollSuggestions =
        scriptAnalysis?.analysis?.recommendations?.bRollSuggestions ?? [
          "business meeting",
          "technology workspace",
          "creative process"
        ];

      logger.info("Starting asset curation", {
        jobId: context.jobId,
        suggestionCount: bRollSuggestions.length
      });

      // Search for b-roll footage for each suggestion
      const assets = [];

      for (const suggestion of bRollSuggestions.slice(0, 5)) {
        const video = await this.searchPexelsVideo(suggestion);

        if (video) {
          // Download and save the video
          const savedPath = await this.downloadVideo(video, context.projectId);

          assets.push({
            type: "broll",
            source: "pexels",
            path: savedPath,
            metadata: {
              pexelsId: video.id,
              query: suggestion,
              duration: video.duration,
              url: video.url
            }
          });

          logger.info("Curated b-roll asset", {
            jobId: context.jobId,
            query: suggestion,
            videoId: video.id
          });
        }
      }

      return {
        success: true,
        data: {
          curatedAssetsCount: assets.length,
          suggestions: bRollSuggestions
        },
        assets
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Asset curation failed", {
        jobId: context.jobId,
        error: message
      });

      return {
        success: false,
        error: message
      };
    }
  }

  private async searchPexelsVideo(
    query: string
  ): Promise<PexelsVideo | null> {
    if (!PEXELS_API_KEY) {
      logger.warn("Pexels API key not configured, skipping search");
      return null;
    }

    try {
      const response = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(
          query
        )}&per_page=1&orientation=landscape`,
        {
          headers: {
            Authorization: PEXELS_API_KEY
          }
        }
      );

      if (!response.ok) {
        logger.error("Pexels API request failed", {
          status: response.status,
          query
        });
        return null;
      }

      const data = await response.json();

      if (!data.videos || data.videos.length === 0) {
        logger.info("No videos found for query", { query });
        return null;
      }

      const video = data.videos[0];

      return {
        id: video.id,
        url: video.url,
        duration: video.duration,
        videoFiles: video.video_files.map((file: any) => ({
          id: file.id,
          quality: file.quality,
          fileType: file.file_type,
          width: file.width,
          height: file.height,
          link: file.link
        }))
      };
    } catch (error) {
      logger.error("Pexels search failed", { error, query });
      return null;
    }
  }

  private async downloadVideo(
    video: PexelsVideo,
    projectId: string
  ): Promise<string> {
    // Find the best quality HD video file
    const hdFile = video.videoFiles.find(
      (file) =>
        file.quality === "hd" &&
        file.width === 1920 &&
        file.height === 1080
    );

    const file = hdFile ?? video.videoFiles[0];

    if (!file) {
      throw new Error("No video file available");
    }

    // Download the video
    const response = await fetch(file.link);

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Save to uploads directory
    const filename = `broll-${nanoid(12)}.mp4`;
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "broll",
      projectId
    );
    const filePath = path.join(uploadDir, filename);

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, Buffer.from(buffer));

    // Return public path
    return `/uploads/broll/${projectId}/${filename}`;
  }
}
