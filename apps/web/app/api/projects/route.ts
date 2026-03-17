export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createProjectSchema = z.object({
  title: z.string().min(2),
  topic: z.string().optional(),
  sourceUrl: z.string().url().optional()
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      topic: true,
      sourceUrl: true,
      createdAt: true,
      updatedAt: true,
      // Lightweight counts for the list UI — avoids fetching all rows
      _count: { select: { clips: true, assets: true, exports: true } },
      // Primary asset preview (latest only)
      assets: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, type: true, path: true, durationSec: true, transcript: true, createdAt: true },
      },
      // Recent clips for the repurpose selector (latest 5)
      clips: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, startMs: true, endMs: true, viralityScore: true, captionSrt: true, previewPath: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ projects }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const json = await request.json();
  const result = createProjectSchema.safeParse(json);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const project = await prisma.project.create({
    data: {
      title: result.data.title,
      topic: result.data.topic,
      sourceUrl: result.data.sourceUrl,
      userId: user.id
    }
  });

  return NextResponse.json({ project }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
