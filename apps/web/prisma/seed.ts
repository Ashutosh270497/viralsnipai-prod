import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

const prisma = new PrismaClient();

async function ensureDemoVideo(filePath: string) {
  try {
    await fs.access(filePath);
    return;
  } catch (_) {
    // generate simple color test video
  }

  if (!ffmpegStatic) {
    throw new Error("FFmpeg binary not available for seed generation");
  }

  ffmpeg.setFfmpegPath(ffmpegStatic);

  await new Promise<void>((resolve, reject) => {
    ffmpeg("color=c=#00A3FF:s=1080x1920:d=4")
      .inputFormat("lavfi")
      .outputOptions(["-pix_fmt", "yuv420p", "-movflags", "+faststart"])
      .output(filePath)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

async function main() {
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const captionsDir = path.join(uploadsDir, "captions");
  const exportsDir = path.join(uploadsDir, "exports");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(captionsDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });

  const demoVideoPath = path.join(uploadsDir, "demo-seed.mp4");
  await ensureDemoVideo(demoVideoPath);
  await fs.copyFile(demoVideoPath, path.join(exportsDir, "demo-output.mp4")).catch(() => null);

  const captionPaths = await Promise.all(
    ["clip-1", "clip-2", "clip-3"].map(async (clip, index) => {
      const srtPath = path.join(captionsDir, `${clip}.srt`);
      const content = `1\n00:00:00,000 --> 00:00:01,800\nWelcome to Clippers clip ${index + 1}.\n\n2\n00:00:01,800 --> 00:00:03,500\nEdit once, ship everywhere.`;
      await fs.writeFile(srtPath, content, "utf-8");
      return srtPath;
    })
  );

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@clippers.dev" },
    update: {
      plan: "pro"
    },
    create: {
      email: "demo@clippers.dev",
      name: "Demo Creator",
      plan: "pro"
    }
  });

  const script = await prisma.script.create({
    data: {
      hooks: [
        "Start with the scroll-stopping tension",
        "Promise a surprising insight",
        "Deliver a cliff-hanger CTA"
      ],
      body: `HOOK\nThe clipper revolution is here.\n\nVALUE\n1. Feed your long-form content.\n2. Auto-detect the highlights.\n3. Burn captions that convert.\n\nCTA\nRepurpose everything with Clippers.`,
      tone: "energetic"
    }
  });

  const project = await prisma.project.create({
    data: {
      userId: demoUser.id,
      title: "Product launch spotlight",
      topic: "AI repurposing for marketing teams"
    }
  });

  await prisma.script.update({
    where: { id: script.id },
    data: {
      project: {
        connect: { id: project.id }
      }
    }
  });

  const asset = await prisma.asset.create({
    data: {
      projectId: project.id,
      type: "video",
      path: `/api/uploads/${path.relative(uploadsDir, demoVideoPath)}`,
      storagePath: demoVideoPath,
      durationSec: 12,
      transcript: "This is a seeded transcript generated for demo purposes."
    }
  });

  const clips = await prisma.$transaction(
    captionPaths.map((captionPath, index) =>
      prisma.clip.create({
        data: {
          projectId: project.id,
          assetId: asset.id,
          startMs: index * 2000,
          endMs: index * 2000 + 4000,
          title: `Clip ${index + 1}`,
          captionSrt: captionPath
        }
      })
    )
  );

  await prisma.brandKit.upsert({
    where: { userId: demoUser.id },
    update: {
      primaryHex: "#00A3FF",
      fontFamily: "Inter",
      captionStyle: {
        karaoke: true,
        outline: true,
        position: "bottom"
      },
      watermark: true
    },
    create: {
      userId: demoUser.id,
      primaryHex: "#00A3FF",
      fontFamily: "Inter",
      captionStyle: {
        karaoke: true,
        outline: true,
        position: "bottom"
      },
      watermark: true
    }
  });

  await prisma.export.create({
    data: {
      projectId: project.id,
      clipIds: clips.map((clip) => clip.id),
      preset: "shorts_9x16_1080",
      outputPath: "/api/uploads/exports/demo-output.mp4",
      storagePath: path.join(exportsDir, "demo-output.mp4"),
      status: "done"
    }
  });

  console.log("Seed complete: demo user ready at demo@clippers.dev");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
