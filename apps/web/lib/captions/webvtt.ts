/**
 * WebVTT caption generation.
 *
 * Generates clip-relative WebVTT strings from parsed SRT/caption entries
 * for use in HTML <track> elements.
 *
 * All timestamps are treated as clip-relative milliseconds (0-based).
 * If your entries use source-absolute timestamps, subtract clipStartMs
 * before passing them here.
 */

import type { CaptionEntry } from '@/lib/srt-utils';

/** Format milliseconds → WebVTT timestamp string `HH:MM:SS.mmm`. */
export function formatVttTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1_000);
  const milli = total % 1_000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

/** Escape characters that are unsafe inside WebVTT cue payload text. */
function escapeVttText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Wrap a single caption text into multiple lines, each ≤ `maxChars` wide.
 * Preserves word boundaries and caps output at 2 lines for short-form video.
 */
function wrapCueLine(text: string, maxChars: number): string {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  // Cap at 2 lines — short-form video captions should be concise.
  return lines.slice(0, 2).join('\n');
}

/**
 * Build a valid WebVTT string from caption entries.
 *
 * @param entries     Caption entries (clip-relative milliseconds).
 * @param maxLineChars Max characters per line before line-wrapping (default 42).
 */
export function buildWebVTT(entries: CaptionEntry[], maxLineChars = 42): string {
  const valid = entries.filter(
    (e) => e.endMs > e.startMs && e.text.trim().length > 0
  );

  if (valid.length === 0) return 'WEBVTT\n';

  const cues = valid
    .map((e, i) => {
      const start = formatVttTimestamp(e.startMs);
      const end = formatVttTimestamp(e.endMs);
      const body = wrapCueLine(escapeVttText(e.text.trim()), maxLineChars);
      return `${i + 1}\n${start} --> ${end}\n${body}`;
    })
    .join('\n\n');

  return `WEBVTT\n\n${cues}`;
}

/**
 * Build a WebVTT string from a raw SRT string, converting timestamps.
 * Useful when you only have the SRT but need a VTT blob.
 */
export function srtToWebVTT(srt: string): string {
  if (!srt?.trim()) return 'WEBVTT\n';
  // SRT uses commas for milliseconds; VTT uses periods.
  const vttBody = srt.trim().replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${vttBody}`;
}

export interface VttBlobHandle {
  url: string;
  revoke: () => void;
}

/**
 * Create a Blob URL from caption entries, ready for `<track src={url}>`.
 *
 * Call `revoke()` when the track is no longer needed to free memory.
 * Returns `null` when there are no valid entries.
 */
export function createVttBlobUrl(entries: CaptionEntry[]): VttBlobHandle | null {
  const valid = entries.filter(
    (e) => e.endMs > e.startMs && e.text.trim().length > 0
  );
  if (valid.length === 0) return null;

  const vtt = buildWebVTT(valid);
  const blob = new Blob([vtt], { type: 'text/vtt' });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

/**
 * Create a Blob URL directly from an SRT string.
 * Returns `null` when the SRT is empty.
 */
export function createVttBlobUrlFromSrt(srt: string | null | undefined): VttBlobHandle | null {
  if (!srt?.trim()) return null;
  const vtt = srtToWebVTT(srt);
  const blob = new Blob([vtt], { type: 'text/vtt' });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
