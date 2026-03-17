export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveBuffer } from "@/lib/storage";
import { createElevenLabsVoice, ElevenLabsError } from "@/lib/elevenlabs";

const MAX_SAMPLE_BYTES = 10 * 1024 * 1024; // 10MB

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const voices = await prisma.voiceProfile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      renders: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    }
  });

  return NextResponse.json(
    {
      voices: voices.map((voice) => ({
        id: voice.id,
        name: voice.name,
        description: voice.description,
        providerVoiceId: voice.providerVoiceId,
        sampleUrl: voice.samplePath,
        metadata: voice.metadata,
        createdAt: voice.createdAt,
        renders: voice.renders.map((render) => ({
          id: render.id,
          text: render.text,
          audioUrl: render.audioPath,
          createdAt: render.createdAt
        }))
      }))
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description");
  const file = formData.get("sample");

  if (typeof name !== "string" || name.trim().length < 3) {
    return NextResponse.json(
      { error: "Voice name must be at least 3 characters." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Sample audio is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (file.size > MAX_SAMPLE_BYTES) {
    return NextResponse.json(
      { error: "Sample audio must be 10MB or smaller." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension =
    typeof file.name === "string" && file.name.includes(".")
      ? `.${file.name.split(".").pop()!.toLowerCase()}`
      : file.type.includes("wav")
        ? ".wav"
        : ".mp3";

  try {
    const savedSample = await saveBuffer(buffer, {
      prefix: `${user.id}/voices/samples/`,
      extension,
      contentType: file.type || "audio/mpeg"
    });

    const result = await createElevenLabsVoice({
      name: name.trim(),
      description: typeof description === "string" ? description.trim() || undefined : undefined,
      sample: {
        buffer,
        contentType: file.type || "audio/mpeg",
        filename: file.name || "sample.mp3"
      },
      labels: {
        userId: user.id,
        source: "clippers-voicer"
      }
    });

    const voice = await prisma.voiceProfile.create({
      data: {
        userId: user.id,
        name: result.name,
        description: typeof description === "string" ? description.trim() || null : null,
        providerVoiceId: result.voiceId,
        samplePath: savedSample.url,
        sampleStoragePath: savedSample.storagePath,
        metadata: (result.other as any) ?? undefined
      }
    });

    return NextResponse.json(
      {
        voice: {
          id: voice.id,
          name: voice.name,
          description: voice.description,
          providerVoiceId: voice.providerVoiceId,
          sampleUrl: voice.samplePath,
          metadata: voice.metadata,
          createdAt: voice.createdAt,
          renders: []
        }
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Voicer] Voice creation failed", error);
    if (error instanceof ElevenLabsError) {
      return NextResponse.json(
        {
          error: error.message,
          detail: error.payload
        },
        { status: error.status ?? 502, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Unable to clone voice at this time." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
