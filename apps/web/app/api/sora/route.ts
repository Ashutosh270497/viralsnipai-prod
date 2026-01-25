export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { generateSoraVideo } from "@/lib/sora";

type AcceptableFile = File;

const schema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters."),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional(),
  durationSeconds: z.coerce.number().int().min(4).max(60).optional()
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const formData = await request.formData();
  const prompt = formData.get("prompt");
  const aspectRatio = formData.get("aspectRatio") ?? undefined;
  const durationSeconds = formData.get("durationSeconds") ?? undefined;

  const parseResult = schema.safeParse({ prompt, aspectRatio, durationSeconds });
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const referenceImage = formData.get("referenceImage") as AcceptableFile | null;
  const referenceVideo = formData.get("referenceVideo") as AcceptableFile | null;

  try {
    const video = await generateSoraVideo({
      ...parseResult.data,
      referenceImage,
      referenceVideo
    });

    return NextResponse.json({ video }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Sora generation failed", error);
    const message = error instanceof Error ? error.message : "Sora generation failed";
    return NextResponse.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
