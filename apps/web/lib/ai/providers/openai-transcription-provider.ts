import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { promisify } from "util";
import { toFile } from "openai";

import { transcodeToMp3 } from "@/lib/ffmpeg";
import { logger } from "@/lib/logger";
import { openAIClient } from "@/lib/openai";

const stat = promisify(fs.stat);

const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? process.env.WHISPER_MODEL ?? "whisper-1";
const OPENAI_TRANSCRIBE_TIMEOUT_MS = Number(process.env.OPENAI_TRANSCRIBE_TIMEOUT_MS ?? 180_000);
const OPENAI_TRANSCRIBE_MAX_RETRIES = Number(process.env.OPENAI_TRANSCRIBE_MAX_RETRIES ?? 2);
const OPENAI_MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const DIRECT_AUDIO_BYTES = Number(process.env.TRANSCRIBE_MAX_DIRECT_BYTES ?? OPENAI_MAX_AUDIO_BYTES);
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".wav", ".webm", ".ogg", ".oga", ".flac"]);

export type TranscriptPrecision = "word" | "segment" | "diarized_segment" | "approximate" | "none";

export type TranscriptWord = {
  index: number;
  word: string;
  start: number;
  end: number;
  confidence?: number | null;
};

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
  words?: TranscriptWord[];
};

export type CanonicalTranscript = {
  text: string;
  language?: string | null;
  durationSec?: number | null;
  segments: TranscriptSegment[];
  precision: TranscriptPrecision;
  provider: "openai";
  model: string;
  warnings: string[];
  createdAt: string;
};

