import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { promisify } from "util";
import "openai/shims/node";
import { toFile } from "openai";
import ffmpeg from "fluent-ffmpeg";

import { probeDuration, transcodeToMp3 } from "@/lib/ffmpeg";
import { logger } from "@/lib/logger";
import { openAITranscriptionClient } from "@/lib/ai/providers/openai-transcription-client";

const stat = promisify(fs.stat);

const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? process.env.WHISPER_MODEL ?? "whisper-1";
const OPENAI_TRANSCRIBE_TIMEOUT_MS = Number(process.env.OPENAI_TRANSCRIBE_TIMEOUT_MS ?? 180_000);
const OPENAI_TRANSCRIBE_MAX_RETRIES = Number(process.env.OPENAI_TRANSCRIBE_MAX_RETRIES ?? 2);
const OPENAI_MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const DIRECT_AUDIO_BYTES = Number(process.env.TRANSCRIBE_MAX_DIRECT_BYTES ?? OPENAI_MAX_AUDIO_BYTES);
const TRANSCRIBE_CHUNK_SECONDS = Number(process.env.OPENAI_TRANSCRIBE_CHUNK_SECONDS ?? 12 * 60);
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
  if (!openAITranscriptionClient) {
    throw new Error("OPENAI_API_KEY is required for precision transcription.");
  }

  const prepared = await prepareTranscriptionSource(filePath);
  try {
    if (await shouldChunkAudio(prepared.path)) {
      const chunks = await splitAudioForTranscription(prepared.path);
      try {
        logger.info("OpenAI transcription chunking enabled", {
          sourcePath: prepared.path,
          chunkCount: chunks.length,
          chunkDurationsSec: chunks.map((chunk) => Number((chunk.durationSec).toFixed(2))),
        });
        const transcripts: Array<{ transcript: CanonicalTranscript; offsetSec: number }> = [];
        for (const chunk of chunks) {
          const transcript = await transcribeAudioChunk(chunk.path);
          transcripts.push({ transcript, offsetSec: chunk.startSec });
        }
        const merged = mergeChunkTranscripts(transcripts, OPENAI_TRANSCRIBE_MODEL);
        validateTranscriptTimestamps(merged);
        logger.info("OpenAI chunk transcripts merged", {
          chunkCount: chunks.length,
          segmentCount: merged.segments.length,
          precision: merged.precision,
          durationSec: merged.durationSec,
        });
        return merged;
      } finally {
        await Promise.allSettled(chunks.map((chunk) => fsp.unlink(chunk.path)));
      }
    }

    return await transcribeAudioChunk(prepared.path);
  } finally {
    await prepared.cleanup();
  }
}

export async function shouldChunkAudio(filePath: string): Promise<boolean> {
  const stats = await stat(filePath);
  return stats.size > OPENAI_MAX_AUDIO_BYTES;
}

export type AudioTranscriptionChunk = {
  path: string;
  startSec: number;
  durationSec: number;
};

export async function splitAudioForTranscription(filePath: string): Promise<AudioTranscriptionChunk[]> {
  const durationSec = await probeDuration(filePath);
  if (!durationSec || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("Unable to probe audio duration for transcription chunking.");
  }

  const chunkDurationSec = Math.max(60, Math.min(15 * 60, TRANSCRIBE_CHUNK_SECONDS));
  const chunkCount = Math.ceil(durationSec / chunkDurationSec);
  const ext = path.extname(filePath).toLowerCase() || ".mp3";
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ext);
  const chunks: AudioTranscriptionChunk[] = [];

  try {
    for (let index = 0; index < chunkCount; index += 1) {
      const startSec = index * chunkDurationSec;
      const thisDurationSec = Math.min(chunkDurationSec, durationSec - startSec);
      const outputPath = path.join(dir, `${base}-chunk-${index + 1}-${Date.now()}.mp3`);
      await extractAudioChunk({
        inputPath: filePath,
        outputPath,
        startSec,
        durationSec: thisDurationSec,
      });
      const stats = await stat(outputPath);
      if (stats.size > OPENAI_MAX_AUDIO_BYTES) {
        throw new Error(
          `Transcription chunk ${index + 1} is ${(stats.size / (1024 * 1024)).toFixed(1)} MB; ` +
          "reduce OPENAI_TRANSCRIBE_CHUNK_SECONDS or audio bitrate."
        );
      }
      chunks.push({ path: outputPath, startSec, durationSec: thisDurationSec });
    }
    return chunks;
  } catch (error) {
    await Promise.allSettled(chunks.map((chunk) => fsp.unlink(chunk.path)));
    throw error;
  }
}

