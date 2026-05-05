import fs from "fs";
import { promisify } from "util";

import { transcribeWithOpenAI } from "@/lib/ai/providers/openai-transcription-provider";

const stat = promisify(fs.stat);

export type TranscriptionSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
  words?: Array<{
    index?: number;
    word: string;
    start: number;
    end: number;
    confidence?: number | null;
  }>;
};

export type TranscriptionResult = {
  text: string;
  segments: TranscriptionSegment[];
};

export async function transcribeFile(filePath: string): Promise<TranscriptionResult> {
  const mode = (process.env.USE_MOCK_TRANSCRIBE ?? "auto").toLowerCase();

  const fileName = filePath.split("/").pop() ?? "asset";
  const stats = await stat(filePath);
  const durationGuess = Math.max(1, Math.round(stats.size / (16000 * 2)));

  if (mode === "true" || mode === "1") {
    return generateMockResult(fileName, durationGuess);
  }

  // V1 provider boundary: transcription/timing precision is OpenAI-only.
  // OpenRouter is intentionally not used here because LLM audio reasoning must
  // not become a source of final clip timestamps.
  const canonical = await transcribeWithOpenAI(filePath);
  return {
    text: canonical.text,
    segments: canonical.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
      speaker: segment.speaker ?? undefined,
      words: segment.words?.map((word) => ({
        word: word.word,
        start: word.start,
        end: word.end,
      })),
    })),
  };

}

export function parseOpenRouterTranscriptionContent(content: string): TranscriptionResult {
  const cleaned = stripJsonFence(content.trim());
  try {
    const parsed = JSON.parse(cleaned) as {
      text?: unknown;
      transcript?: unknown;
      segments?: unknown;
    };
    const text = typeof parsed.text === "string"
      ? parsed.text.trim()
      : typeof parsed.transcript === "string"
        ? parsed.transcript.trim()
        : "";
    const segments = Array.isArray(parsed.segments)
      ? parsed.segments
          .map((segment, index) => normalizeOpenRouterSegment(segment, index))
          .filter((segment): segment is TranscriptionSegment => Boolean(segment))
      : [];

    return {
      text,
      segments
    };
  } catch {
    return {
      text: cleaned,
      segments: []
    };
  }
}

function normalizeOpenRouterSegment(segment: unknown, index: number): TranscriptionSegment | null {
  if (!segment || typeof segment !== "object") {
    return null;
  }

  const record = segment as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  if (!text) {
    return null;
  }

  const start = coerceFiniteNumber(record.start, index * 8);
  const end = Math.max(start + 0.1, coerceFiniteNumber(record.end, start + 8));

  return {
    start,
    end,
    text
  };
}

function coerceFiniteNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function stripJsonFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function isSyntheticTranscriptText(text: string): boolean {
  return /this is synthetic transcript segment \d+/i.test(text.slice(0, 1000));
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
