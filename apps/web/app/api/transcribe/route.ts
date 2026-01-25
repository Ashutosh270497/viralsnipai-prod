export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transcribeFile } from "@/lib/transcript";

const schema = z.object({ assetId: z.string() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const result = schema.safeParse(json);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const asset = await prisma.asset.findFirst({
    where: {
      id: result.data.assetId,
      project: {
        userId: user.id
      }
    }
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const transcription = await transcribeFile(asset.storagePath);

    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data: { transcript: transcription.text }
    });

    await prisma.project.update({
      where: { id: asset.projectId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ asset: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Transcription failed. Try again or enable USE_MOCK_TRANSCRIBE.";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
