/**
 * Unit tests for TranslateTranscriptUseCase
 */

import 'openai/shims/node'; // Add OpenAI shims for Node environment

// Mock OpenAI before imports
jest.mock('@/lib/openai', () => ({
  openAIClient: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { TranslateTranscriptUseCase } from '../TranslateTranscriptUseCase';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { ITranscriptTranslationRepository } from '@/lib/domain/repositories/ITranscriptTranslationRepository';
import { TranslationService } from '@/lib/domain/services/TranslationService';
import { logger } from '@/lib/logger';

describe('TranslateTranscriptUseCase', () => {
  let useCase: TranslateTranscriptUseCase;
  let mockAssetRepo: jest.Mocked<IAssetRepository>;
  let mockProjectRepo: jest.Mocked<IProjectRepository>;
  let mockTranslationRepo: jest.Mocked<ITranscriptTranslationRepository>;
  let mockTranslationService: jest.Mocked<TranslationService>;

  beforeEach(() => {
    // Create mock repositories
    mockAssetRepo = {
      findById: jest.fn(),
      findByProjectId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockProjectRepo = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockTranslationRepo = {
      findByAssetAndLanguage: jest.fn(),
      findByAssetId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockTranslationService = {
      translateText: jest.fn(),
      translateTranscriptSegments: jest.fn(),
      detectLanguage: jest.fn(),
    } as any;

    useCase = new TranslateTranscriptUseCase(
      mockAssetRepo,
      mockProjectRepo,
      mockTranslationRepo,
      mockTranslationService
    );

    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should translate transcript to multiple languages', async () => {
      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: 'This is a test transcript',
        sourceLanguage: 'en',
        path: '/path/to/asset',
        type: 'video' as const,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test Project',
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTranslationRepo.findByAssetAndLanguage.mockResolvedValue(null);
      mockTranslationService.translateText
        .mockResolvedValueOnce('यह एक परीक्षण प्रतिलेख है')
        .mockResolvedValueOnce('இது ஒரு சோதனை பிரதிலிபி');

      mockTranslationRepo.create
        .mockResolvedValueOnce({
          id: 'trans-1',
          assetId: 'asset-1',
          language: 'hi',
          transcript: 'यह एक परीक्षण प्रतिलेख है',
          translatedFrom: 'en',
          translatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'trans-2',
          assetId: 'asset-1',
          language: 'ta',
          transcript: 'இது ஒரு சோதனை பிரதிலிபி',
          translatedFrom: 'en',
          translatedAt: new Date(),
        });

      const result = await useCase.execute({
        assetId: 'asset-1',
        targetLanguages: ['hi', 'ta'],
        userId: 'user-1',
      });

      expect(result.assetId).toBe('asset-1');
      expect(result.translations).toHaveLength(2);
      expect(result.translations[0]).toEqual({
        language: 'hi',
        translationId: 'trans-1',
        status: 'created',
      });
      expect(result.translations[1]).toEqual({
        language: 'ta',
        translationId: 'trans-2',
        status: 'created',
      });
    });

    it('should throw error when asset not found', async () => {
      mockAssetRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          assetId: 'non-existent',
          targetLanguages: ['hi'],
          userId: 'user-1',
        })
      ).rejects.toThrow('Asset not found');
    });

    it('should throw error when user does not own project', async () => {
      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: 'Test',
        path: '/path',
        type: 'video' as const,
        createdAt: '2024-01-01',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'different-user',
        title: 'Test',
        createdAt: '2024-01-01',
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);

      await expect(
        useCase.execute({
          assetId: 'asset-1',
          targetLanguages: ['hi'],
          userId: 'user-1',
        })
      ).rejects.toThrow('Access denied to this asset');
    });

    it('should throw error when asset has no transcript', async () => {
      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: null,
        path: '/path',
        type: 'video' as const,
        createdAt: '2024-01-01',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test',
        createdAt: '2024-01-01',
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);

      await expect(
        useCase.execute({
          assetId: 'asset-1',
          targetLanguages: ['hi'],
          userId: 'user-1',
        })
      ).rejects.toThrow('Asset has no transcript to translate');
    });

    it('should skip source language', async () => {
      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: 'Test',
        sourceLanguage: 'en',
        path: '/path',
        type: 'video' as const,
        createdAt: '2024-01-01',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test',
        createdAt: '2024-01-01',
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTranslationRepo.findByAssetAndLanguage.mockResolvedValue(null);
      mockTranslationService.translateText.mockResolvedValue('Translated');
      mockTranslationRepo.create.mockResolvedValue({
        id: 'trans-1',
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'Translated',
        translatedFrom: 'en',
        translatedAt: new Date(),
      });

      const result = await useCase.execute({
        assetId: 'asset-1',
        targetLanguages: ['en', 'hi'],
        userId: 'user-1',
      });

      expect(result.translations).toHaveLength(1);
      expect(result.translations[0].language).toBe('hi');
    });

    it('should reuse existing translations', async () => {
      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: 'Test',
        path: '/path',
        type: 'video' as const,
        createdAt: '2024-01-01',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test',
        createdAt: '2024-01-01',
      };

      const existingTranslation = {
        id: 'existing-trans',
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'Existing translation',
        translatedFrom: 'en',
        translatedAt: new Date(),
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTranslationRepo.findByAssetAndLanguage.mockResolvedValue(
        existingTranslation
      );

      const result = await useCase.execute({
        assetId: 'asset-1',
        targetLanguages: ['hi'],
        userId: 'user-1',
      });

      expect(result.translations[0]).toEqual({
        language: 'hi',
        translationId: 'existing-trans',
        status: 'existing',
      });
      expect(mockTranslationService.translateText).not.toHaveBeenCalled();
    });

    it('should translate segments when transcript has segments', async () => {
      const mockTranscriptWithSegments = JSON.stringify([
        { id: 1, start: 0, end: 5, text: 'Hello' },
        { id: 2, start: 5, end: 10, text: 'World' },
      ]);

      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: mockTranscriptWithSegments,
        path: '/path',
        type: 'video' as const,
        createdAt: '2024-01-01',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test',
        createdAt: '2024-01-01',
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTranslationRepo.findByAssetAndLanguage.mockResolvedValue(null);

      mockTranslationService.translateTranscriptSegments.mockResolvedValue([
        { id: 1, start: 0, end: 5, text: 'नमस्ते' },
        { id: 2, start: 5, end: 10, text: 'दुनिया' },
      ]);

      mockTranslationRepo.create.mockResolvedValue({
        id: 'trans-1',
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'नमस्ते दुनिया',
        segments: [
          { id: 1, start: 0, end: 5, text: 'नमस्ते' },
          { id: 2, start: 5, end: 10, text: 'दुनिया' },
        ],
        translatedFrom: 'en',
        translatedAt: new Date(),
      });

      const result = await useCase.execute({
        assetId: 'asset-1',
        targetLanguages: ['hi'],
        userId: 'user-1',
      });

      expect(mockTranslationService.translateTranscriptSegments).toHaveBeenCalled();
      expect(mockTranslationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          segments: expect.any(Array),
        })
      );
      expect(result.translations).toHaveLength(1);
    });

    it('should parse transcript with segments property', async () => {
      const mockTranscriptWithSegments = JSON.stringify({
        segments: [
          { id: 1, start: 0, end: 5, text: 'Test' },
        ],
      });

      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: mockTranscriptWithSegments,
        path: '/path',
        type: 'video' as const,
        createdAt: '2024-01-01',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test',
        createdAt: '2024-01-01',
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTranslationRepo.findByAssetAndLanguage.mockResolvedValue(null);

      mockTranslationService.translateTranscriptSegments.mockResolvedValue([
        { id: 1, start: 0, end: 5, text: 'परीक्षण' },
      ]);

      mockTranslationRepo.create.mockResolvedValue({
        id: 'trans-1',
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'परीक्षण',
        translatedFrom: 'en',
        translatedAt: new Date(),
      });

      await useCase.execute({
        assetId: 'asset-1',
        targetLanguages: ['hi'],
        userId: 'user-1',
      });

      expect(mockTranslationService.translateTranscriptSegments).toHaveBeenCalled();
    });

    it('should default to English when sourceLanguage is not set', async () => {
      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: 'Test',
        sourceLanguage: undefined,
        path: '/path',
        type: 'video' as const,
        createdAt: '2024-01-01',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test',
        createdAt: '2024-01-01',
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTranslationRepo.findByAssetAndLanguage.mockResolvedValue(null);
      mockTranslationService.translateText.mockResolvedValue('Translated');
      mockTranslationRepo.create.mockResolvedValue({
        id: 'trans-1',
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'Translated',
        translatedFrom: 'en',
        translatedAt: new Date(),
      });

      await useCase.execute({
        assetId: 'asset-1',
        targetLanguages: ['hi'],
        userId: 'user-1',
      });

      expect(mockTranslationService.translateText).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceLanguage: 'en',
        })
      );
    });

    it('should log translation completion', async () => {
      const mockAsset = {
        id: 'asset-1',
        projectId: 'project-1',
        transcript: 'Test',
        path: '/path',
        type: 'video' as const,
        createdAt: '2024-01-01',
      };

      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test',
        createdAt: '2024-01-01',
      };

      mockAssetRepo.findById.mockResolvedValue(mockAsset);
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTranslationRepo.findByAssetAndLanguage.mockResolvedValue(null);
      mockTranslationService.translateText.mockResolvedValue('Translated');
      mockTranslationRepo.create.mockResolvedValue({
        id: 'trans-1',
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'Translated',
        translatedFrom: 'en',
        translatedAt: new Date(),
      });

      await useCase.execute({
        assetId: 'asset-1',
        targetLanguages: ['hi'],
        userId: 'user-1',
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Transcript translation completed',
        expect.objectContaining({
          assetId: 'asset-1',
          translationCount: 1,
        })
      );
    });
  });
});
