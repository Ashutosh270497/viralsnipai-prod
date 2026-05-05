import { spawn } from "child_process";
import { mkdtemp, rm, stat } from "fs/promises";
import os from "os";
import path from "path";

import ffmpegStatic from "ffmpeg-static";

import { renderWithRemotion } from "@/lib/media/remotion-renderer";
import { DEFAULT_CLIP_CAPTION_STYLE } from "@/lib/repurpose/caption-style-config";

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  if (process.env.RUN_REMOTION_RENDER_SMOKE !== "true") {
    console.log("Skipping Remotion render smoke. Set RUN_REMOTION_RENDER_SMOKE=true to render a real MP4.");
    return;
  }

  const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic;
  if (!ffmpeg) {
    throw new Error("No FFmpeg binary found. Set FFMPEG_PATH or install ffmpeg-static.");
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "viralsnipai-remotion-smoke-"));
  const inputPath = path.join(tempDir, "input.mp4");
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    await run(ffmpeg, [
      "-y",
      "-f", "lavfi",
      "-i", "testsrc2=size=1080x1920:rate=30:duration=2",
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-shortest",
      "-c:v", "libx264",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      inputPath,
    ]);

    await renderWithRemotion({
      preVideoPath: inputPath,
      outputPath,
      durationMs: 2000,
      captionsEnabled: true,
      entries: [{ index: 1, startMs: 0, endMs: 2000, text: "Remotion smoke test" }],
      captionStyle: {
        ...DEFAULT_CLIP_CAPTION_STYLE,
        animation: { type: "pop", wordHighlight: true, speed: "normal" },
      },
      watermarkText: "ViralSnipAI",
    });

    const size = (await stat(outputPath)).size;
    if (size < 10_000) {
      throw new Error(`Remotion smoke output is too small: ${size} bytes`);
    }

    console.log(`Remotion render smoke passed: ${outputPath} (${size} bytes)`);
  } finally {
    if (process.env.KEEP_REMOTION_SMOKE_OUTPUT !== "true") {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
