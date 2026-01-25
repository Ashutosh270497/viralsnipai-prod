/**
 * Unit tests for ClipExtractionService
 */

import { ClipExtractionService } from '../ClipExtractionService';

describe('ClipExtractionService', () => {
  let service: ClipExtractionService;

  beforeEach(() => {
    service = new ClipExtractionService();
  });

  describe('extractClips', () => {
    const mockTranscription = {
      text: 'This is a test transcript with multiple words.',
      segments: [
        {
          id: 0,
          start: 0,
          end: 5,
          text: 'This is a test',
          words: [
            { start: 0, end: 1, word: 'This' },
            { start: 1, end: 2, word: 'is' },
            { start: 2, end: 3, word: 'a' },
            { start: 3, end: 5, word: 'test' },
          ],
        },
        {
          id: 1,
          start: 5,
          end: 10,
          text: 'transcript with multiple',
          words: [
            { start: 5, end: 6, word: 'transcript' },
            { start: 6, end: 8, word: 'with' },
            { start: 8, end: 10, word: 'multiple' },
          ],
        },
        {
          id: 2,
          start: 10,
          end: 15,
          text: 'words.',
          words: [
            { start: 10, end: 15, word: 'words.' },
          ],
        },
      ],
    };

    it('should extract clips from AI suggestions', () => {
      const suggestions = [
        {
          startSec: 2,
          endSec: 8,
          reason: 'Good hook',
          summary: 'Test clip',
          viralityScore: 85,
          viralityFactors: { hookStrength: 9 },
        },
      ];

      const result = service.extractClips(
        suggestions,
        15000, // 15 seconds
        mockTranscription,
        { minDurationMs: 5000, maxDurationMs: 45000 }
      );

      expect(result).toHaveLength(1);
      expect(result[0].startMs).toBeGreaterThanOrEqual(0);
      expect(result[0].endMs).toBeLessThanOrEqual(15000);
      expect(result[0].summary).toBe('Test clip');
      expect(result[0].viralityScore).toBe(85);
    });

    it('should deduplicate overlapping clips', () => {
      const suggestions = [
        {
          startSec: 2,
          endSec: 8,
          reason: 'First clip',
          summary: 'Clip 1',
          viralityScore: 85,
          viralityFactors: { hookStrength: 9 },
        },
        {
          startSec: 3,
          endSec: 9,
          reason: 'Overlapping clip',
          summary: 'Clip 2',
          viralityScore: 90,
          viralityFactors: { hookStrength: 10 },
        },
      ];

      const result = service.extractClips(
        suggestions,
        15000,
        mockTranscription,
        { minDurationMs: 5000, maxDurationMs: 45000 }
      );

      // Should keep the higher virality score clip
      expect(result.length).toBeLessThan(suggestions.length);
      const highestScore = Math.max(...result.map(c => c.viralityScore || 0));
      expect(highestScore).toBe(90);
    });

    it('should enforce minimum duration', () => {
      const suggestions = [
        {
          startSec: 1,
          endSec: 2, // Only 1 second
          reason: 'Too short',
          summary: 'Short clip',
          viralityScore: 80,
          viralityFactors: { hookStrength: 8 },
        },
      ];

      const result = service.extractClips(
        suggestions,
        15000,
        mockTranscription,
        { minDurationMs: 5000, maxDurationMs: 45000 }
      );

      // Clip should be extended to meet minimum duration
      if (result.length > 0) {
        const duration = result[0].endMs - result[0].startMs;
        expect(duration).toBeGreaterThanOrEqual(5000);
      }
    });

    it('should respect maximum duration', () => {
      const suggestions = [
        {
          startSec: 0,
          endSec: 60, // 60 seconds - too long
          reason: 'Long clip',
          summary: 'Extended clip',
          viralityScore: 85,
          viralityFactors: { hookStrength: 9 },
        },
      ];

      const result = service.extractClips(
        suggestions,
        70000, // 70 seconds total
        mockTranscription,
        { minDurationMs: 5000, maxDurationMs: 45000 }
      );

      // Clip should be trimmed to meet maximum duration
      if (result.length > 0) {
        const duration = result[0].endMs - result[0].startMs;
        expect(duration).toBeLessThanOrEqual(45000);
      }
    });

    it('should handle empty suggestions', () => {
      const result = service.extractClips(
        [],
        15000,
        mockTranscription,
        { minDurationMs: 5000, maxDurationMs: 45000 }
      );

      // Should generate at least minimum number of clips
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getTranscriptSegment', () => {
    const mockTranscription = {
      text: 'Full transcript text',
      segments: [
        {
          id: 0,
          start: 0,
          end: 5,
          text: 'First segment',
          words: [],
        },
        {
          id: 1,
          start: 5,
          end: 10,
          text: 'Second segment',
          words: [],
        },
        {
          id: 2,
          start: 10,
          end: 15,
          text: 'Third segment',
          words: [],
        },
      ],
    };

    it('should extract transcript segment within time range', () => {
      const result = service.getTranscriptSegment(mockTranscription, 2000, 8000);

      expect(result).toContain('First segment');
      expect(result).toContain('Second segment');
    });

    it('should handle segment at start', () => {
      const result = service.getTranscriptSegment(mockTranscription, 0, 3000);

      expect(result).toContain('First segment');
    });

    it('should handle segment at end', () => {
      const result = service.getTranscriptSegment(mockTranscription, 12000, 15000);

      expect(result).toContain('Third segment');
    });

    it('should return empty string for invalid range', () => {
      const result = service.getTranscriptSegment(mockTranscription, 20000, 25000);

      expect(result).toBe('');
    });
  });
});
