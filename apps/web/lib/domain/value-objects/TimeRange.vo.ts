/**
 * TimeRange Value Object
 *
 * Represents a time range in milliseconds with validation and utility methods.
 * Ensures time ranges are always valid (start < end, no negative values).
 *
 * @module TimeRange
 */

export class TimeRange {
  constructor(
    public readonly startMs: number,
    public readonly endMs: number
  ) {
    if (startMs < 0) {
      throw new Error('Start time cannot be negative');
    }
    if (endMs <= startMs) {
      throw new Error('End time must be greater than start time');
    }
  }

  /**
   * Get the duration in milliseconds
   */
  get durationMs(): number {
    return this.endMs - this.startMs;
  }

  /**
   * Get the duration in seconds
   */
  get durationSeconds(): number {
    return this.durationMs / 1000;
  }

  /**
   * Get the start time in seconds
   */
  get startSeconds(): number {
    return this.startMs / 1000;
  }

  /**
   * Get the end time in seconds
   */
  get endSeconds(): number {
    return this.endMs / 1000;
  }

  /**
   * Check if this time range overlaps with another
   * @param other - Another time range
   * @returns True if ranges overlap
   */
  overlaps(other: TimeRange): boolean {
    return this.startMs < other.endMs && this.endMs > other.startMs;
  }

  /**
   * Check if this time range completely contains another
   * @param other - Another time range
   * @returns True if this range contains the other
   */
  contains(other: TimeRange): boolean {
    return this.startMs <= other.startMs && this.endMs >= other.endMs;
  }

  /**
   * Check if this time range is contained within another
   * @param other - Another time range
   * @returns True if this range is within the other
   */
  isContainedBy(other: TimeRange): boolean {
    return other.contains(this);
  }

  /**
   * Get the overlap duration with another time range
   * @param other - Another time range
   * @returns Overlap duration in milliseconds, or 0 if no overlap
   */
  getOverlapDuration(other: TimeRange): number {
    if (!this.overlaps(other)) return 0;

    const overlapStart = Math.max(this.startMs, other.startMs);
    const overlapEnd = Math.min(this.endMs, other.endMs);
    return overlapEnd - overlapStart;
  }

  /**
   * Check if a specific time point is within this range
   * @param timeMs - Time in milliseconds
   * @returns True if time is within range
   */
  includesTime(timeMs: number): boolean {
    return timeMs >= this.startMs && timeMs <= this.endMs;
  }

  /**
   * Create a new TimeRange with adjusted start time
   * @param newStartMs - New start time in milliseconds
   * @returns New TimeRange instance
   */
  withStartMs(newStartMs: number): TimeRange {
    return new TimeRange(newStartMs, this.endMs);
  }

  /**
   * Create a new TimeRange with adjusted end time
   * @param newEndMs - New end time in milliseconds
   * @returns New TimeRange instance
   */
  withEndMs(newEndMs: number): TimeRange {
    return new TimeRange(this.startMs, newEndMs);
  }

  /**
   * Create a TimeRange from seconds
   * @param startSec - Start time in seconds
   * @param endSec - End time in seconds
   * @returns TimeRange instance
   */
  static fromSeconds(startSec: number, endSec: number): TimeRange {
    return new TimeRange(startSec * 1000, endSec * 1000);
  }

  /**
   * Create a TimeRange from a start time and duration
   * @param startMs - Start time in milliseconds
   * @param durationMs - Duration in milliseconds
   * @returns TimeRange instance
   */
  static fromDuration(startMs: number, durationMs: number): TimeRange {
    return new TimeRange(startMs, startMs + durationMs);
  }

  /**
   * Check if two time ranges are equal
   * @param other - Another time range
   * @returns True if ranges are equal
   */
  equals(other: TimeRange): boolean {
    return this.startMs === other.startMs && this.endMs === other.endMs;
  }

  /**
   * Convert to a plain object
   */
  toObject(): { startMs: number; endMs: number; durationMs: number } {
    return {
      startMs: this.startMs,
      endMs: this.endMs,
      durationMs: this.durationMs,
    };
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return `TimeRange(${this.startMs}ms - ${this.endMs}ms, duration: ${this.durationMs}ms)`;
  }
}
