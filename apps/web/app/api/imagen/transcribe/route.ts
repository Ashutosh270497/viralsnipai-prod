export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { openAIClient } from "@/lib/openai";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15MB cap for voice prompts.
const DEFAULT_WHISPER_MODEL = process.env.WHISPER_MODEL ?? "gpt-4o-mini-transcribe";

function isMockEnabled(): boolean {
  return (process.env.USE_MOCK_TRANSCRIBE ?? "true").toLowerCase() === "true";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Failed to parse form data for /api/imagen/transcribe", error);
    return NextResponse.json(
      { error: "Invalid form payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "Audio file missing" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (audio.size === 0) {
    return NextResponse.json(
      { error: "Audio payload is empty" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio too large. Keep voice prompts under 15MB." },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }

  const filenameEntry = formData.get("filename");
  const filename =
    (typeof filenameEntry === "string" && filenameEntry) || "voice-prompt.webm";
  const mimeType = audio.type || "audio/webm";

  if (isMockEnabled() || !openAIClient) {
    // Minimal mock – just return a placeholder message.
    return NextResponse.json(
      { text: "Voice transcription (mock): describe the scene you want to generate." },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const arrayBuffer = await audio.arrayBuffer();
    const file = new File([arrayBuffer], filename, { type: mimeType });

    const transcription = await openAIClient.audio.transcriptions.create({
      file,
      model: DEFAULT_WHISPER_MODEL,
      response_format: "text"
    });

    // When response_format is "text", transcription is a string directly
    const text = typeof transcription === "string" ? transcription : "";
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Whisper transcription failed", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
