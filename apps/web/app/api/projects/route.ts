export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectSchema } from "@/lib/validations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      topic: true,
      sourceUrl: true,
      targetPlatform: true,
      contentGoal: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { clips: true, assets: true, exports: true } },
      assets: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          type: true,
          path: true,
          durationSec: true,
          transcript: true,
          createdAt: true,
        },
      },
      clips: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          startMs: true,
          endMs: true,
          viralityScore: true,
          captionSrt: true,
          previewPath: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    { projects },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const json = await request.json();
  const parsed = createProjectSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const project = await prisma.project.create({
    data: {
      title: parsed.data.title,
      topic: parsed.data.topic,
      sourceUrl: parsed.data.sourceUrl,
      targetPlatform: parsed.data.targetPlatform,
      contentGoal: parsed.data.contentGoal,
      userId: user.id,
    },
  });

  return NextResponse.json(
    { project },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
