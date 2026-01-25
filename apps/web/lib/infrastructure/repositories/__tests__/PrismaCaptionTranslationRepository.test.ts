/**
 * Unit tests for PrismaCaptionTranslationRepository
 */

import { PrismaCaptionTranslationRepository } from '../PrismaCaptionTranslationRepository';
import { prisma } from '@/lib/prisma';

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    captionTranslation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('PrismaCaptionTranslationRepository', () => {
  let repository: PrismaCaptionTranslationRepository;

  beforeEach(() => {
    repository = new PrismaCaptionTranslationRepository();
    jest.clearAllMocks();
  });

  describe('findByClipAndLanguage', () => {
    it('should return caption translation when found', async () => {
      const mockCaption = {
        id: 'caption-1',
        clipId: 'clip-1',
        language: 'hi',
        captionSrt: '1\n00:00:00,000 --> 00:00:05,000\nनमस्ते',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };

      (prisma.captionTranslation.findUnique as jest.Mock).mockResolvedValue(
        mockCaption
      );

      const result = await repository.findByClipAndLanguage('clip-1', 'hi');

      expect(result).toEqual(mockCaption);
      expect(prisma.captionTranslation.findUnique).toHaveBeenCalledWith({
        where: {
          clipId_language: {
            clipId: 'clip-1',
            language: 'hi',
          },
        },
      });
    });

    it('should return null when caption not found', async () => {
      (prisma.captionTranslation.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const result = await repository.findByClipAndLanguage('clip-1', 'hi');

      expect(result).toBeNull();
    });
  });

  describe('findByClipId', () => {
    it('should return all caption translations for a clip', async () => {
      const mockCaptions = [
        {
          id: 'caption-1',
          clipId: 'clip-1',
          language: 'hi',
          captionSrt: 'Hindi SRT',
          createdAt: new Date('2024-01-02T00:00:00Z'),
        },
        {
          id: 'caption-2',
          clipId: 'clip-1',
          language: 'ta',
          captionSrt: 'Tamil SRT',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];

      (prisma.captionTranslation.findMany as jest.Mock).mockResolvedValue(
        mockCaptions
      );

      const result = await repository.findByClipId('clip-1');

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockCaptions);
      expect(prisma.captionTranslation.findMany).toHaveBeenCalledWith({
        where: { clipId: 'clip-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no captions exist', async () => {
      (prisma.captionTranslation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.findByClipId('clip-1');

      expect(result).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('should create new caption translation when it does not exist', async () => {
      const captionData = {
        clipId: 'clip-1',
        language: 'hi',
        captionSrt: '1\n00:00:00,000 --> 00:00:05,000\nनमस्ते',
      };

      const mockCreated = {
        id: 'caption-1',
        ...captionData,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };

      (prisma.captionTranslation.upsert as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await repository.upsert(captionData);

      expect(result).toEqual(mockCreated);
      expect(prisma.captionTranslation.upsert).toHaveBeenCalledWith({
        where: {
          clipId_language: {
            clipId: 'clip-1',
            language: 'hi',
          },
        },
        create: {
          clipId: 'clip-1',
          language: 'hi',
          captionSrt: captionData.captionSrt,
        },
        update: {
          captionSrt: captionData.captionSrt,
        },
      });
    });

    it('should update existing caption translation', async () => {
      const captionData = {
        clipId: 'clip-1',
        language: 'hi',
        captionSrt: 'Updated SRT content',
      };

      const mockUpdated = {
        id: 'caption-1',
        ...captionData,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };

      (prisma.captionTranslation.upsert as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await repository.upsert(captionData);

      expect(result.captionSrt).toBe('Updated SRT content');
    });

    it('should handle complex SRT format', async () => {
      const complexSrt = `1
00:00:00,000 --> 00:00:05,000
नमस्ते दुनिया

2
00:00:05,000 --> 00:00:10,000
यह एक परीक्षण है`;

      const captionData = {
        clipId: 'clip-1',
        language: 'hi',
        captionSrt: complexSrt,
      };

      const mockCreated = {
        id: 'caption-1',
        ...captionData,
        createdAt: new Date(),
      };

      (prisma.captionTranslation.upsert as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await repository.upsert(captionData);

      expect(result.captionSrt).toBe(complexSrt);
    });
  });

  describe('delete', () => {
    it('should delete a caption translation', async () => {
      (prisma.captionTranslation.delete as jest.Mock).mockResolvedValue({
        id: 'caption-1',
      });

      await repository.delete('caption-1');

      expect(prisma.captionTranslation.delete).toHaveBeenCalledWith({
        where: { id: 'caption-1' },
      });
    });

    it('should throw error when deleting non-existent caption', async () => {
      (prisma.captionTranslation.delete as jest.Mock).mockRejectedValue(
        new Error('Record not found')
      );

      await expect(repository.delete('non-existent')).rejects.toThrow();
    });
  });
});
