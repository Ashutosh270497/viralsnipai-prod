import { Blob } from "node:buffer";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID?.trim() ?? "eleven_multilingual_v2";
const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_BASE_URL?.trim() ?? "https://api.elevenlabs.io";

if (!ELEVENLABS_API_KEY) {
  // Warn at startup if key is missing — requests will throw ElevenLabsError at runtime
}

export class ElevenLabsError extends Error {
  constructor(message: string, readonly status?: number, readonly payload?: unknown) {
    super(message);
  }
}

function requireApiKey() {
  if (!ELEVENLABS_API_KEY) {
    throw new ElevenLabsError("ElevenLabs API key is not configured.");
  }
}

export type CreateVoiceOptions = {
  name: string;
  description?: string;
  sample: {
    buffer: Buffer;
    contentType?: string;
    filename?: string;
  };
  labels?: Record<string, string>;
};

export type CreateVoiceResult = {
  voiceId: string;
  name: string;
  other?: Record<string, unknown>;
};

export async function createElevenLabsVoice(options: CreateVoiceOptions): Promise<CreateVoiceResult> {
  requireApiKey();

  const form = new FormData();
  form.append("name", options.name);
  if (options.description) {
    form.append("description", options.description);
  }
  if (options.labels) {
    form.append("labels", JSON.stringify(options.labels));
  }

  const blob = new Blob([options.sample.buffer], {
    type: options.sample.contentType ?? "audio/mpeg"
  });
  form.append("files", blob as any, options.sample.filename ?? "sample.mp3");

  const response = await fetch(`${ELEVENLABS_BASE_URL.replace(/\/$/, "")}/v1/voices/add`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY!
    },
    body: form
  });

  if (!response.ok) {
    const detail = await safeReadJson(response) ?? (await response.text().catch(() => ""));
    throw new ElevenLabsError("Failed to create ElevenLabs voice", response.status, detail);
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const voiceId = String(payload?.voice_id ?? payload?.voiceId ?? "");
  if (!voiceId) {
    throw new ElevenLabsError("ElevenLabs response missing voice_id", response.status, payload);
  }

  return {
    voiceId,
    name: String(payload?.name ?? options.name),
    other: payload
  };
}

export type GenerateSpeechOptions = {
  voiceId: string;
  text: string;
  modelId?: string;
  optimizeStreamingLatency?: number;
  voiceSettings?: Record<string, unknown>;
};

export type GenerateSpeechResult = {
  audio: Buffer;
  contentType: string;
};

export async function generateElevenLabsSpeech(options: GenerateSpeechOptions): Promise<GenerateSpeechResult> {
  requireApiKey();
  const modelId = options.modelId ?? ELEVENLABS_MODEL_ID;

  const response = await fetch(
    `${ELEVENLABS_BASE_URL.replace(/\/$/, "")}/v1/text-to-speech/${encodeURIComponent(options.voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text: options.text,
        model_id: modelId,
        optimize_streaming_latency: options.optimizeStreamingLatency ?? 1,
        voice_settings: options.voiceSettings ?? {
          stability: 0.4,
          similarity_boost: 0.7,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    }
  );

  if (!response.ok) {
    const detail = await safeReadJson(response) ?? (await response.text().catch(() => ""));
    throw new ElevenLabsError("Failed to synthesize speech", response.status, detail);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "audio/mpeg";
  return {
    audio: Buffer.from(arrayBuffer),
    contentType
  };
}

async function safeReadJson(response: Response): Promise<unknown | null> {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}
