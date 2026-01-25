export const dynamic = "force-dynamic";
export const revalidate = 0;

import path from "path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { probeDuration } from "@/lib/ffmpeg";
import { saveBuffer } from "@/lib/storage";

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

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id }
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = path.extname(file.name) || (file.type.includes("audio") ? ".mp3" : ".mp4");

  const saved = await saveBuffer(buffer, {
    prefix: `${projectId}/assets/`,
    extension,
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
      type: file.type.startsWith("audio") ? "audio" : "video",
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
