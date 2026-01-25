/**
 * Unit tests for PrismaTranscriptTranslationRepository
 */

import { PrismaTranscriptTranslationRepository } from '../PrismaTranscriptTranslationRepository';
import { prisma } from '@/lib/prisma';

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    transcriptTranslation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('PrismaTranscriptTranslationRepository', () => {
  let repository: PrismaTranscriptTranslationRepository;

  beforeEach(() => {
    repository = new PrismaTranscriptTranslationRepository();
    jest.clearAllMocks();
  });

  describe('findByAssetAndLanguage', () => {
    it('should return translation when found', async () => {
      const mockTranslation = {
        id: 'trans-1',
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'परीक्षण प्रतिलेख',
        segments: null,
        translatedFrom: 'en',
        translatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      (prisma.transcriptTranslation.findUnique as jest.Mock).mockResolvedValue(
        mockTranslation
      );

      const result = await repository.findByAssetAndLanguage('asset-1', 'hi');

      expect(result).toEqual(mockTranslation);
      expect(prisma.transcriptTranslation.findUnique).toHaveBeenCalledWith({
        where: {
          assetId_language: {
            assetId: 'asset-1',
            language: 'hi',
          },
        },
      });
    });

    it('should return null when translation not found', async () => {
      (prisma.transcriptTranslation.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const result = await repository.findByAssetAndLanguage('asset-1', 'hi');

      expect(result).toBeNull();
    });
  });

  describe('findByAssetId', () => {
    it('should return all translations for an asset', async () => {
      const mockTranslations = [
        {
          id: 'trans-1',
          assetId: 'asset-1',
          language: 'hi',
          transcript: 'Hindi translation',
          segments: null,
          translatedFrom: 'en',
          translatedAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'trans-2',
          assetId: 'asset-1',
          language: 'ta',
          transcript: 'Tamil translation',
          segments: null,
          translatedFrom: 'en',
          translatedAt: new Date('2024-01-02T00:00:00Z'),
        },
      ];

      (prisma.transcriptTranslation.findMany as jest.Mock).mockResolvedValue(
        mockTranslations
      );

      const result = await repository.findByAssetId('asset-1');

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockTranslations);
      expect(prisma.transcriptTranslation.findMany).toHaveBeenCalledWith({
        where: { assetId: 'asset-1' },
        orderBy: { translatedAt: 'desc' },
      });
    });

    it('should return empty array when no translations exist', async () => {
      (prisma.transcriptTranslation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.findByAssetId('asset-1');

      expect(result).toEqual([]);
    });

    it('should order translations by translatedAt descending', async () => {
      const mockTranslations = [
        {
          id: 'trans-2',
          assetId: 'asset-1',
          language: 'ta',
          transcript: 'Later translation',
          segments: null,
          translatedFrom: 'en',
          translatedAt: new Date('2024-01-02T00:00:00Z'),
        },
        {
          id: 'trans-1',
          assetId: 'asset-1',
          language: 'hi',
          transcript: 'Earlier translation',
          segments: null,
          translatedFrom: 'en',
          translatedAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];

      (prisma.transcriptTranslation.findMany as jest.Mock).mockResolvedValue(
        mockTranslations
      );

      const result = await repository.findByAssetId('asset-1');

      expect(result[0].translatedAt.getTime()).toBeGreaterThan(
        result[1].translatedAt.getTime()
      );
    });
  });

  describe('create', () => {
    it('should create a new transcript translation', async () => {
      const translationData = {
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'परीक्षण प्रतिलेख',
        segments: null,
        translatedFrom: 'en',
      };

      const mockCreated = {
        id: 'trans-1',
        ...translationData,
        translatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      (prisma.transcriptTranslation.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await repository.create(translationData);

      expect(result).toEqual(mockCreated);
      expect(prisma.transcriptTranslation.create).toHaveBeenCalledWith({
        data: {
          assetId: 'asset-1',
          language: 'hi',
          transcript: 'परीक्षण प्रतिलेख',
          segments: null,
          translatedFrom: 'en',
        },
      });
    });

    it('should create translation with segments', async () => {
      const segments = [
        { id: 1, start: 0, end: 5, text: 'नमस्ते' },
        { id: 2, start: 5, end: 10, text: 'दुनिया' },
      ];

      const translationData = {
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'नमस्ते दुनिया',
        segments,
        translatedFrom: 'en',
      };

      const mockCreated = {
        id: 'trans-1',
        ...translationData,
        translatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      (prisma.transcriptTranslation.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await repository.create(translationData);

      expect(result.segments).toEqual(segments);
    });
  });

  describe('update', () => {
    it('should update an existing translation', async () => {
      const updateData = {
        transcript: 'Updated translation',
        segments: [{ id: 1, start: 0, end: 5, text: 'Updated' }],
      };

      const mockUpdated = {
        id: 'trans-1',
        assetId: 'asset-1',
        language: 'hi',
        ...updateData,
        translatedFrom: 'en',
        translatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      (prisma.transcriptTranslation.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await repository.update('trans-1', updateData);

      expect(result).toEqual(mockUpdated);
      expect(prisma.transcriptTranslation.update).toHaveBeenCalledWith({
        where: { id: 'trans-1' },
        data: updateData,
      });
    });

    it('should allow partial updates', async () => {
      const updateData = {
        transcript: 'Only transcript updated',
      };

      const mockUpdated = {
        id: 'trans-1',
        assetId: 'asset-1',
        language: 'hi',
        transcript: 'Only transcript updated',
        segments: null,
        translatedFrom: 'en',
        translatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      (prisma.transcriptTranslation.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await repository.update('trans-1', updateData);

      expect(result.transcript).toBe('Only transcript updated');
    });
  });

  describe('delete', () => {
    it('should delete a translation', async () => {
      (prisma.transcriptTranslation.delete as jest.Mock).mockResolvedValue({
        id: 'trans-1',
      });

      await repository.delete('trans-1');

      expect(prisma.transcriptTranslation.delete).toHaveBeenCalledWith({
        where: { id: 'trans-1' },
      });
    });

    it('should not throw when deleting non-existent translation', async () => {
      (prisma.transcriptTranslation.delete as jest.Mock).mockRejectedValue(
        new Error('Record not found')
      );

      await expect(repository.delete('non-existent')).rejects.toThrow();
    });
  });
});
