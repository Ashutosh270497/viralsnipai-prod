import { promises as fs } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  ffmpegStatic,
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/usr/bin/ffmpeg"
].filter((candidate): candidate is string => Boolean(candidate));

const ffprobeCandidates = [
  process.env.FFPROBE_PATH,
  (ffprobeStatic && "path" in ffprobeStatic ? (ffprobeStatic as any).path : ffprobeStatic),
  "/opt/homebrew/bin/ffprobe",
  "/usr/local/bin/ffprobe",
  "/usr/bin/ffprobe"
].filter((candidate): candidate is string => Boolean(candidate));

function configureFfmpegBinary() {
  const ffmpegPath = ffmpegCandidates[0];
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } else {
    console.warn("FFmpeg binary path not found. Set FFMPEG_PATH env variable if needed.");
  }

  const ffprobePath = ffprobeCandidates[0];
  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath);
  } else {
    console.warn("FFprobe binary path not found. Set FFPROBE_PATH env variable if needed.");
  }
}

configureFfmpegBinary();

export const PRESETS = {
  shorts_9x16_1080: { width: 1080, height: 1920 },
  square_1x1_1080: { width: 1080, height: 1080 },
  landscape_16x9_1080: { width: 1920, height: 1080 }
} as const;

const playbackOptions = [
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-profile:v",
  "high",
  "-level",
  "4.1",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "256k",
  "-movflags",
  "+faststart"
];

export function getPresetDimensions(preset: keyof typeof PRESETS) {
  return PRESETS[preset];
}

export async function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error);
      } else {
        resolve(metadata.format.duration ?? 0);
      }
    });
  });
}

export async function extractClip({
  inputPath,
  startMs,
  endMs,
  outputPath
}: {
  inputPath: string;
  startMs: number;
  endMs: number;
  outputPath: string;
}) {
  const startSeconds = startMs / 1000;
  const durationSeconds = Math.max((endMs - startMs) / 1000, 1);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .setDuration(durationSeconds)
      .outputOptions([...playbackOptions])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

export async function burnCaptions({
  inputPath,
  srtPath,
  outputPath,
  preset
}: {
  inputPath: string;
  srtPath: string;
  outputPath: string;
  preset: keyof typeof PRESETS;
}) {
  const { width, height } = getPresetDimensions(preset);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const escapedSrt = srtPath.replace(/:/g, "\\:").replace(/'/g, "\\'");

  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        `subtitles='${escapedSrt}',scale=${width}:${height}`,
        ...playbackOptions
      ])
      .size(`${width}x${height}`)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

export async function concatClips({
  clipPaths,
  outputPath,
  preset,
  watermarkPath
}: {
  clipPaths: string[];
  outputPath: string;
  preset: keyof typeof PRESETS;
  watermarkPath?: string | null;
}) {
  const concatListPath = `${outputPath}.txt`;
  const listContent = clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(concatListPath, listContent);

  const { width, height } = getPresetDimensions(preset);

  return new Promise<void>((resolve, reject) => {
    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .size(`${width}x${height}`)
      .outputOptions([...playbackOptions])
      .output(outputPath)
      .on("end", async () => {
        await fs.unlink(concatListPath);
        resolve();
      })
      .on("error", async (error) => {
        await fs.unlink(concatListPath).catch(() => null);
        reject(error);
      });

    if (watermarkPath) {
      const escapedPath = escapeFfmpegPath(watermarkPath);
      const offset = 48;
      command.videoFilters(
        `movie=${escapedPath} [watermark]; [in][watermark] overlay=W-w-${offset}:H-h-${offset} [out]`
      );
    }

    command.run();
  });
}

export async function renderExport({
  segments,
  preset,
  outputPath,
  captionPaths,
  watermarkPath
}: {
  segments: Array<{ startMs: number; endMs: number; id: string; sourcePath: string }>;
  preset: keyof typeof PRESETS;
  outputPath: string;
  captionPaths?: Record<string, string | undefined | null>;
  watermarkPath?: string | null;
}) {
  const tempDir = `${outputPath}_segments`;
  await fs.mkdir(tempDir, { recursive: true });

  const clipPaths: string[] = [];

  for (const segment of segments) {
    const clipPath = path.join(tempDir, `${segment.id}.mp4`);
    await extractClip({
      inputPath: segment.sourcePath,
      startMs: segment.startMs,
      endMs: segment.endMs,
      outputPath: clipPath
    });

    const captionPath = captionPaths?.[segment.id];
    if (captionPath) {
      const captionedPath = path.join(tempDir, `${segment.id}-captioned.mp4`);
      await burnCaptions({
        inputPath: clipPath,
        srtPath: captionPath,
        outputPath: captionedPath,
        preset
      });
      clipPaths.push(captionedPath);
    } else {
      clipPaths.push(clipPath);
    }
  }

  await concatClips({ clipPaths, outputPath, preset, watermarkPath });

  await Promise.all(
    clipPaths.map(async (clipPath) => {
      if (clipPath.startsWith(tempDir)) {
        await fs.unlink(clipPath).catch(() => null);
      }
    })
  );

  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
}

export async function normalizeVideo({
  inputPath,
  outputPath
}: {
  inputPath: string;
  outputPath: string;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([...playbackOptions])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

export async function transcodeToMp3({
  inputPath,
  outputPath,
  bitrateKbps = 64,
  sampleRate = 16000,
  channels = 1
}: {
  inputPath: string;
  outputPath: string;
  bitrateKbps?: number;
  sampleRate?: number;
  channels?: number;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vn",
        "-ac",
        String(channels),
        "-ar",
        String(sampleRate),
        "-b:a",
        `${bitrateKbps}k`
      ])
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .save(outputPath);
  });
}

function escapeFfmpegPath(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export async function generateThumbnail({
  inputPath,
  timestampMs,
  outputPath
}: {
  inputPath: string;
  timestampMs: number;
  outputPath: string;
}) {
  const timestampSeconds = timestampMs / 1000;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(timestampSeconds)
      .outputOptions([
        "-frames:v", "1",
        "-q:v", "2",
        "-vf", "scale=480:-1"
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

/**
 * Extract audio from video file (for voice translation)
 */
export async function extractAudio({
  videoPath,
  outputPath
}: {
  videoPath: string;
  outputPath: string;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .output(outputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run();
  });
}

/**
 * Replace audio in video file (for voice translation)
 */
export async function replaceAudio({
  videoPath,
  audioPath,
  outputPath
}: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run();
  });
}

/**
 * Get audio duration in seconds
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (error, metadata) => {
      if (error) {
        reject(error);
      } else {
        resolve(metadata.format.duration ?? 0);
      }
    });
  });
}
