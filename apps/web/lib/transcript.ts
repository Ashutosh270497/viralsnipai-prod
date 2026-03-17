import fs from "fs";
import { promises as fsp } from "fs";
import { promisify } from "util";
import path from "path";
import type { TranscriptionSegment as AudioTranscriptionSegment } from "openai/resources/audio/transcriptions";

import { openAIClient } from "@/lib/openai";
import { transcodeToMp3 } from "@/lib/ffmpeg";

const stat = promisify(fs.stat);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type TranscriptionSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
};

export type TranscriptionResult = {
  text: string;
  segments: TranscriptionSegment[];
};

const DEFAULT_MODEL = process.env.WHISPER_MODEL ?? "gpt-4o-mini-transcribe";
const MAX_ATTEMPTS = Number(process.env.TRANSCRIBE_MAX_ATTEMPTS ?? 3);
const RETRY_DELAY_BASE_MS = Number(process.env.TRANSCRIBE_RETRY_DELAY_MS ?? 1500);
const MAX_DIRECT_UPLOAD_BYTES = Number(process.env.TRANSCRIBE_MAX_DIRECT_BYTES ?? 24 * 1024 * 1024);
const TIMING_FALLBACK_MODEL = process.env.TRANSCRIBE_TIMING_FALLBACK_MODEL ?? "whisper-1";
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".wav", ".webm", ".ogg", ".oga", ".flac"]);

export async function transcribeFile(filePath: string): Promise<TranscriptionResult> {
  const mode = (process.env.USE_MOCK_TRANSCRIBE ?? "auto").toLowerCase();

  const fileName = filePath.split("/").pop() ?? "asset";
  const stats = await stat(filePath);
  const durationGuess = Math.max(1, Math.round(stats.size / (16000 * 2)));

  if (mode === "true" || mode === "1") {
    return generateMockResult(fileName, durationGuess);
  }

  if (!openAIClient) {
    throw new Error(
      "Live transcription requires OPENAI_API_KEY (and optional WHISPER_MODEL). Set USE_MOCK_TRANSCRIBE=true to use synthetic output."
    );
  }

  const prepared = await prepareTranscriptionSource(filePath);

  try {
    const plans: Array<{ model: string; format: "verbose_json" | "json" }> = [
      { model: DEFAULT_MODEL, format: "verbose_json" },
      ...(TIMING_FALLBACK_MODEL !== DEFAULT_MODEL
        ? [{ model: TIMING_FALLBACK_MODEL, format: "verbose_json" as const }]
        : []),
      { model: DEFAULT_MODEL, format: "json" },
    ];
    let response: any = null;
    let usedFormat: "verbose_json" | "json" = "json";
    let lastError: unknown = null;

    for (const plan of plans) {
      const attemptTranscription = async () => {
        const fileStream = fs.createReadStream(prepared.path);
        try {
          const params: any = {
            file: fileStream,
            model: plan.model,
            response_format: plan.format,
          };

          if (plan.format === "verbose_json") {
            params.timestamp_granularities = ["segment", "word"];
          }

          return await openAIClient!.audio.transcriptions.create(params);
        } finally {
          fileStream.destroy();
        }
      };

      const attempts = Math.max(1, MAX_ATTEMPTS);
      let formatResponse: Awaited<ReturnType<typeof attemptTranscription>> | null = null;
      let formatError: unknown = null;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          formatResponse = await attemptTranscription();
          break;
        } catch (error) {
          formatError = error;
          if (attempt === attempts - 1 || !isRetryableTranscriptionError(error)) {
            break;
          }

          const backoff = RETRY_DELAY_BASE_MS * Math.pow(2, attempt);
          console.warn(
            `Transcription attempt ${attempt + 1} (${plan.model}/${plan.format}) failed (${parseErrorMessage(
              error
            )}). Retrying in ${backoff}ms...`
          );
          await sleep(backoff);
        }
      }

      if (formatResponse) {
        response = formatResponse;
        usedFormat = plan.format;
        break;
      }

      lastError = formatError;
      if (plan.format === "verbose_json" && isUnsupportedVerboseModeError(formatError)) {
        console.warn(
          `[Transcribe] ${plan.model} does not support verbose_json timestamps. Trying next fallback.`
        );
        continue;
      }

      if (formatError) {
        throw formatError;
      }
    }

    if (!response) {
      if (lastError) {
        throw lastError;
      }
      return generateMockResult(fileName, durationGuess);
    }

    if (usedFormat === "verbose_json" && typeof response === "object") {
      const verbose = response as {
        text?: string;
        segments?: AudioTranscriptionSegment[];
        words?: Array<{
          word: string;
          start: number;
          end: number;
        }>;
      };

      const text = (verbose.text ?? "").trim();
      const segments = Array.isArray(verbose.segments)
        ? verbose.segments
            .map((segment, index) => {
              // Extract words for this segment if available
              const segmentWords = verbose.words
                ? verbose.words.filter(
                    (w) => w.start >= (segment.start ?? 0) && w.end <= (segment.end ?? Infinity)
                  )
                : undefined;

              return {
                start: segment.start ?? index * 5,
                end: segment.end ?? segment.start ?? (index + 1) * 5,
                text: segment.text?.trim() ?? "",
                words: segmentWords
              };
            })
            .filter((segment) => segment.text.length > 0)
        : [];

      if (text.length === 0) {
        return generateMockResult(fileName, durationGuess);
      }

      return {
        text,
        segments
      };
    }

    const plainText = (response.text ?? "").trim();
    if (!plainText) {
      return generateMockResult(fileName, durationGuess);
    }
    return {
      text: plainText,
      segments: []
    };
  } catch (error) {
    console.error("Transcription request failed", error);
    if (mode === "auto") {
      console.warn("[Transcribe] Falling back to synthetic transcript.");
      return generateMockResult(fileName, durationGuess);
    }
    const reason = error instanceof Error ? error.message : "Unknown transcription error.";
    throw new Error(`Transcription failed: ${reason}. You can enable mock transcripts with USE_MOCK_TRANSCRIBE=true.`);
  } finally {
    await prepared.cleanup();
  }
}

