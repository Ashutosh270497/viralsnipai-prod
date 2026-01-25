/**
 * Unit tests for PrismaClipRepository
 */

import { PrismaClipRepository } from '../PrismaClipRepository';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    clip: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('PrismaClipRepository', () => {
  let repository: PrismaClipRepository;

  beforeEach(() => {
    repository = new PrismaClipRepository();
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a clip when found', async () => {
      const mockClip = {
        id: 'clip-1',
        projectId: 'project-1',
        assetId: 'asset-1',
        startMs: 1000,
        endMs: 5000,
        title: 'Test Clip',
        summary: 'Summary',
        callToAction: 'Subscribe!',
        captionSrt: null,
        previewPath: null,
        viralityScore: 85,
        viralityFactors: { hookStrength: 8 },
      };

      (prisma.clip.findUnique as jest.Mock).mockResolvedValue(mockClip);

      const result = await repository.findById('clip-1');

      expect(result).toEqual(mockClip);
      expect(prisma.clip.findUnique).toHaveBeenCalledWith({
        where: { id: 'clip-1' },
      });
    });

    it('should return null when clip not found', async () => {
      (prisma.clip.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByProjectId', () => {
    it('should return all clips for a project', async () => {
      const mockClips = [
        {
          id: 'clip-1',
          projectId: 'project-1',
          assetId: 'asset-1',
          startMs: 1000,
          endMs: 5000,
          title: 'Clip 1',
          summary: null,
          callToAction: null,
          captionSrt: null,
          previewPath: null,
          viralityScore: 90,
          viralityFactors: null,
        },
        {
          id: 'clip-2',
          projectId: 'project-1',
          assetId: 'asset-1',
          startMs: 6000,
          endMs: 10000,
          title: 'Clip 2',
          summary: null,
          callToAction: null,
          captionSrt: null,
          previewPath: null,
          viralityScore: 75,
          viralityFactors: null,
        },
      ];

      (prisma.clip.findMany as jest.Mock).mockResolvedValue(mockClips);

      const result = await repository.findByProjectId('project-1');

      expect(result).toHaveLength(2);
      expect(result[0].viralityScore).toBe(90);
      expect(result[1].viralityScore).toBe(75);
      expect(prisma.clip.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { viralityScore: 'desc' },
      });
    });
  });

  describe('findTopByViralityScore', () => {
    it('should return top clips by virality score', async () => {
      const mockClips = [
        { id: 'clip-1', viralityScore: 95, projectId: 'project-1', assetId: 'asset-1', startMs: 0, endMs: 1000 },
        { id: 'clip-2', viralityScore: 90, projectId: 'project-1', assetId: 'asset-1', startMs: 0, endMs: 1000 },
        { id: 'clip-3', viralityScore: 85, projectId: 'project-1', assetId: 'asset-1', startMs: 0, endMs: 1000 },
      ];

      (prisma.clip.findMany as jest.Mock).mockResolvedValue(mockClips);

      const result = await repository.findTopByViralityScore('project-1', 3);

      expect(result).toHaveLength(3);
      expect(result[0].viralityScore).toBe(95);
      expect(result[2].viralityScore).toBe(85);
      expect(prisma.clip.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', viralityScore: { not: null } },
        orderBy: { viralityScore: 'desc' },
        take: 3,
      });
    });
  });

  describe('create', () => {
    it('should create a clip with virality score', async () => {
      const createData = {
        projectId: 'project-1',
        assetId: 'asset-1',
        startMs: 1000,
        endMs: 5000,
        title: 'New Clip',
        summary: 'Summary',
        viralityScore: 88,
        viralityFactors: { hookStrength: 9 },
      };

      const mockCreated = {
        id: 'clip-new',
        ...createData,
        callToAction: null,
        captionSrt: null,
        previewPath: null,
      };

      (prisma.clip.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await repository.create(createData);

      expect(result.id).toBe('clip-new');
      expect(result.viralityScore).toBe(88);
      expect(prisma.clip.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          assetId: 'asset-1',
          startMs: 1000,
          endMs: 5000,
          title: 'New Clip',
          summary: 'Summary',
          callToAction: undefined,
          viralityScore: 88,
          viralityFactors: { hookStrength: 9 },
        },
      });
    });
  });

  describe('createMany', () => {
    it('should create multiple clips', async () => {
      const clipsData = [
        {
          projectId: 'project-1',
          assetId: 'asset-1',
          startMs: 1000,
          endMs: 2000,
          title: 'Clip 1',
          viralityScore: 90,
        },
        {
          projectId: 'project-1',
          assetId: 'asset-1',
          startMs: 3000,
          endMs: 4000,
          title: 'Clip 2',
          viralityScore: 85,
        },
      ];

      const mockCreatedClips = clipsData.map((data, i) => ({
        id: `clip-${i + 1}`,
        ...data,
        summary: null,
        callToAction: null,
        captionSrt: null,
        previewPath: null,
        viralityFactors: null,
      }));

      (prisma.clip.createMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.clip.findMany as jest.Mock).mockResolvedValue(mockCreatedClips);

      const result = await repository.createMany(clipsData);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Clip 1');
      expect(result[1].title).toBe('Clip 2');
    });
  });

  describe('update', () => {
    it('should update a clip', async () => {
      const updateData = {
        title: 'Updated Title',
        summary: 'Updated Summary',
      };

      const mockUpdated = {
        id: 'clip-1',
        projectId: 'project-1',
        assetId: 'asset-1',
        startMs: 1000,
        endMs: 5000,
        ...updateData,
        callToAction: null,
        captionSrt: null,
        previewPath: null,
        viralityScore: null,
        viralityFactors: null,
      };

      (prisma.clip.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await repository.update('clip-1', updateData);

      expect(result.title).toBe('Updated Title');
      expect(result.summary).toBe('Updated Summary');
    });
  });

  describe('deleteByProjectId', () => {
    it('should delete all clips for a project', async () => {
      (prisma.clip.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await repository.deleteByProjectId('project-1');

      expect(result).toBe(5);
      expect(prisma.clip.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      });
    });
  });

  describe('countByProjectId', () => {
    it('should count clips for a project', async () => {
      (prisma.clip.count as jest.Mock).mockResolvedValue(10);

      const result = await repository.countByProjectId('project-1');

      expect(result).toBe(10);
      expect(prisma.clip.count).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      });
    });
  });
});
