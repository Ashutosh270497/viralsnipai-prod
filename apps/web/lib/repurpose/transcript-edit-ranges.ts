export type TranscriptEditRange = {
  startMs: number;
  endMs: number;
};

/**
 * Resolve persisted transcript edit keep-ranges from clip metadata.
 * Ranges are clamped to clip boundaries, deduplicated, and gap-merged.
 */
export function resolveTranscriptEditRanges(
  viralityFactors: unknown,
  clipStartMs: number,
  clipEndMs: number
): TranscriptEditRange[] {
  if (!viralityFactors || typeof viralityFactors !== "object") {
    return [];
  }

  const metadata = (viralityFactors as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const rawRanges = (metadata as { transcriptEditRangesMs?: unknown }).transcriptEditRangesMs;
  if (!Array.isArray(rawRanges) || rawRanges.length === 0) {
    return [];
  }

  const MIN_RANGE_MS = 150;
  const sorted = rawRanges
    .map((range) => {
      if (!range || typeof range !== "object") {
        return null;
      }

      const startMs = Number((range as { startMs?: unknown }).startMs);
      const endMs = Number((range as { endMs?: unknown }).endMs);

      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        return null;
      }

      const clampedStart = Math.max(clipStartMs, Math.min(startMs, clipEndMs));
      const clampedEnd = Math.max(clipStartMs, Math.min(endMs, clipEndMs));

      if (clampedEnd - clampedStart < MIN_RANGE_MS) {
        return null;
      }

      return { startMs: clampedStart, endMs: clampedEnd };
    })
    .filter((range): range is TranscriptEditRange => range !== null)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  if (sorted.length === 0) {
    return [];
  }

  const merged: TranscriptEditRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.startMs <= previous.endMs + 100) {
      previous.endMs = Math.max(previous.endMs, range.endMs);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}
