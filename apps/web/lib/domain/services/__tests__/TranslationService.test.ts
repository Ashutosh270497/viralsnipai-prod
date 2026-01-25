/**
 * Unit tests for TranslationService
 */

import 'openai/shims/node'; // Add OpenAI shims for Node environment

import { TranslationService } from '../TranslationService';
import { openAIClient } from '@/lib/openai';
import { logger } from '@/lib/logger';

// Mock dependencies
jest.mock('@/lib/openai', () => ({
  openAIClient: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    service = new TranslationService();
    jest.clearAllMocks();
  });

  describe('translateText', () => {
    it('should translate text to target language', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'यह एक परीक्षण है',
            },
          },
        ],
      };

      (openAIClient.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const result = await service.translateText({
        text: 'This is a test',
        targetLanguage: 'hi',
        sourceLanguage: 'en',
      });

      expect(result).toBe('यह एक परीक्षण है');
      expect(openAIClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('English text to Hindi'),
          },
          { role: 'user', content: 'This is a test' },
        ],
        temperature: 0.3,
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Translating text',
        expect.any(Object)
      );
    });

    it('should include context in system prompt when provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Translated text' } }],
      };

      (openAIClient.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse
      );

      await service.translateText({
        text: 'Hello',
        targetLanguage: 'hi',
        context: 'video transcript',
      });

      expect(openAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Context: This is video transcript'),
            }),
          ]),
        })
      );
    });

    it('should throw error when text is empty', async () => {
      await expect(
        service.translateText({
          text: '',
          targetLanguage: 'hi',
        })
      ).rejects.toThrow('Text to translate cannot be empty');

      expect(openAIClient.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should throw error when OpenAI client is not configured', async () => {
      // Temporarily replace the module mock to simulate null client
      jest.resetModules();
      jest.doMock('@/lib/openai', () => ({
        openAIClient: null,
      }));

      // Re-import service with null client
      const { TranslationService: TestService } = await import(
        '../TranslationService'
      );
      const testService = new TestService();

      await expect(
        testService.translateText({
          text: 'Test',
          targetLanguage: 'hi',
        })
      ).rejects.toThrow('OpenAI client not configured');

      // Restore mocks
      jest.resetModules();
    });

    it('should throw error when OpenAI returns empty translation', async () => {
      const mockResponse = {
        choices: [{ message: { content: null } }],
      };

      (openAIClient.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse
      );

      await expect(
        service.translateText({
          text: 'Test',
          targetLanguage: 'hi',
        })
      ).rejects.toThrow('Translation failed');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API rate limit exceeded');
      (openAIClient.chat.completions.create as jest.Mock).mockRejectedValue(
        apiError
      );

      await expect(
        service.translateText({
          text: 'Test',
          targetLanguage: 'hi',
        })
      ).rejects.toThrow('Translation failed: API rate limit exceeded');

      expect(logger.error).toHaveBeenCalledWith(
        'Translation failed',
        expect.any(Object)
      );
    });
  });

  describe('translateTranscriptSegments', () => {
    it('should translate all segments in parallel', async () => {
      const mockSegments = [
        { id: 1, start: 0, end: 5, text: 'Hello world' },
        { id: 2, start: 5, end: 10, text: 'This is a test' },
      ];

      const mockResponse1 = {
        choices: [{ message: { content: 'नमस्ते दुनिया' } }],
      };
      const mockResponse2 = {
        choices: [{ message: { content: 'यह एक परीक्षण है' } }],
      };

      (openAIClient.chat.completions.create as jest.Mock)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await service.translateTranscriptSegments(
        mockSegments,
        'hi',
        'en'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        start: 0,
        end: 5,
        text: 'नमस्ते दुनिया',
      });
      expect(result[1]).toEqual({
        id: 2,
        start: 5,
        end: 10,
        text: 'यह एक परीक्षण है',
      });
      expect(openAIClient.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when segments are empty', async () => {
      const result = await service.translateTranscriptSegments([], 'hi', 'en');

      expect(result).toEqual([]);
      expect(openAIClient.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should preserve timing information', async () => {
      const mockSegments = [
        { id: 1, start: 10.5, end: 25.3, text: 'Test segment' },
      ];

      const mockResponse = {
        choices: [{ message: { content: 'परीक्षण खंड' } }],
      };

      (openAIClient.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const result = await service.translateTranscriptSegments(
        mockSegments,
        'hi',
        'en'
      );

      expect(result[0].start).toBe(10.5);
      expect(result[0].end).toBe(25.3);
    });

    it('should log segment count and total words', async () => {
      const mockSegments = [
        { id: 1, start: 0, end: 5, text: 'Hello world test' },
        { id: 2, start: 5, end: 10, text: 'Another segment here' },
      ];

      const mockResponse = {
        choices: [{ message: { content: 'Translated' } }],
      };

      (openAIClient.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse
      );

      await service.translateTranscriptSegments(mockSegments, 'hi', 'en');

      expect(logger.info).toHaveBeenCalledWith(
        'Translating transcript segments',
        expect.objectContaining({
          segmentCount: 2,
          totalWords: 6,
        })
      );
    });
  });

  describe('detectLanguage', () => {
    it('should detect language of given text', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'hi' } }],
      };

      (openAIClient.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const result = await service.detectLanguage('नमस्ते दुनिया');

      expect(result).toBe('hi');
      expect(openAIClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('ISO 639-1 language code'),
          },
          { role: 'user', content: 'नमस्ते दुनिया' },
        ],
        temperature: 0,
        max_tokens: 5,
      });
    });

    it('should return "en" as default when client not configured', async () => {
      // Temporarily replace the module mock to simulate null client
      jest.resetModules();
      jest.doMock('@/lib/openai', () => ({
        openAIClient: null,
      }));

      // Re-import service with null client
      const { TranslationService: TestService } = await import(
        '../TranslationService'
      );
      const testService = new TestService();

      const result = await testService.detectLanguage('Test text');

      expect(result).toBe('en');

      // Restore mocks
      jest.resetModules();
    });

    it('should return "en" as default when detection fails', async () => {
      (openAIClient.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API error')
      );

      const result = await service.detectLanguage('Test text');

      expect(result).toBe('en');
      expect(logger.warn).toHaveBeenCalledWith(
        'Language detection failed, defaulting to English',
        expect.any(Object)
      );
    });

    it('should trim and lowercase the detected language code', async () => {
      const mockResponse = {
        choices: [{ message: { content: '  HI  ' } }],
      };

      (openAIClient.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const result = await service.detectLanguage('Test');

      expect(result).toBe('hi');
    });

    it('should only send first 500 characters for detection', async () => {
      const longText = 'a'.repeat(1000);
      const mockResponse = {
        choices: [{ message: { content: 'en' } }],
      };

      (openAIClient.chat.completions.create as jest.Mock).mockResolvedValue(
        mockResponse
      );

      await service.detectLanguage(longText);

      expect(openAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: 'a'.repeat(500),
            }),
          ]),
        })
      );
    });
  });

  describe('buildTranslationPrompt', () => {
    it('should build prompt with language names', () => {
      const prompt = (service as any).buildTranslationPrompt('en', 'hi');

      expect(prompt).toContain('English text to Hindi');
      expect(prompt).toContain('natural Hindi');
    });

    it('should include context when provided', () => {
      const prompt = (service as any).buildTranslationPrompt(
        'en',
        'hi',
        'video transcript'
      );

      expect(prompt).toContain('Context: This is video transcript');
    });

    it('should handle unknown language codes', () => {
      const prompt = (service as any).buildTranslationPrompt('xx', 'yy');

      expect(prompt).toContain('xx text to yy');
    });
  });
});