export async function transcribeWithOpenAI(filePath: string): Promise<CanonicalTranscript> {
  if (!openAIClient) {
    throw new Error("OPENAI_API_KEY is required for precision transcription.");
  }

  const prepared = await prepareTranscriptionSource(filePath);
  try {
    let lastError: unknown = null;
    const attempts = Math.max(1, OPENAI_TRANSCRIBE_MAX_RETRIES + 1);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await callOpenAITranscription(prepared.path);
        const transcript = normalizeOpenAITranscript(response, OPENAI_TRANSCRIBE_MODEL);
        validateTranscriptTimestamps(transcript);
        return transcript;
      } catch (error) {
        lastError = error;
        if (attempt >= attempts - 1 || !isRetryableTranscriptionError(error)) {
          break;
        }
        await sleep(600 * 2 ** attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("OpenAI transcription failed.");
  } finally {
    await prepared.cleanup();
  }
}

export function hasWordLevelTimestamps(transcript: Pick<CanonicalTranscript, "segments">): boolean {
  return transcript.segments.some((segment) =>
    segment.words?.some((word) =>
      Number.isFinite(word.start) &&
      Number.isFinite(word.end) &&
      word.end > word.start
    )
  );
}

export function hasSegmentTimestamps(transcript: Pick<CanonicalTranscript, "segments">): boolean {
  return transcript.segments.some((segment) =>
    Number.isFinite(segment.start) &&
    Number.isFinite(segment.end) &&
    segment.end > segment.start
  );
}

export function getTranscriptPrecision(transcript: Pick<CanonicalTranscript, "segments">): TranscriptPrecision {
  if (hasWordLevelTimestamps(transcript)) return "word";
  if (transcript.segments.some((segment) => segment.speaker && Number.isFinite(segment.start))) {
    return "diarized_segment";
  }
  if (hasSegmentTimestamps(transcript)) return "segment";
  return "none";
}

export function normalizeOpenAITranscript(response: unknown, model: string): CanonicalTranscript {
  const payload = response as {
    text?: string;
    language?: string | null;
    duration?: number | null;
    segments?: Array<{
      id?: number | string;
      start?: number;
      end?: number;
      text?: string;
      speaker?: string | null;
      words?: Array<{ word?: string; start?: number; end?: number; confidence?: number | null }>;
    }>;
    words?: Array<{ word?: string; start?: number; end?: number; confidence?: number | null }>;
  };

  const warnings: string[] = [];
  const fullText = typeof payload.text === "string" ? payload.text.trim() : "";
  const globalWords = normalizeWords(payload.words ?? []);
  const rawSegments = Array.isArray(payload.segments) ? payload.segments : [];

  const segments = rawSegments
    .map((segment, index): TranscriptSegment | null => {
      const text = typeof segment.text === "string" ? segment.text.trim() : "";
      const start = finiteNumber(segment.start);
      const end = finiteNumber(segment.end);
      if (!text && start === null && end === null) return null;

      const segmentWords = Array.isArray(segment.words)
        ? normalizeWords(segment.words)
        : globalWords.filter((word) =>
            start !== null &&
            end !== null &&
            word.end > start - 0.05 &&
            word.start < end + 0.05
          );

      return {
        id: String(segment.id ?? `seg-${index + 1}`),
        start: start ?? segmentWords[0]?.start ?? 0,
        end: end ?? segmentWords[segmentWords.length - 1]?.end ?? segmentWords[0]?.end ?? 0,
        text,
        speaker: typeof segment.speaker === "string" ? segment.speaker : null,
        ...(segmentWords.length > 0 ? { words: segmentWords } : {}),
      };
    })
    .filter((segment): segment is TranscriptSegment => Boolean(segment));

  if (segments.length === 0 && globalWords.length > 0) {
    segments.push({
      id: "seg-1",
      start: globalWords[0].start,
      end: globalWords[globalWords.length - 1].end,
      text: fullText || globalWords.map((word) => word.word).join(" "),
      words: globalWords,
    });
  }

  if (!fullText && segments.length === 0) {
    warnings.push("OpenAI returned no transcript text.");
  }
  if (segments.length === 0) {
    warnings.push("OpenAI returned no timestamped segments.");
  }
  if (!segments.some((segment) => segment.words?.length)) {
    warnings.push("OpenAI returned no word-level timestamps.");
  }

  const transcript: CanonicalTranscript = {
    text: fullText || segments.map((segment) => segment.text).join(" ").trim(),
    language: typeof payload.language === "string" ? payload.language : null,
    durationSec: finiteNumber(payload.duration),
    segments,
    precision: getTranscriptPrecision({ segments }),
    provider: "openai",
    model,
    warnings,
    createdAt: new Date().toISOString(),
  };

  return transcript;
}

export function validateTranscriptTimestamps(transcript: CanonicalTranscript): void {
  if (!transcript.text.trim()) {
    throw new Error("OpenAI transcription returned empty text.");
  }

  const invalidSegment = transcript.segments.find((segment) =>
    !Number.isFinite(segment.start) ||
    !Number.isFinite(segment.end) ||
    segment.end < segment.start
  );
  if (invalidSegment) {
    transcript.warnings.push(`Invalid segment timestamp detected for ${invalidSegment.id}.`);
  }

  for (const segment of transcript.segments) {
    const invalidWord = segment.words?.find((word) =>
      !Number.isFinite(word.start) ||
      !Number.isFinite(word.end) ||
      word.end <= word.start
    );
    if (invalidWord) {
      transcript.warnings.push(`Invalid word timestamp detected near "${invalidWord.word}".`);
      break;
    }
  }
}

async function callOpenAITranscription(filePath: string): Promise<unknown> {
  const fileBuffer = await fsp.readFile(filePath);
  const fileObject = await toFile(fileBuffer, path.basename(filePath), {
    type: mimeForPath(filePath),
  });

  const params: Record<string, unknown> = {
    file: fileObject,
    model: OPENAI_TRANSCRIBE_MODEL,
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
  };

  return openAIClient!.audio.transcriptions.create(params as any, {
    timeout: Number.isFinite(OPENAI_TRANSCRIBE_TIMEOUT_MS) ? OPENAI_TRANSCRIBE_TIMEOUT_MS : 180_000,
  });
}

async function prepareTranscriptionSource(originalPath: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const originalStats = await stat(originalPath);
  const ext = path.extname(originalPath).toLowerCase();
  const isAudio = AUDIO_EXTENSIONS.has(ext);

  if (isAudio && originalStats.size <= DIRECT_AUDIO_BYTES) {
    return { path: originalPath, cleanup: async () => {} };
  }

  const targetPath = path.join(
    path.dirname(originalPath),
    `${path.basename(originalPath, ext || undefined)}-${Date.now()}-openai-transcribe.mp3`
  );

  await transcodeToMp3({ inputPath: originalPath, outputPath: targetPath });

  const transcodedStats = await stat(targetPath);
  if (transcodedStats.size > OPENAI_MAX_AUDIO_BYTES) {
    await fsp.unlink(targetPath).catch(() => null);
    throw new Error(
      `Prepared audio is ${(transcodedStats.size / (1024 * 1024)).toFixed(1)} MB; ` +
      "exceeds OpenAI transcription upload limit. Shorten or chunk the source before transcription."
    );
  }

  return {
    path: targetPath,
    cleanup: async () => {
      await fsp.unlink(targetPath).catch(() => null);
    },
  };
}

function normalizeWords(words: Array<{ word?: string; start?: number; end?: number; confidence?: number | null }>): TranscriptWord[] {
  return words
    .map((word, index): TranscriptWord | null => {
      const text = typeof word.word === "string" ? word.word.trim() : "";
      const start = finiteNumber(word.start);
      const end = finiteNumber(word.end);
      if (!text || start === null || end === null || end <= start) return null;
      return {
        index,
        word: text,
        start,
        end,
        confidence: typeof word.confidence === "number" ? word.confidence : null,
      };
    })
    .filter((word): word is TranscriptWord => Boolean(word));
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mimeForPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".mp4" || ext === ".m4a") return "audio/mp4";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".webm") return "audio/webm";
  return "audio/mpeg";
}

function isRetryableTranscriptionError(error: unknown) {
  const err = error as { status?: number; message?: string; code?: string | number } | null;
  if (err?.status && [408, 409, 425, 429, 500, 502, 503, 504].includes(err.status)) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("timeout") || message.includes("econnreset") || message.includes("rate limit");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function logTranscriptPrecision(transcript: CanonicalTranscript) {
  logger.info("OpenAI transcription precision", {
    model: transcript.model,
    precision: transcript.precision,
    segmentCount: transcript.segments.length,
    hasWords: hasWordLevelTimestamps(transcript),
    warnings: transcript.warnings,
  });
}
