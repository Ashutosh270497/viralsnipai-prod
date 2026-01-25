/**
 * ViralityScore Value Object
 *
 * Represents a virality score (0-100) with grade classification and utilities.
 * Provides type-safe scoring with business logic encapsulation.
 *
 * @module ViralityScore
 */

export type ViralityGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export class ViralityScore {
  constructor(public readonly value: number) {
    if (value < 0 || value > 100) {
      throw new Error('Virality score must be between 0 and 100');
    }
  }

  /**
   * Get the letter grade for this score
   * S: 90-100 (Exceptional)
   * A: 80-89 (Excellent)
   * B: 70-79 (Good)
   * C: 60-69 (Average)
   * D: 50-59 (Below Average)
   * F: 0-49 (Poor)
   */
  get grade(): ViralityGrade {
    if (this.value >= 90) return 'S';
    if (this.value >= 80) return 'A';
    if (this.value >= 70) return 'B';
    if (this.value >= 60) return 'C';
    if (this.value >= 50) return 'D';
    return 'F';
  }

  /**
   * Get a color representing this score's quality
   * Useful for UI display
   */
  get color(): string {
    switch (this.grade) {
      case 'S':
        return '#FFD700'; // Gold
      case 'A':
        return '#10B981'; // Green
      case 'B':
        return '#3B82F6'; // Blue
      case 'C':
        return '#F59E0B'; // Orange
      case 'D':
        return '#EF4444'; // Red
      case 'F':
        return '#6B7280'; // Gray
    }
  }

  /**
   * Get a descriptive label for this score
   */
  get label(): string {
    switch (this.grade) {
      case 'S':
        return 'Exceptional';
      case 'A':
        return 'Excellent';
      case 'B':
        return 'Good';
      case 'C':
        return 'Average';
      case 'D':
        return 'Below Average';
      case 'F':
        return 'Poor';
    }
  }

  /**
   * Check if this is a high-quality clip (score >= 70)
   */
  isHighQuality(): boolean {
    return this.value >= 70;
  }

  /**
   * Check if this is an exceptional clip (score >= 90)
   */
  isExceptional(): boolean {
    return this.value >= 90;
  }

  /**
   * Check if this score passes a minimum threshold
   * @param threshold - Minimum score required
   */
  meetsThreshold(threshold: number): boolean {
    return this.value >= threshold;
  }

  /**
   * Compare this score to another
   * @param other - Another virality score
   * @returns Positive if this > other, negative if this < other, 0 if equal
   */
  compareTo(other: ViralityScore): number {
    return this.value - other.value;
  }

  /**
   * Check if this score is better than another
   * @param other - Another virality score
   */
  isBetterThan(other: ViralityScore): boolean {
    return this.value > other.value;
  }

  /**
   * Check if two scores are equal
   * @param other - Another virality score
   */
  equals(other: ViralityScore): boolean {
    return this.value === other.value;
  }

  /**
   * Get percentage representation (0-100%)
   */
  get percentage(): string {
    return `${this.value}%`;
  }

  /**
   * Get normalized score (0-1)
   */
  get normalized(): number {
    return this.value / 100;
  }

  /**
   * Create a ViralityScore from a normalized value (0-1)
   * @param normalized - Normalized score (0-1)
   */
  static fromNormalized(normalized: number): ViralityScore {
    if (normalized < 0 || normalized > 1) {
      throw new Error('Normalized score must be between 0 and 1');
    }
    return new ViralityScore(normalized * 100);
  }

  /**
   * Calculate average virality score from multiple scores
   * @param scores - Array of virality scores
   * @returns Average score, or null if array is empty
   */
  static average(scores: ViralityScore[]): ViralityScore | null {
    if (scores.length === 0) return null;

    const sum = scores.reduce((acc, score) => acc + score.value, 0);
    return new ViralityScore(Math.round(sum / scores.length));
  }

  /**
   * Find the maximum score from an array
   * @param scores - Array of virality scores
   * @returns Maximum score, or null if array is empty
   */
  static max(scores: ViralityScore[]): ViralityScore | null {
    if (scores.length === 0) return null;

    return scores.reduce((max, score) => (score.value > max.value ? score : max));
  }

  /**
   * Find the minimum score from an array
   * @param scores - Array of virality scores
   * @returns Minimum score, or null if array is empty
   */
  static min(scores: ViralityScore[]): ViralityScore | null {
    if (scores.length === 0) return null;

    return scores.reduce((min, score) => (score.value < min.value ? score : min));
  }

  /**
   * Convert to plain number
   */
  toNumber(): number {
    return this.value;
  }

  /**
   * Convert to object representation
   */
  toObject(): { value: number; grade: ViralityGrade; label: string } {
    return {
      value: this.value,
      grade: this.grade,
      label: this.label,
    };
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return `ViralityScore(${this.value}/100, Grade: ${this.grade})`;
  }
}
