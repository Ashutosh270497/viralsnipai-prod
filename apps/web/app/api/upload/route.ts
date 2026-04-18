export const dynamic = "force-dynamic";
export const revalidate = 0;

import path from "path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { probeDuration } from "@/lib/ffmpeg";
import { saveBuffer } from "@/lib/storage";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".mkv", ".avi"]);
const ALLOWED_AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg"]);

const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/x-msvideo"]);
const ALLOWED_AUDIO_MIME = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac", "audio/ogg"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const projectId = formData.get("projectId");
  const file = formData.get("file");

  if (typeof projectId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  // Validate MIME type
  const isAudio = ALLOWED_AUDIO_MIME.has(file.type);
  const isVideo = ALLOWED_VIDEO_MIME.has(file.type);
  if (!isAudio && !isVideo) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: video (mp4, webm, mov) or audio (mp3, wav, m4a)." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Validate extension against whitelist
  const extension = path.extname(file.name).toLowerCase();
  const allowedExtensions = isAudio ? ALLOWED_AUDIO_EXTENSIONS : ALLOWED_VIDEO_EXTENSIONS;
  if (!allowedExtensions.has(extension)) {
    return NextResponse.json(
      { error: "File extension does not match type. Please use a standard file name." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Validate file size before reading into memory
  const maxSize = isAudio ? MAX_AUDIO_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return NextResponse.json(
      { error: `File too large. Maximum size is ${limitMB} MB.` },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id }
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const saved = await saveBuffer(buffer, {
    prefix: `${projectId}/assets/`,
    extension,                // already validated above
    contentType: file.type
  });

  let durationSec: number | null = null;
  try {
    const duration = await probeDuration(saved.storagePath);
    durationSec = Math.round(duration);
  } catch (error) {
    console.warn("Unable to probe duration", error);
  }

  const asset = await prisma.asset.create({
    data: {
      projectId: project.id,
      type: isAudio ? "audio" : "video",
      path: saved.url,
      storagePath: saved.storagePath,
      durationSec
    }
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { updatedAt: new Date() }
  });

  return NextResponse.json({ asset }, { headers: { "Cache-Control": "no-store" } });
}
