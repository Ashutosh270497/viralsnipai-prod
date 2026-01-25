/**
 * Prisma Export Repository Implementation
 *
 * Implements IExportRepository using Prisma ORM.
 *
 * @module PrismaExportRepository
 */

import { injectable } from 'inversify';
import { prisma } from '@/lib/prisma';
import type { ExportRecord } from '@/lib/types';
import type {
  IExportRepository,
  CreateExportData,
  UpdateExportData,
} from '@/lib/domain/repositories/IExportRepository';

@injectable()
export class PrismaExportRepository implements IExportRepository {
  async findById(id: string): Promise<ExportRecord | null> {
    const exportRecord = await prisma.export.findUnique({
      where: { id },
    });

    if (!exportRecord) return null;

    return this.mapToExportRecord(exportRecord);
  }

  async findByProjectId(projectId: string): Promise<ExportRecord[]> {
    const exports = await prisma.export.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return exports.map(this.mapToExportRecord);
  }

  async findByStatus(
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<ExportRecord[]> {
    const exports = await prisma.export.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });

    return exports.map(this.mapToExportRecord);
  }

  async findActive(): Promise<ExportRecord[]> {
    const exports = await prisma.export.findMany({
      where: {
        status: {
          in: ['pending', 'processing'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return exports.map(this.mapToExportRecord);
  }

  async create(data: CreateExportData): Promise<ExportRecord> {
    const exportRecord = await prisma.export.create({
      data: {
        projectId: data.projectId,
        clipId: data.clipId,
        preset: data.preset,
        status: data.status || 'pending',
      },
    });

    return this.mapToExportRecord(exportRecord);
  }

  async update(id: string, data: UpdateExportData): Promise<ExportRecord> {
    const exportRecord = await prisma.export.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.progress !== undefined && { progress: data.progress }),
        ...(data.downloadUrl !== undefined && { downloadUrl: data.downloadUrl }),
        ...(data.error !== undefined && { error: data.error }),
        ...(data.completedAt !== undefined && {
          completedAt: data.completedAt ? new Date(data.completedAt) : null,
        }),
      },
    });

    return this.mapToExportRecord(exportRecord);
  }

  async delete(id: string): Promise<void> {
    await prisma.export.delete({
      where: { id },
    });
  }

  async deleteByProjectId(projectId: string): Promise<number> {
    const result = await prisma.export.deleteMany({
      where: { projectId },
    });
    return result.count;
  }

  async countByProjectId(projectId: string): Promise<number> {
    return await prisma.export.count({
      where: { projectId },
    });
  }

  /**
   * Map Prisma export to domain ExportRecord type
   */
  private mapToExportRecord(prismaExport: any): ExportRecord {
    return {
      id: prismaExport.id,
      projectId: prismaExport.projectId,
      clipId: prismaExport.clipId,
      preset: prismaExport.preset,
      status: prismaExport.status,
      progress: prismaExport.progress,
      downloadUrl: prismaExport.downloadUrl,
      error: prismaExport.error,
      createdAt: prismaExport.createdAt.toISOString(),
      completedAt: prismaExport.completedAt?.toISOString(),
    };
  }
}
