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
  private supportsIncludeCaptions(): boolean {
    const runtimeModel = (prisma as any)?._runtimeDataModel?.models?.Export;
    if (!runtimeModel) {
      return false;
    }

    if (Array.isArray(runtimeModel.fields)) {
      return runtimeModel.fields.some((field: { name?: string }) => field?.name === 'includeCaptions');
    }

    return Object.prototype.hasOwnProperty.call(runtimeModel.fields ?? {}, 'includeCaptions');
  }

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
    status: 'queued' | 'processing' | 'done' | 'failed'
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
          in: ['queued', 'processing'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return exports.map(this.mapToExportRecord);
  }

  async create(data: CreateExportData): Promise<ExportRecord> {
    const includeCaptionsSupported = this.supportsIncludeCaptions();
    const exportRecord = await prisma.export.create({
      data: {
        projectId: data.projectId,
        ...(data.userId !== undefined && { userId: data.userId }),
        clipIds: data.clipIds,
        preset: data.preset,
        ...(includeCaptionsSupported && { includeCaptions: data.includeCaptions ?? false }),
        ...(data.progress !== undefined && { progress: data.progress }),
        ...(data.phase !== undefined && { phase: data.phase }),
        ...(data.outputFormat !== undefined && { outputFormat: data.outputFormat }),
        ...(data.platformPreset !== undefined && { platformPreset: data.platformPreset }),
        ...(data.aspectRatio !== undefined && { aspectRatio: data.aspectRatio }),
        ...(data.captionTrackId !== undefined && { captionTrackId: data.captionTrackId }),
        ...(data.layoutPreset !== undefined && { layoutPreset: data.layoutPreset }),
        ...(data.metadata !== undefined && { metadata: data.metadata as any }),
        ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
        ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
        status: data.status || 'queued',
        outputPath: data.outputPath ?? '',
        storagePath: data.storagePath ?? '',
        ...(data.error !== undefined && { error: data.error }),
      } as any,
    });

    return this.mapToExportRecord(exportRecord);
  }

  async update(id: string, data: UpdateExportData): Promise<ExportRecord> {
    const includeCaptionsSupported = this.supportsIncludeCaptions();
    const exportRecord = await prisma.export.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.progress !== undefined && { progress: data.progress }),
        ...(data.phase !== undefined && { phase: data.phase }),
        ...(data.clipIds !== undefined && { clipIds: data.clipIds }),
        ...(includeCaptionsSupported &&
          data.includeCaptions !== undefined && { includeCaptions: data.includeCaptions }),
        ...(data.outputFormat !== undefined && { outputFormat: data.outputFormat }),
        ...(data.platformPreset !== undefined && { platformPreset: data.platformPreset }),
        ...(data.aspectRatio !== undefined && { aspectRatio: data.aspectRatio }),
        ...(data.captionTrackId !== undefined && { captionTrackId: data.captionTrackId }),
        ...(data.layoutPreset !== undefined && { layoutPreset: data.layoutPreset }),
        ...(data.outputPath !== undefined && { outputPath: data.outputPath }),
        ...(data.storagePath !== undefined && { storagePath: data.storagePath }),
        ...(data.error !== undefined && { error: data.error }),
        ...(data.metadata !== undefined && { metadata: data.metadata as any }),
        ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
        ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
      } as any,
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
      userId: prismaExport.userId ?? null,
      clipIds: Array.isArray(prismaExport.clipIds) ? prismaExport.clipIds : [],
      preset: prismaExport.preset,
      includeCaptions: Boolean(prismaExport.includeCaptions),
      status: prismaExport.status,
      progress: prismaExport.progress ?? null,
      phase: prismaExport.phase ?? null,
      outputFormat: prismaExport.outputFormat ?? null,
      platformPreset: prismaExport.platformPreset ?? null,
      aspectRatio: prismaExport.aspectRatio ?? null,
      captionTrackId: prismaExport.captionTrackId ?? null,
      layoutPreset: prismaExport.layoutPreset ?? null,
      outputPath: prismaExport.outputPath,
      storagePath: prismaExport.storagePath,
      error: prismaExport.error,
      metadata: prismaExport.metadata ?? null,
      startedAt: prismaExport.startedAt?.toISOString?.() ?? null,
      completedAt: prismaExport.completedAt?.toISOString?.() ?? null,
      createdAt: prismaExport.createdAt.toISOString(),
      updatedAt: prismaExport.updatedAt?.toISOString(),
    };
  }
}
