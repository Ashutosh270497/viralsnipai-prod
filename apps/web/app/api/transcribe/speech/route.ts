export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { openAIClient } from "@/lib/openai";
import { saveBuffer } from "@/lib/storage";

const requestSchema = z.object({
  text: z.string().min(3),
  voice: z.string().optional(),
  format: z.enum(["mp3", "wav", "ogg", "flac"]).optional()
});

const DEFAULT_TTS_MODEL = process.env.TTS_MODEL ?? "gpt-4o-mini-tts";
const DEFAULT_VOICE = process.env.TTS_VOICE ?? "alloy";
const DEFAULT_FORMAT = (process.env.TTS_FORMAT ?? "mp3") as "mp3";
const FALLBACK_TTS_MODEL = process.env.TTS_FALLBACK_MODEL ?? "tts-1";

const FORMAT_CONTENT_TYPE: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac"
};

const RESPONSE_FORMAT_MAP: Record<string, "mp3" | "wav" | "opus" | "aac" | "flac" | "pcm"> = {
  mp3: "mp3",
  wav: "wav",
  ogg: "opus",
  flac: "flac"
};

const MODEL_VOICE_MAP: Record<string, readonly string[]> = {
  "gpt-4o-mini-tts": ["alloy", "verse", "blossom", "ballad", "coral"],
  "tts-1": ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"],
  "tts-1-hd": ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"]
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (!openAIClient) {
    return NextResponse.json(
      { error: "Text-to-speech requires OPENAI_API_KEY. Set USE_MOCK_TRANSCRIBE=true for local mocks." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const text = parsed.data.text.trim();
  const requestedVoice = (parsed.data.voice ?? DEFAULT_VOICE).trim() || DEFAULT_VOICE;
  const format = parsed.data.format ?? DEFAULT_FORMAT;
  const contentType = FORMAT_CONTENT_TYPE[format] ?? "audio/mpeg";

  const responseFormat = RESPONSE_FORMAT_MAP[format] ?? "mp3";

  const synthesizeChunk = async (model: string, voiceToUse: string, chunk: string) => {
    if (shouldUseResponsesApi(model)) {
      const response = await openAIClient.responses.create({
        model,
        input: chunk,
        modalities: ["audio"],
        audio: {
          voice: voiceToUse,
          format: responseFormat
        }
      });

      const audioBase64 = extractAudioBase64(response);
      if (!audioBase64) {
        throw new Error("No audio data returned from text-to-speech model response.");
      }
      return Buffer.from(audioBase64, "base64");
    }

    const speech = await openAIClient.audio.speech.create({
      model,
      voice: voiceToUse,
      input: chunk,
      response_format: responseFormat
    });
    return Buffer.from(await speech.arrayBuffer());
  };

  const synthesizeFull = async (model: string, voiceToUse: string) => {
    const chunks = splitTextForModel(text, model);
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      if (!chunk) continue;
      const buffer = await synthesizeChunk(model, voiceToUse, chunk);
      buffers.push(buffer);
    }
    return combineAudioBuffers(buffers, format);
  };

  let modelUsed = DEFAULT_TTS_MODEL;
  let voiceUsed = normalizeVoiceForModel(DEFAULT_TTS_MODEL, requestedVoice);

  try {
    let buffer: Buffer;
    try {
      buffer = await synthesizeFull(DEFAULT_TTS_MODEL, voiceUsed);
    } catch (primaryError) {
      if (shouldAttemptFallback(primaryError) && DEFAULT_TTS_MODEL !== FALLBACK_TTS_MODEL) {
        console.warn(`Primary TTS model "${DEFAULT_TTS_MODEL}" failed, falling back to "${FALLBACK_TTS_MODEL}".`, primaryError);
        modelUsed = FALLBACK_TTS_MODEL;
        voiceUsed = normalizeVoiceForModel(FALLBACK_TTS_MODEL, requestedVoice);
        buffer = await synthesizeFull(FALLBACK_TTS_MODEL, voiceUsed);
      } else {
        throw primaryError;
      }
    }

    const saved = await saveBuffer(buffer, {
      prefix: `transcribe/${user.id}/speech/`,
      extension: `.${format}`,
      contentType
    });

    return NextResponse.json(
      {
        audioUrl: saved.url,
        voice: voiceUsed,
        format,
        model: modelUsed,
        size: buffer.length,
        fileKey: saved.key,
        text
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Text-to-speech generation failed", error);
    const message =
      error instanceof Error ? error.message : "Unable to generate speech.";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

function shouldAttemptFallback(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const apiError = error as { status?: number; code?: string; message?: string };
  const message = (apiError.message ?? "").toLowerCase();

  if (apiError.status === 404 || apiError.status === 403) {
    return true;
  }

  if (apiError.status === 400) {
    if (
      message.includes("model") ||
      message.includes("voice") ||
      message.includes("modalities") ||
      message.includes("not found")
    ) {
      return true;
    }
  }

  return false;
}

function normalizeVoiceForModel(model: string, requestedVoice: string) {
  const normalizedModel = model.toLowerCase();
  const voices = Object.entries(MODEL_VOICE_MAP).find(([key]) => normalizedModel.includes(key))?.[1];
  if (!voices || voices.length === 0) {
    return requestedVoice;
  }
  if (voices.includes(requestedVoice as (typeof voices)[number])) {
    return requestedVoice;
  }
  return voices[0];
}

function shouldUseResponsesApi(model: string) {
  const normalized = model.toLowerCase();
  return normalized.includes("gpt-4o");
}

function splitTextForModel(content: string, model: string) {
  const limit = resolveChunkLimit(model);
  if (content.length <= limit) {
    return [content];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(content.length, start + limit);

    if (end < content.length) {
      const lastWhitespace = content.lastIndexOf(" ", end);
      if (lastWhitespace > start + Math.floor(limit * 0.4)) {
        end = lastWhitespace;
      }
    }

    const slice = content.slice(start, end).trim();
    if (slice) {
      chunks.push(slice);
    }

    start = end;
  }

  return chunks.length === 0 ? [content] : chunks;
}

function resolveChunkLimit(model: string) {
  if (shouldUseResponsesApi(model)) {
    return 12000;
  }
  return 3500;
}

function extractAudioBase64(response: unknown) {
  const candidateArrays: unknown[] = [];

  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.output)) {
      candidateArrays.push(obj.output);
    }
    if (Array.isArray(obj.output_items)) {
      candidateArrays.push(obj.output_items);
    }
    if (Array.isArray(obj.content)) {
      candidateArrays.push(obj.content);
    }
  }

  for (const collection of candidateArrays) {
    for (const item of collection as unknown[]) {
      if (!item || typeof item !== "object") {
        continue;
      }

      // Some responses nest audio within a content array.
      const content = (item as Record<string, unknown>).content;
      if (Array.isArray(content)) {
        for (const part of content) {
          const audio = pickAudio(part);
          if (audio) {
            return audio;
          }
        }
      }

      const directAudio = pickAudio(item);
      if (directAudio) {
        return directAudio;
      }
    }
  }

  return null;
}

function combineAudioBuffers(buffers: Buffer[], format: string) {
  if (buffers.length === 0) {
    return Buffer.from([]);
  }
  if (buffers.length === 1) {
    return buffers[0];
  }

  if (format === "wav") {
    const headerSize = 44;
    const first = buffers[0];
    const dataBuffers = buffers.map((buffer, index) => {
      if (index === 0) {
        return buffer.subarray(headerSize);
      }
      return buffer.length > headerSize ? buffer.subarray(headerSize) : buffer;
    });

    const totalDataLength = dataBuffers.reduce((acc, buffer) => acc + buffer.length, 0);
    const combined = Buffer.alloc(headerSize + totalDataLength);
    first.copy(combined, 0, 0, headerSize);
    Buffer.concat(dataBuffers).copy(combined, headerSize);

    combined.writeUInt32LE(totalDataLength + 36, 4);
    combined.writeUInt32LE(totalDataLength, 40);
    return combined;
  }

  return Buffer.concat(buffers);
}

function pickAudio(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.data === "string" && typeof obj.type === "string" && obj.type.includes("audio")) {
    return obj.data;
  }

  const audio = obj.audio;
  if (audio && typeof audio === "object") {
    const audioObj = audio as Record<string, unknown>;
    if (typeof audioObj.data === "string") {
      return audioObj.data;
    }
  }

  return null;
}
