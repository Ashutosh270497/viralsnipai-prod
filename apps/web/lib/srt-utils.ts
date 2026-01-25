/**
 * SRT (SubRip) Caption Utilities
 *
 * Centralized utilities for parsing, building, and formatting SRT captions.
 * This eliminates duplicate SRT handling code across the codebase.
 *
 * @module srt-utils
 */

/**
 * Caption entry interface used throughout the application
 */
export interface CaptionEntry {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  startTime?: string;  // SRT formatted time (optional)
  endTime?: string;    // SRT formatted time (optional)
}

/**
 * Parse SRT string into caption entries
 *
 * @param srt - SRT formatted string
 * @returns Array of caption entries
 *
 * @example
 * ```typescript
 * const srt = `1
 * 00:00:01,000 --> 00:00:03,000
 * Hello world
 *
 * 2
 * 00:00:04,000 --> 00:00:06,000
 * Second caption`;
 *
 * const entries = srtUtils.parseSRT(srt);
 * // Returns: [{ index: 1, startMs: 1000, endMs: 3000, text: "Hello world" }, ...]
 * ```
 */
export function parseSRT(srt: string): CaptionEntry[] {
  const entries: CaptionEntry[] = [];
  const blocks = srt.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;

    const startMs = parseTime(timeMatch[1]);
    const endMs = parseTime(timeMatch[2]);
    const text = lines.slice(2).join("\n");

    entries.push({
      index,
      startMs,
      endMs,
      text,
      startTime: timeMatch[1],
      endTime: timeMatch[2]
    });
  }

  return entries;
}

/**
 * Build SRT string from caption entries
 *
 * @param entries - Array of caption entries
 * @returns SRT formatted string
 *
 * @example
 * ```typescript
 * const entries = [
 *   { index: 1, startMs: 1000, endMs: 3000, text: "Hello world" }
 * ];
 * const srt = srtUtils.buildSRT(entries);
 * ```
 */
export function buildSRT(entries: CaptionEntry[]): string {
  return entries
    .map((entry) => {
      return `${entry.index}\n${formatSRTTime(entry.startMs)} --> ${formatSRTTime(entry.endMs)}\n${entry.text}\n`;
    })
    .join("\n");
}

/**
 * Parse SRT timestamp to milliseconds
 *
 * @param time - SRT formatted time string (HH:MM:SS,mmm)
 * @returns Milliseconds
 *
 * @example
 * ```typescript
 * parseTime("00:01:23,456") // Returns: 83456
 * ```
 */
export function parseTime(time: string): number {
  const [hours, minutes, secondsAndMs] = time.split(":");
  const [seconds, ms] = secondsAndMs.split(",");
  return (
    parseInt(hours) * 3600000 +
    parseInt(minutes) * 60000 +
    parseInt(seconds) * 1000 +
    parseInt(ms)
  );
}

/**
 * Format milliseconds to SRT timestamp
 *
 * @param ms - Milliseconds
 * @returns SRT formatted time string (HH:MM:SS,mmm)
 *
 * @example
 * ```typescript
 * formatSRTTime(83456) // Returns: "00:01:23,456"
 * ```
 */
export function formatSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

/**
 * Format milliseconds to WebVTT timestamp
 *
 * @param ms - Milliseconds
 * @returns VTT formatted time string (HH:MM:SS.mmm)
 *
 * @example
 * ```typescript
 * formatVTTTime(83456) // Returns: "00:01:23.456"
 * ```
 */
export function formatVTTTime(ms: number): string {
  return formatSRTTime(ms).replace(',', '.');
}

/**
 * Format milliseconds to simple duration (MM:SS)
 *
 * @param ms - Milliseconds
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(83456) // Returns: "01:23"
 * ```
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Validate SRT format
 *
 * @param srt - SRT string to validate
 * @returns True if valid SRT format
 */
export function isValidSRT(srt: string): boolean {
  if (!srt || typeof srt !== 'string') return false;

  const blocks = srt.trim().split(/\n\n+/);
  if (blocks.length === 0) return false;

  // Check first block format
  const firstBlock = blocks[0].split("\n");
  if (firstBlock.length < 3) return false;

  // Check if first line is a number
  if (isNaN(parseInt(firstBlock[0]))) return false;

  // Check if second line has timestamp format
  const timeMatch = firstBlock[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
  if (!timeMatch) return false;

  return true;
}

/**
 * Convert caption entries to VTT format
 *
 * @param entries - Array of caption entries
 * @returns VTT formatted string
 */
export function buildVTT(entries: CaptionEntry[]): string {
  const vttHeader = "WEBVTT\n\n";
  const vttBody = entries
    .map((entry) => {
      return `${entry.index}\n${formatVTTTime(entry.startMs)} --> ${formatVTTTime(entry.endMs)}\n${entry.text}\n`;
    })
    .join("\n");

  return vttHeader + vttBody;
}

/**
 * Convenience object grouping all SRT utilities
 */
export const srtUtils = {
  parseSRT,
  buildSRT,
  buildVTT,
  parseTime,
  formatSRTTime,
  formatVTTTime,
  formatDuration,
  isValidSRT
};
