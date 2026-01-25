/**
 * Prisma Asset Repository Implementation
 *
 * Implements IAssetRepository using Prisma ORM.
 *
 * @module PrismaAssetRepository
 */

import { injectable } from 'inversify';
import { prisma } from '@/lib/prisma';
import type { Asset } from '@/lib/types';
import type {
  IAssetRepository,
  CreateAssetData,
  UpdateAssetData,
} from '@/lib/domain/repositories/IAssetRepository';

@injectable()
export class PrismaAssetRepository implements IAssetRepository {
  async findById(id: string): Promise<Asset | null> {
    const asset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) return null;

    return this.mapToAsset(asset);
  }

  async findByProjectId(projectId: string): Promise<Asset[]> {
    const assets = await prisma.asset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return assets.map(this.mapToAsset);
  }

  async findByType(projectId: string, type: 'video' | 'audio'): Promise<Asset[]> {
    const assets = await prisma.asset.findMany({
      where: {
        projectId,
        type,
      },
      orderBy: { createdAt: 'desc' },
    });

    return assets.map(this.mapToAsset);
  }

  async create(data: CreateAssetData): Promise<Asset> {
    const asset = await prisma.asset.create({
      data: {
        projectId: data.projectId,
        path: data.path,
        storagePath: data.storagePath,
        type: data.type,
        durationSec: data.durationSec,
        transcript: data.transcript,
      },
    });

    return this.mapToAsset(asset);
  }

  async update(id: string, data: UpdateAssetData): Promise<Asset> {
    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(data.path !== undefined && { path: data.path }),
        ...(data.durationSec !== undefined && { durationSec: data.durationSec }),
        ...(data.transcript !== undefined && { transcript: data.transcript }),
      },
    });

    return this.mapToAsset(asset);
  }

  async delete(id: string): Promise<void> {
    await prisma.asset.delete({
      where: { id },
    });
  }

  async deleteByProjectId(projectId: string): Promise<number> {
    const result = await prisma.asset.deleteMany({
      where: { projectId },
    });
    return result.count;
  }

  async countByProjectId(projectId: string): Promise<number> {
    return await prisma.asset.count({
      where: { projectId },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.asset.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Map Prisma asset to domain Asset type
   */
  private mapToAsset(prismaAsset: any): Asset {
    return {
      id: prismaAsset.id,
      projectId: prismaAsset.projectId,
      path: prismaAsset.path,
      storagePath: prismaAsset.storagePath,
      type: prismaAsset.type,
      durationSec: prismaAsset.durationSec,
      durationSeconds: prismaAsset.durationSec,
      transcript: prismaAsset.transcript,
      transcription: prismaAsset.transcript,
      createdAt: prismaAsset.createdAt.toISOString(),
    };
  }
}