function isUnsupportedVerboseModeError(error: unknown): boolean {
  const message = parseErrorMessage(error).toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("timestamp_granularities") ||
    message.includes("response_format") ||
    message.includes("verbose_json") ||
    message.includes("not supported")
  );
}

function isRetryableTranscriptionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { status?: number; code?: string | number; message?: string };
  const status = err.status ?? (typeof err.code === "number" ? err.code : undefined);
  const message = parseErrorMessage(error);
  if (status && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  if (message) {
    const lower = message.toLowerCase();
    if (
      lower.includes("timeout") ||
      lower.includes("timed out") ||
      lower.includes("connection") ||
      lower.includes("econnreset") ||
      lower.includes("rate limit")
    ) {
      return true;
    }
  }
  return false;
}

function parseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") {
      return err.message;
    }
    if (typeof err["error"] === "string") {
      return err["error"];
    }
  }
  return "";
}

async function prepareTranscriptionSource(originalPath: string) {
  const originalStats = await stat(originalPath);
  const ext = path.extname(originalPath).toLowerCase();
  const isAudio = AUDIO_EXTENSIONS.has(ext);
  const canStreamOriginal = isAudio && originalStats.size <= MAX_DIRECT_UPLOAD_BYTES;

  if (canStreamOriginal) {
    return {
      path: originalPath,
      cleanup: async () => {}
    };
  }

  const baseName = path.basename(originalPath, ext || undefined);
  const timestamp = Date.now();
  const targetPath = path.join(path.dirname(originalPath), `${baseName}-${timestamp}-transcribe.mp3`);

  try {
    await transcodeToMp3({
      inputPath: originalPath,
      outputPath: targetPath
    });
  } catch (error) {
    console.error("Failed to transcode audio for transcription", error);
    throw new Error(
      "Unable to prepare audio for transcription. Verify FFmpeg is installed and the source media is accessible."
    );
  }

  return {
    path: targetPath,
    cleanup: async () => {
      await fsp.unlink(targetPath).catch(() => null);
    }
  };
}

function generateMockResult(fileName: string, durationSeconds: number): TranscriptionResult {
  const sentenceCount = Math.max(10, Math.round(durationSeconds / 6));
  const sentences = Array.from({ length: sentenceCount }).map(
    (_, index) => `This is synthetic transcript segment ${index + 1} from ${fileName}.`
  );

  const text = sentences.join(" ");
  const segments: TranscriptionSegment[] = sentences.map((sentence, index) => {
    const words = sentence.split(" ");
    const segmentStart = index * 6;
    const wordDuration = 6 / words.length;

    return {
      start: segmentStart,
      end: segmentStart + 6,
      text: sentence,
      speaker: `Speaker ${index % 2 === 0 ? "A" : "B"}`,
      words: words.map((word, wordIndex) => ({
        word,
        start: segmentStart + wordIndex * wordDuration,
        end: segmentStart + (wordIndex + 1) * wordDuration
      }))
    };
  });

  return { text, segments };
}
