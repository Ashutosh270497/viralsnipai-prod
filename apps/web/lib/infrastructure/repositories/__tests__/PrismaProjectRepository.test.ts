/**
 * Unit tests for PrismaProjectRepository
 */

import { PrismaProjectRepository } from '../PrismaProjectRepository';
import { prisma } from '@/lib/prisma';

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('PrismaProjectRepository', () => {
  let repository: PrismaProjectRepository;

  beforeEach(() => {
    repository = new PrismaProjectRepository();
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a project when found', async () => {
      const mockProject = {
        id: 'project-1',
        userId: 'user-1',
        title: 'Test Project',
        topic: 'Testing',
        createdAt: new Date(),
        clips: [],
        assets: [],
        exports: [],
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

      const result = await repository.findById('project-1');

      expect(result).toEqual({
        id: 'project-1',
        userId: 'user-1',
        title: 'Test Project',
        topic: 'Testing',
        createdAt: mockProject.createdAt.toISOString(),
        clips: [],
        assets: [],
        exports: [],
      });
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        include: {
          clips: { orderBy: { viralityScore: 'desc' } },
          assets: true,
          exports: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    it('should return null when project not found', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return all projects for a user', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          userId: 'user-1',
          title: 'Project 1',
          topic: null,
          createdAt: new Date(),
          clips: [],
          assets: [],
          exports: [],
        },
        {
          id: 'project-2',
          userId: 'user-1',
          title: 'Project 2',
          topic: 'Topic 2',
          createdAt: new Date(),
          clips: [],
          assets: [],
          exports: [],
        },
      ];

      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);

      const result = await repository.findByUserId('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('project-1');
      expect(result[1].id).toBe('project-2');
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          clips: { orderBy: { viralityScore: 'desc' } },
          assets: true,
          exports: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create a new project', async () => {
      const createData = {
        userId: 'user-1',
        title: 'New Project',
        topic: 'New Topic',
      };

      const mockCreated = {
        id: 'project-new',
        ...createData,
        createdAt: new Date(),
        clips: [],
        assets: [],
        exports: [],
      };

      (prisma.project.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await repository.create(createData);

      expect(result.id).toBe('project-new');
      expect(result.title).toBe('New Project');
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: createData,
        include: {
          clips: { orderBy: { viralityScore: 'desc' } },
          assets: true,
          exports: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  });

  describe('update', () => {
    it('should update an existing project', async () => {
      const updateData = {
        title: 'Updated Title',
        topic: 'Updated Topic',
      };

      const mockUpdated = {
        id: 'project-1',
        userId: 'user-1',
        ...updateData,
        createdAt: new Date(),
        clips: [],
        assets: [],
        exports: [],
      };

      (prisma.project.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await repository.update('project-1', updateData);

      expect(result.title).toBe('Updated Title');
      expect(result.topic).toBe('Updated Topic');
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: updateData,
        include: {
          clips: { orderBy: { viralityScore: 'desc' } },
          assets: true,
          exports: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete a project', async () => {
      (prisma.project.delete as jest.Mock).mockResolvedValue({});

      await repository.delete('project-1');

      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
    });
  });

  describe('exists', () => {
    it('should return true when project exists', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'project-1' });

      const result = await repository.exists('project-1');

      expect(result).toBe(true);
    });

    it('should return false when project does not exist', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.exists('non-existent');

      expect(result).toBe(false);
    });
  });
});
