export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveBuffer } from "@/lib/storage";
import { generateElevenLabsSpeech, ElevenLabsError } from "@/lib/elevenlabs";
import { probeDuration } from "@/lib/ffmpeg";

const MAX_TEXT_LENGTH = 600;

const schema = {
  parse(payload: unknown): { voiceId: string; text: string } | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const { voiceId, text } = payload as Record<string, unknown>;
    if (typeof voiceId !== "string" || voiceId.trim().length === 0) {
      return null;
    }
    if (typeof text !== "string" || text.trim().length < 3 || text.length > MAX_TEXT_LENGTH) {
      return null;
    }
    return { voiceId: voiceId.trim(), text: text.trim() };
  }
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.parse(json);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid payload. Provide voiceId and text (3-600 characters)." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const voice = await prisma.voiceProfile.findFirst({
    where: { id: parsed.voiceId, userId: user.id }
  });

  if (!voice) {
    return NextResponse.json(
      { error: "Voice not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await generateElevenLabsSpeech({
      voiceId: voice.providerVoiceId,
      text: parsed.text
    });

    const extension = result.contentType.includes("wav") ? ".wav" : ".mp3";
    const saved = await saveBuffer(result.audio, {
      prefix: `${user.id}/voices/renders/`,
      extension,
      contentType: result.contentType
    });

    let durationSec: number | undefined;
    try {
      const duration = await probeDuration(saved.storagePath);
      durationSec = Number.isFinite(duration) ? Math.round(duration) : undefined;
    } catch (error) {
      console.warn("[Voicer] Unable to probe synthesized audio duration", error);
    }

    const render = await prisma.voiceRender.create({
      data: {
        userId: user.id,
        voiceId: voice.id,
        text: parsed.text,
        audioPath: saved.url,
        audioStoragePath: saved.storagePath,
        durationSec
      }
    });

    return NextResponse.json(
      {
        render: {
          id: render.id,
          voiceId: render.voiceId,
          text: render.text,
          audioUrl: render.audioPath,
          durationSec: render.durationSec,
          createdAt: render.createdAt
        }
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Voicer] Speech synthesis failed", error);
    if (error instanceof ElevenLabsError) {
      return NextResponse.json(
        { error: error.message, detail: error.payload },
        { status: error.status ?? 502, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Unable to synthesize speech at this time." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
