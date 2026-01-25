/**
 * Unit tests for AIAnalysisService
 */

import { AIAnalysisService } from '../AIAnalysisService';
import { generateHighlights } from '@/lib/ai/highlights';

jest.mock('@/lib/ai/highlights', () => ({
  generateHighlights: jest.fn(),
}));

describe('AIAnalysisService', () => {
  let service: AIAnalysisService;

  beforeEach(() => {
    service = new AIAnalysisService();
    jest.clearAllMocks();
  });

  describe('generateHighlights', () => {
    it('should generate highlights from transcript', async () => {
      const mockSuggestions = [
        {
          startSec: 10,
          endSec: 25,
          reason: 'Great hook with strong emotional appeal',
          summary: 'Introduction to viral content',
          viralityScore: 85,
          viralityFactors: {
            hookStrength: 9,
            emotionalPeak: 8,
            storyArc: 7,
            pacing: 8,
            transcriptQuality: 8,
          },
        },
        {
          startSec: 45,
          endSec: 60,
          reason: 'Key insight with actionable takeaway',
          summary: 'Main tip for growth',
          viralityScore: 90,
          viralityFactors: {
            hookStrength: 8,
            emotionalPeak: 9,
            storyArc: 9,
            pacing: 9,
            transcriptQuality: 8,
          },
        },
      ];

      (generateHighlights as jest.Mock).mockResolvedValue(mockSuggestions);

      const result = await service.generateHighlights({
        transcript: 'This is a test transcript...',
        durationSec: 120,
        targetCount: 5,
        model: 'gemini-2.0-flash-exp',
        audience: 'content creators',
        tone: 'energetic',
        brief: 'Focus on actionable tips',
        callToAction: 'Subscribe for more',
      });

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].viralityScore).toBe(85);
      expect(result.suggestions[1].viralityScore).toBe(90);
      expect(result.model).toBe('gemini-2.0-flash-exp');
      expect(result.requestedCount).toBe(5);
      expect(result.receivedCount).toBe(2);

      expect(generateHighlights).toHaveBeenCalledWith({
        transcript: 'This is a test transcript...',
        durationSec: 120,
        target: 5,
        model: 'gemini-2.0-flash-exp',
        audience: 'content creators',
        tone: 'energetic',
        brief: 'Focus on actionable tips',
        callToAction: 'Subscribe for more',
      });
    });

    it('should handle empty suggestions gracefully', async () => {
      (generateHighlights as jest.Mock).mockResolvedValue([]);

      const result = await service.generateHighlights({
        transcript: 'Short transcript',
        durationSec: 30,
        targetCount: 3,
      });

      expect(result.suggestions).toHaveLength(0);
      expect(result.receivedCount).toBe(0);
    });

    it('should use default model when not specified', async () => {
      (generateHighlights as jest.Mock).mockResolvedValue([]);

      const result = await service.generateHighlights({
        transcript: 'Test',
        durationSec: 60,
        targetCount: 3,
      });

      expect(result.model).toBe('auto');
    });
  });

  describe('determineOptimalClipCount', () => {
    it('should return 3 for videos under 10 minutes', () => {
      expect(service.determineOptimalClipCount(300)).toBe(3); // 5 minutes
      expect(service.determineOptimalClipCount(540)).toBe(3); // 9 minutes
    });

    it('should return 6 for videos between 10 and 30 minutes', () => {
      expect(service.determineOptimalClipCount(600)).toBe(6); // 10 minutes
      expect(service.determineOptimalClipCount(1200)).toBe(6); // 20 minutes
      expect(service.determineOptimalClipCount(1800)).toBe(6); // 30 minutes
    });

    it('should return 10 for videos over 30 minutes', () => {
      expect(service.determineOptimalClipCount(1900)).toBe(10); // 31.67 minutes
      expect(service.determineOptimalClipCount(3600)).toBe(10); // 60 minutes
      expect(service.determineOptimalClipCount(7200)).toBe(10); // 120 minutes
    });
  });
});
