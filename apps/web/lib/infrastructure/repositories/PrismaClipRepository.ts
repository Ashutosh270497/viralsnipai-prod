/**
 * Prisma Clip Repository Implementation
 *
 * Implements IClipRepository using Prisma ORM.
 *
 * @module PrismaClipRepository
 */

import { injectable } from 'inversify';
import { prisma } from '@/lib/prisma';
import type { Clip, CreateClipData, UpdateClipData } from '@/lib/types';
import type {
  IClipRepository,
  FindClipsOptions,
  PaginatedClips,
} from '@/lib/domain/repositories/IClipRepository';

@injectable()
export class PrismaClipRepository implements IClipRepository {
  async findById(id: string): Promise<Clip | null> {
    const clip = await prisma.clip.findUnique({
      where: { id },
    });

    if (!clip) return null;

    return this.mapToClip(clip);
  }

  async findByProjectId(projectId: string): Promise<Clip[]> {
    const clips = await prisma.clip.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return clips.map(this.mapToClip);
  }

  async findMany(options: FindClipsOptions): Promise<PaginatedClips> {
    const {
      projectId,
      assetId,
      minViralityScore,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
    } = options;

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (assetId) where.assetId = assetId;
    if (minViralityScore !== undefined) {
      where.viralityScore = { gte: minViralityScore };
    }

    const [clips, total] = await Promise.all([
      prisma.clip.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.clip.count({ where }),
    ]);

    const pageSize = limit;
    const page = Math.floor(offset / pageSize) + 1;
    const totalPages = Math.ceil(total / pageSize);

    return {
      clips: clips.map(this.mapToClip),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findTopByViralityScore(projectId: string, limit: number): Promise<Clip[]> {
    const clips = await prisma.clip.findMany({
      where: {
        projectId,
        viralityScore: { not: null },
      },
      orderBy: { viralityScore: 'desc' },
      take: limit,
    });

    return clips.map(this.mapToClip);
  }

  async create(data: CreateClipData & { projectId: string; assetId: string }): Promise<Clip> {
    const clip = await prisma.clip.create({
      data: {
        projectId: data.projectId,
        assetId: data.assetId,
        startMs: data.startMs,
        endMs: data.endMs,
        ...(data.order !== undefined && { order: data.order }),
        title: data.title,
        summary: data.summary,
        callToAction: data.callToAction,
        ...(data.captionSrt !== undefined && { captionSrt: data.captionSrt }),
        ...(data.captionStyle !== undefined && { captionStyle: data.captionStyle as any }),
        ...(data.thumbnail !== undefined && { thumbnail: data.thumbnail }),
        ...(data.previewPath !== undefined && { previewPath: data.previewPath }),
        viralityScore: data.viralityScore,
        viralityFactors: data.viralityFactors as any,
      },
    });

    return this.mapToClip(clip);
  }

  async createMany(
    clips: Array<CreateClipData & { projectId: string; assetId: string }>
  ): Promise<Clip[]> {
    const created = await prisma.$transaction(
      clips.map((clip) =>
        prisma.clip.create({
          data: {
            projectId: clip.projectId,
            assetId: clip.assetId,
            startMs: clip.startMs,
            endMs: clip.endMs,
            ...(clip.order !== undefined && { order: clip.order }),
            title: clip.title,
            summary: clip.summary,
            callToAction: clip.callToAction,
            ...(clip.captionSrt !== undefined && { captionSrt: clip.captionSrt }),
            ...(clip.captionStyle !== undefined && { captionStyle: clip.captionStyle as any }),
            ...(clip.thumbnail !== undefined && { thumbnail: clip.thumbnail }),
            ...(clip.previewPath !== undefined && { previewPath: clip.previewPath }),
            viralityScore: clip.viralityScore,
            viralityFactors: clip.viralityFactors as any,
          },
        })
      )
    );

    return created.map(this.mapToClip);
  }

  async update(id: string, data: UpdateClipData): Promise<Clip> {
    const clip = await prisma.clip.update({
      where: { id },
      data: {
        ...(data.startMs !== undefined && { startMs: data.startMs }),
        ...(data.endMs !== undefined && { endMs: data.endMs }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.summary !== undefined && { summary: data.summary }),
        ...(data.callToAction !== undefined && { callToAction: data.callToAction }),
        ...(data.captionSrt !== undefined && { captionSrt: data.captionSrt }),
        ...(data.captionStyle !== undefined && { captionStyle: data.captionStyle as any }),
        ...(data.thumbnail !== undefined && { thumbnail: data.thumbnail }),
        ...(data.previewPath !== undefined && { previewPath: data.previewPath }),
        ...(data.viralityScore !== undefined && { viralityScore: data.viralityScore }),
        ...(data.viralityFactors !== undefined && { viralityFactors: data.viralityFactors as any }),
      },
    });

    return this.mapToClip(clip);
  }

  async delete(id: string): Promise<void> {
    await prisma.clip.delete({
      where: { id },
    });
  }

  async deleteByProjectId(projectId: string): Promise<number> {
    const result = await prisma.clip.deleteMany({
      where: { projectId },
    });
    return result.count;
  }

  async countByProjectId(projectId: string): Promise<number> {
    return await prisma.clip.count({
      where: { projectId },
    });
  }

  /**
   * Map Prisma clip to domain Clip type
   */
  private mapToClip(prismaClip: any): Clip {
    return {
      id: prismaClip.id,
      projectId: prismaClip.projectId,
      assetId: prismaClip.assetId,
      startMs: prismaClip.startMs,
      endMs: prismaClip.endMs,
      order: prismaClip.order,
      title: prismaClip.title,
      summary: prismaClip.summary,
      callToAction: prismaClip.callToAction,
      captionSrt: prismaClip.captionSrt,
      captionStyle: prismaClip.captionStyle as any,
      previewPath: prismaClip.previewPath,
      thumbnail: prismaClip.thumbnail,
      viralityScore: prismaClip.viralityScore,
      viralityFactors: prismaClip.viralityFactors as any,
      createdAt: prismaClip.createdAt.toISOString(),
      updatedAt: prismaClip.updatedAt?.toISOString(),
    };
  }
}
