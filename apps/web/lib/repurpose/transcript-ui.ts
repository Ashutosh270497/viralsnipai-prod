export type TranscriptPrecision = "word" | "segment" | "diarized_segment" | "approximate" | "none";

export type TranscriptUiWord = {
  index: number;
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number | null;
  segmentId?: string;
};

export type TranscriptUiSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string | null;
  words: TranscriptUiWord[];
};

export type ParsedTranscriptForUi = {
  text: string;
  language?: string | null;
  durationSec?: number | null;
  precision: TranscriptPrecision;
  provider?: string | null;
  model?: string | null;
  warnings: string[];
  segments: TranscriptUiSegment[];
  words: TranscriptUiWord[];
  isLegacy: boolean;
};

export type TranscriptSearchResult = {
  id: string;
  startMs: number | null;
  endMs: number | null;
  text: string;
  matchText: string;
  wordStartIndex?: number;
  wordEndIndex?: number;
  segmentId?: string;
};

export type FillerWordMatch = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  wordStartIndex: number;
  wordEndIndex: number;
};

export type LongPauseMatch = {
  id: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  beforeWordIndex: number;
  afterWordIndex: number;
};

const FILLER_PHRASES = [
  ["you", "know"],
  ["i", "mean"],
  ["um"],
  ["uh"],
  ["like"],
  ["basically"],
  ["actually"],
  ["literally"],
];

export function parseCanonicalTranscript(input?: string | null): ParsedTranscriptForUi {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return emptyTranscript("none");
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const segments = normalizeSegments(parsed.segments);
    const text =
      typeof parsed.text === "string" && parsed.text.trim()
        ? parsed.text.trim()
        : segments.map((segment) => segment.text).join(" ").trim();
    const precision = readExplicitPrecision(parsed.precision) ?? inferPrecisionFromSegments(segments);

    return {
      text,
      language: typeof parsed.language === "string" ? parsed.language : null,
      durationSec: toFiniteNumber(parsed.durationSec, null),
      precision,
      provider: typeof parsed.provider === "string" ? parsed.provider : null,
      model: typeof parsed.model === "string" ? parsed.model : null,
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((warning): warning is string => typeof warning === "string")
        : [],
      segments,
      words: segments.flatMap((segment) => segment.words),
      isLegacy: false,
    };
  } catch {
    return {
      ...emptyTranscript("none"),
      text: raw,
      segments: [
        {
          id: "legacy-0",
          startMs: 0,
          endMs: 0,
          text: raw,
          words: [],
        },
      ],
      isLegacy: true,
      warnings: ["Legacy plain-text transcript has no timing metadata."],
    };
  }
}

export function getClipWords(
  transcript: ParsedTranscriptForUi,
  clipStartMs: number,
  clipEndMs: number,
): TranscriptUiWord[] {
  return transcript.words.filter((word) => word.endMs > clipStartMs && word.startMs < clipEndMs);
}

export function getClipSegments(
  transcript: ParsedTranscriptForUi,
  clipStartMs: number,
  clipEndMs: number,
): TranscriptUiSegment[] {
  return transcript.segments.filter(
    (segment) => segment.endMs === 0 || (segment.endMs > clipStartMs && segment.startMs < clipEndMs),
  );
}

export function getWordAtTime(
  transcript: ParsedTranscriptForUi,
  timeMs: number,
): TranscriptUiWord | null {
  return transcript.words.find((word) => timeMs >= word.startMs && timeMs < word.endMs) ?? null;
}

export function getWordsBetween(
  transcript: ParsedTranscriptForUi,
  startWordIndex: number,
  endWordIndex: number,
): TranscriptUiWord[] {
  const min = Math.min(startWordIndex, endWordIndex);
  const max = Math.max(startWordIndex, endWordIndex);
  return transcript.words.filter((word) => word.index >= min && word.index <= max);
}

export function getTranscriptPrecision(input?: string | null | Record<string, unknown>): TranscriptPrecision {
  if (typeof input === "string" || input == null) {
    return parseCanonicalTranscript(input).precision;
  }
  const explicit = readExplicitPrecision(input.precision);
  if (explicit) return explicit;
  const segments = normalizeSegments(input.segments);
  return inferPrecisionFromSegments(segments);
}

export function searchTranscript(
  transcript: ParsedTranscriptForUi,
  query: string,
  options: { limit?: number; contextWords?: number } = {},
): TranscriptSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const limit = Math.max(1, options.limit ?? 20);
  const contextWords = Math.max(0, options.contextWords ?? 8);

  if (transcript.words.length > 0) {
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);
    const normalizedWords = transcript.words.map((word) => normalizeSearchText(word.word));
    const results: TranscriptSearchResult[] = [];

    for (let index = 0; index <= normalizedWords.length - queryTokens.length; index += 1) {
      const matches = queryTokens.every((token, offset) => normalizedWords[index + offset] === token);
      if (!matches) {
        continue;
      }
      const start = Math.max(0, index - contextWords);
      const end = Math.min(transcript.words.length - 1, index + queryTokens.length - 1 + contextWords);
      const matchedWords = transcript.words.slice(index, index + queryTokens.length);
      const context = transcript.words.slice(start, end + 1);
      results.push({
        id: `word-${index}`,
        startMs: matchedWords[0]?.startMs ?? null,
        endMs: matchedWords[matchedWords.length - 1]?.endMs ?? null,
        text: context.map((word) => word.word).join(" "),
        matchText: matchedWords.map((word) => word.word).join(" "),
        wordStartIndex: matchedWords[0]?.index,
        wordEndIndex: matchedWords[matchedWords.length - 1]?.index,
        segmentId: matchedWords[0]?.segmentId,
      });
      if (results.length >= limit) {
        return results;
      }
    }
    return results;
  }

  return transcript.segments
    .filter((segment) => normalizeSearchText(segment.text).includes(normalizedQuery))
    .slice(0, limit)
    .map((segment) => ({
      id: segment.id,
      startMs: segment.endMs > segment.startMs ? segment.startMs : null,
      endMs: segment.endMs > segment.startMs ? segment.endMs : null,
      text: segment.text,
      matchText: query,
      segmentId: segment.id,
    }));
}

