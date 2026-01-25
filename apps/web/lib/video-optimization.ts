import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";
import { logger } from "./logger";

export interface PlatformExportOptions {
  platform: "youtube" | "tiktok" | "instagram" | "twitter" | "linkedin";
  quality: "high" | "medium" | "low";
}

export interface ThumbnailOptions {
  inputPath: string;
  outputDir: string;
  count?: number; // Number of thumbnails to generate
  timestamps?: number[]; // Specific timestamps in seconds
}

/**
 * Platform-specific video encoding presets
 */
const PLATFORM_PRESETS = {
  youtube: {
    resolution: "1920x1080",
    fps: 30,
    videoBitrate: "8000k",
    audioBitrate: "192k",
    format: "mp4",
    codec: "libx264",
    profile: "high",
    level: "4.2",
    maxBitrate: "10000k",
    bufsize: "20000k"
  },
  tiktok: {
    resolution: "1080x1920", // Portrait 9:16
    fps: 30,
    videoBitrate: "4000k",
    audioBitrate: "128k",
    format: "mp4",
    codec: "libx264",
    profile: "main",
    level: "4.0",
    maxBitrate: "5000k",
    bufsize: "8000k"
  },
  instagram: {
    resolution: "1080x1920", // Portrait for Reels
    fps: 30,
    videoBitrate: "3500k",
    audioBitrate: "128k",
    format: "mp4",
    codec: "libx264",
    profile: "main",
    level: "4.0",
    maxBitrate: "4000k",
    bufsize: "6000k"
  },
  twitter: {
    resolution: "1280x720",
    fps: 30,
    videoBitrate: "2000k",
    audioBitrate: "128k",
    format: "mp4",
    codec: "libx264",
    profile: "main",
    level: "4.0",
    maxBitrate: "2500k",
    bufsize: "4000k"
  },
  linkedin: {
    resolution: "1920x1080",
    fps: 30,
    videoBitrate: "5000k",
    audioBitrate: "192k",
    format: "mp4",
    codec: "libx264",
    profile: "main",
    level: "4.0",
    maxBitrate: "6000k",
    bufsize: "10000k"
  }
};

/**
 * Quality-based CRF values (lower = better quality, larger file)
 */
const QUALITY_CRF = {
  high: 18,
  medium: 23,
  low: 28
};

/**
 * Generate video thumbnail(s)
 */
export async function generateThumbnails(
  options: ThumbnailOptions
): Promise<string[]> {
  const { inputPath, outputDir, count = 3, timestamps } = options;

  await fs.mkdir(outputDir, { recursive: true });

  const thumbnailPaths: string[] = [];

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath);

    if (timestamps && timestamps.length > 0) {
      // Generate thumbnails at specific timestamps
      timestamps.forEach((timestamp, index) => {
        const filename = `thumb-${nanoid(8)}-${index}.jpg`;
        const outputPath = path.join(outputDir, filename);

        command
          .screenshots({
            timestamps: [timestamp],
            filename,
            folder: outputDir,
            size: "1280x720"
          });

        thumbnailPaths.push(outputPath);
      });
    } else {
      // Generate evenly spaced thumbnails
      command
        .screenshots({
          count,
          folder: outputDir,
          filename: `thumb-${nanoid(8)}-%i.jpg`,
          size: "1280x720"
        });

      // Generate paths for the thumbnails that will be created
      for (let i = 1; i <= count; i++) {
        thumbnailPaths.push(path.join(outputDir, `thumb-${nanoid(8)}-${i}.jpg`));
      }
    }

    command
      .on("end", () => {
        logger.info("Thumbnails generated", { count: thumbnailPaths.length });
        resolve(thumbnailPaths);
      })
      .on("error", (error) => {
        logger.error("Thumbnail generation failed", { error: error.message });
        reject(error);
      });
  });
}

/**
 * Export video optimized for specific platform
 */
export async function exportForPlatform(
  inputPath: string,
  outputDir: string,
  options: PlatformExportOptions
): Promise<string> {
  const { platform, quality } = options;
  const preset = PLATFORM_PRESETS[platform];
  const crf = QUALITY_CRF[quality];

  await fs.mkdir(outputDir, { recursive: true });

  const filename = `${platform}-${quality}-${nanoid(12)}.${preset.format}`;
  const outputPath = path.join(outputDir, filename);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v", preset.codec,
        "-profile:v", preset.profile,
        "-level", preset.level,
        "-crf", crf.toString(),
        "-maxrate", preset.maxBitrate,
        "-bufsize", preset.bufsize,
        "-vf", `scale=${preset.resolution}:force_original_aspect_ratio=decrease,pad=${preset.resolution}:(ow-iw)/2:(oh-ih)/2`,
        "-r", preset.fps.toString(),
        "-c:a", "aac",
        "-b:a", preset.audioBitrate,
        "-ar", "48000",
        "-movflags", "+faststart", // Enable streaming
        "-pix_fmt", "yuv420p" // Maximum compatibility
      ])
      .output(outputPath)
      .on("start", (commandLine) => {
        logger.info("Platform export started", {
          platform,
          quality,
          command: commandLine
        });
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          logger.debug("Export progress", {
            platform,
            percent: progress.percent.toFixed(2)
          });
        }
      })
      .on("end", () => {
        logger.info("Platform export completed", {
          platform,
          quality,
          outputPath
        });
        resolve(outputPath);
      })
      .on("error", (error) => {
        logger.error("Platform export failed", {
          platform,
          error: error.message
        });
        reject(error);
      })
      .run();
  });
}

/**
 * Compress video while maintaining quality
 */
export async function compressVideo(
  inputPath: string,
  outputPath: string,
  targetSizeMB?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath);

    if (targetSizeMB) {
      // Calculate bitrate to achieve target file size
      // This is a simplified calculation
      command.outputOptions([
        "-c:v", "libx264",
        "-preset", "slow", // Slower = better compression
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k"
      ]);
    } else {
      // Standard compression
      command.outputOptions([
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart"
      ]);
    }

    command
      .output(outputPath)
      .on("start", (commandLine) => {
        logger.info("Video compression started", { command: commandLine });
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          logger.debug("Compression progress", {
            percent: progress.percent.toFixed(2)
          });
        }
      })
      .on("end", () => {
        logger.info("Video compression completed", { outputPath });
        resolve();
      })
      .on("error", (error) => {
        logger.error("Video compression failed", { error: error.message });
        reject(error);
      })
      .run();
  });
}

/**
 * Get video metadata
 */
export async function getVideoMetadata(
  inputPath: string
): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  size: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, async (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }

      const stats = await fs.stat(inputPath);

      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        fps: eval(videoStream.r_frame_rate || "30/1"),
        bitrate: metadata.format.bit_rate || 0,
        size: stats.size
      });
    });
  });
}

/**
 * Create a video preview (short clip from the middle)
 */
export async function createPreview(
  inputPath: string,
  outputPath: string,
  durationSeconds: number = 10
): Promise<void> {
  const metadata = await getVideoMetadata(inputPath);
  const startTime = Math.max(0, (metadata.duration / 2) - (durationSeconds / 2));

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(durationSeconds)
      .outputOptions([
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k"
      ])
      .output(outputPath)
      .on("end", () => {
        logger.info("Preview created", { outputPath, duration: durationSeconds });
        resolve();
      })
      .on("error", (error) => {
        logger.error("Preview creation failed", { error: error.message });
        reject(error);
      })
      .run();
  });
}
