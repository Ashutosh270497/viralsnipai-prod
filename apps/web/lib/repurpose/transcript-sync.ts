export type TranscriptEditRange = {
  startMs: number;
  endMs: number;
};

type NormalizeRangeOptions = {
  minDurationMs?: number;
  mergeGapMs?: number;
};

type NormalizeCaptionTimelineOptions = {
  clipDurationMs: number;
  minDurationMs?: number;
};

type TimedTextSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export function normalizeTranscriptEditRanges(
  ranges: TranscriptEditRange[] | null,
  clipStartMs: number,
  clipEndMs: number,
  options: NormalizeRangeOptions = {}
): TranscriptEditRange[] {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return [];
  }

  const minDurationMs = options.minDurationMs ?? 150;
  const mergeGapMs = options.mergeGapMs ?? 100;

  const sorted = ranges
    .filter((range) => Number.isFinite(range.startMs) && Number.isFinite(range.endMs))
    .map((range) => ({
      startMs: Math.max(clipStartMs, Math.min(range.startMs, clipEndMs)),
      endMs: Math.max(clipStartMs, Math.min(range.endMs, clipEndMs)),
    }))
    .filter((range) => range.endMs - range.startMs >= minDurationMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  if (sorted.length === 0) {
    return [];
  }

  const merged: TranscriptEditRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.startMs <= previous.endMs + mergeGapMs) {
      previous.endMs = Math.max(previous.endMs, range.endMs);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

export function normalizeCaptionTimelineSegments<T extends TimedTextSegment>(
  segments: T[],
  options: NormalizeCaptionTimelineOptions
): Array<T & { startMs: number; endMs: number; text: string }> {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  const clipDurationMs = Math.max(0, Math.round(options.clipDurationMs));
  if (clipDurationMs <= 0) {
    return [];
  }

  const minDurationMs = Math.max(1, Math.round(options.minDurationMs ?? 250));

  const cleaned = segments
    .map((segment) => ({
      ...segment,
      text: String(segment.text ?? "").replace(/\s+/g, " ").trim(),
      startMs: Math.max(0, Math.round(segment.startMs)),
      endMs: Math.max(0, Math.round(segment.endMs)),
    }))
    .filter((segment) => segment.text.length > 0)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  if (cleaned.length === 0) {
    return [];
  }

  const normalized: Array<T & { startMs: number; endMs: number; text: string }> = [];
  let cursor = 0;

  for (const segment of cleaned) {
    const clampedStart = Math.min(segment.startMs, clipDurationMs);
    const clampedEnd = Math.min(segment.endMs, clipDurationMs);

    let startMs = Math.max(cursor, clampedStart);
    if (startMs >= clipDurationMs) {
      continue;
    }

    let endMs = Math.max(startMs + 1, clampedEnd);
    if (endMs - startMs < minDurationMs) {
      endMs = Math.min(clipDurationMs, startMs + minDurationMs);
    }

    if (endMs <= startMs) {
      continue;
    }

    normalized.push({
      ...segment,
      startMs,
      endMs,
    });
    cursor = endMs;
  }

  return normalized;
}