export function detectFillerWords(transcript: ParsedTranscriptForUi): FillerWordMatch[] {
  const words = transcript.words;
  const normalizedWords = words.map((word) => normalizeSearchText(word.word));
  const matches: FillerWordMatch[] = [];

  for (let index = 0; index < words.length; index += 1) {
    for (const phrase of FILLER_PHRASES) {
      const isMatch = phrase.every((token, offset) => normalizedWords[index + offset] === token);
      if (!isMatch) {
        continue;
      }
      const first = words[index];
      const last = words[index + phrase.length - 1];
      if (!first || !last || last.endMs <= first.startMs) {
        continue;
      }
      matches.push({
        id: `filler-${index}-${phrase.join("-")}`,
        startMs: first.startMs,
        endMs: last.endMs,
        text: words.slice(index, index + phrase.length).map((word) => word.word).join(" "),
        wordStartIndex: first.index,
        wordEndIndex: last.index,
      });
      index += phrase.length - 1;
      break;
    }
  }

  return matches;
}

export function detectLongPauses(
  transcript: ParsedTranscriptForUi,
  thresholdMs = 900,
): LongPauseMatch[] {
  const words = transcript.words;
  const pauses: LongPauseMatch[] = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    const current = words[index];
    const next = words[index + 1];
    const gapMs = next.startMs - current.endMs;
    if (gapMs >= thresholdMs) {
      pauses.push({
        id: `pause-${index}`,
        startMs: current.endMs,
        endMs: next.startMs,
        durationMs: gapMs,
        beforeWordIndex: current.index,
        afterWordIndex: next.index,
      });
    }
  }
  return pauses;
}

function emptyTranscript(precision: TranscriptPrecision): ParsedTranscriptForUi {
  return {
    text: "",
    precision,
    warnings: [],
    segments: [],
    words: [],
    isLegacy: false,
  };
}

function readExplicitPrecision(value: unknown): TranscriptPrecision | null {
  if (
    value === "word" ||
    value === "segment" ||
    value === "diarized_segment" ||
    value === "approximate" ||
    value === "none"
  ) {
    return value;
  }
  return null;
}

function inferPrecisionFromSegments(segments: TranscriptUiSegment[]): TranscriptPrecision {
  if (segments.some((segment) => segment.words.length > 0)) {
    return "word";
  }
  if (segments.some((segment) => segment.endMs > segment.startMs)) {
    return "segment";
  }
  return "none";
}

function normalizeSegments(input: unknown): TranscriptUiSegment[] {
  if (!Array.isArray(input)) {
    return [];
  }

  let nextWordIndex = 0;
  const segments = input.map((segment, segmentIndex): TranscriptUiSegment | null => {
      if (!segment || typeof segment !== "object") {
        return null;
      }
      const record = segment as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.replace(/\s+/g, " ").trim() : "";
      const startMs = secondsToMs(record.start);
      const endMs = secondsToMs(record.end);
      const id = typeof record.id === "string" ? record.id : `segment-${segmentIndex}`;
      const words = normalizeWords(record.words, id, () => nextWordIndex++);
      if (!text && words.length === 0) {
        return null;
      }
      return {
        id,
        startMs,
        endMs: Math.max(startMs, endMs),
        text: text || words.map((word) => word.word).join(" "),
        speaker: typeof record.speaker === "string" ? record.speaker : null,
        words,
      };
    });

  return segments.filter((segment): segment is TranscriptUiSegment => segment !== null);
}

function normalizeWords(
  input: unknown,
  segmentId: string,
  nextIndex: () => number,
): TranscriptUiWord[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const words = input.map((word): TranscriptUiWord | null => {
      if (!word || typeof word !== "object") {
        return null;
      }
      const record = word as Record<string, unknown>;
      const text = typeof record.word === "string" ? record.word.trim() : "";
      const startMs = secondsToMs(record.start);
      const endMs = secondsToMs(record.end);
      if (!text || endMs <= startMs) {
        return null;
      }
      const explicitIndex = toFiniteNumber(record.index, null);
      return {
        index: explicitIndex === null ? nextIndex() : Math.round(explicitIndex),
        word: text,
        startMs,
        endMs,
        confidence: toFiniteNumber(record.confidence, null),
        segmentId,
      };
    });

  return words
    .filter((word): word is TranscriptUiWord => word !== null)
    .sort((a, b) => a.index - b.index || a.startMs - b.startMs);
}

function secondsToMs(value: unknown): number {
  const number = toFiniteNumber(value, 0) ?? 0;
  return Math.max(0, Math.round(number * 1000));
}

function toFiniteNumber<TFallback extends number | null>(
  value: unknown,
  fallback: TFallback,
): number | TFallback {
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

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