export async function transcribeAudioChunk(filePath: string): Promise<CanonicalTranscript> {
  let lastError: unknown = null;
  const attempts = Math.max(1, OPENAI_TRANSCRIBE_MAX_RETRIES + 1);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await callOpenAITranscription(filePath);
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

export function offsetTranscriptTimestamps(
  transcript: CanonicalTranscript,
  offsetSec: number,
  segmentIdPrefix = "chunk"
): CanonicalTranscript {
  const segments = transcript.segments.map((segment, segmentIndex) => ({
    ...segment,
    id: `${segmentIdPrefix}-${segmentIndex + 1}-${segment.id}`,
    start: roundSec(segment.start + offsetSec),
    end: roundSec(segment.end + offsetSec),
    words: segment.words?.map((word) => ({
      ...word,
      start: roundSec(word.start + offsetSec),
      end: roundSec(word.end + offsetSec),
    })),
  }));

  return {
    ...transcript,
    durationSec: transcript.durationSec !== null && transcript.durationSec !== undefined
      ? roundSec(transcript.durationSec + offsetSec)
      : null,
    segments,
    precision: getTranscriptPrecision({ segments }),
    warnings: [...transcript.warnings],
  };
}

export function mergeChunkTranscripts(
  chunks: Array<{ transcript: CanonicalTranscript; offsetSec: number }>,
  model: string
): CanonicalTranscript {
  if (chunks.length === 0) {
    throw new Error("Cannot merge zero OpenAI transcription chunks.");
  }

  const shifted = chunks.map((chunk, index) =>
    offsetTranscriptTimestamps(chunk.transcript, chunk.offsetSec, `chunk-${index + 1}`)
  );
  const segments = shifted
    .flatMap((transcript) => transcript.segments)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((segment, segmentIndex) => ({
      ...segment,
      id: `seg-${segmentIndex + 1}`,
      words: segment.words?.map((word, wordIndex) => ({
        ...word,
        index: wordIndex,
      })),
    }));

  let globalWordIndex = 0;
  const reindexedSegments = segments.map((segment) => ({
    ...segment,
    words: segment.words?.map((word) => ({
      ...word,
      index: globalWordIndex++,
    })),
  }));

  const durationSec = reindexedSegments.length > 0
    ? reindexedSegments[reindexedSegments.length - 1].end
    : null;
  const warnings = shifted.flatMap((transcript) => transcript.warnings);
  const precision = getTranscriptPrecision({ segments: reindexedSegments });
  if (precision !== "word") {
    warnings.push("Merged OpenAI transcript does not contain word-level timestamps for every chunk.");
  }

  return {
    text: reindexedSegments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim(),
    language: shifted.find((transcript) => transcript.language)?.language ?? null,
    durationSec,
    segments: reindexedSegments,
    precision,
    provider: "openai",
    model,
    warnings,
    createdAt: new Date().toISOString(),
  };
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

  return openAITranscriptionClient!.audio.transcriptions.create(params as any, {
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

  return {
    path: targetPath,
    cleanup: async () => {
      await fsp.unlink(targetPath).catch(() => null);
    },
  };
}

async function extractAudioChunk({
  inputPath,
  outputPath,
  startSec,
  durationSec,
}: {
  inputPath: string;
  outputPath: string;
  startSec: number;
  durationSec: number;
}) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(startSec)
      .duration(durationSec)
      .outputOptions(["-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k"])
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .save(outputPath);
  });
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

function roundSec(value: number) {
  return Math.round(value * 1000) / 1000;
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
