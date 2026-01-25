/**
 * Prisma Project Repository Implementation
 *
 * Implements IProjectRepository using Prisma ORM.
 *
 * @module PrismaProjectRepository
 */

import { injectable } from 'inversify';
import { prisma } from '@/lib/prisma';
import type { Project, ProjectSummary } from '@/lib/types';
import type {
  IProjectRepository,
  CreateProjectData,
  UpdateProjectData,
} from '@/lib/domain/repositories/IProjectRepository';

@injectable()
export class PrismaProjectRepository implements IProjectRepository {
  async findById(id: string): Promise<Project | null> {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        clips: {
          orderBy: { viralityScore: 'desc' },
        },
        assets: true,
        exports: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) return null;

    return this.mapToProject(project);
  }

  async findByUserId(userId: string): Promise<Project[]> {
    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        clips: true,
        assets: true,
        exports: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map(this.mapToProject);
  }

  async findSummariesByUserId(userId: string): Promise<ProjectSummary[]> {
    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            clips: true,
            assets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => ({
      id: p.id,
      title: p.title,
      topic: p.topic,
      clipCount: p._count.clips,
      assetCount: p._count.assets,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async create(data: CreateProjectData): Promise<Project> {
    const project = await prisma.project.create({
      data: {
        userId: data.userId,
        title: data.title,
        topic: data.topic,
      },
      include: {
        clips: true,
        assets: true,
        exports: true,
      },
    });

    return this.mapToProject(project);
  }

  async update(id: string, data: UpdateProjectData): Promise<Project> {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.topic !== undefined && { topic: data.topic }),
      },
      include: {
        clips: true,
        assets: true,
        exports: true,
      },
    });

    return this.mapToProject(project);
  }

  async delete(id: string): Promise<void> {
    await prisma.project.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.project.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Map Prisma project to domain Project type
   */
  private mapToProject(prismaProject: any): Project {
    return {
      id: prismaProject.id,
      userId: prismaProject.userId,
      title: prismaProject.title,
      topic: prismaProject.topic,
      createdAt: prismaProject.createdAt.toISOString(),
      updatedAt: prismaProject.updatedAt?.toISOString(),
      clips: prismaProject.clips?.map((clip: any) => ({
        id: clip.id,
        projectId: clip.projectId,
        assetId: clip.assetId,
        startMs: clip.startMs,
        endMs: clip.endMs,
        title: clip.title,
        summary: clip.summary,
        callToAction: clip.callToAction,
        captionSrt: clip.captionSrt,
        previewPath: clip.previewPath,
        viralityScore: clip.viralityScore,
        viralityFactors: clip.viralityFactors as any,
        createdAt: clip.createdAt.toISOString(),
        updatedAt: clip.updatedAt?.toISOString(),
      })),
      assets: prismaProject.assets?.map((asset: any) => ({
        id: asset.id,
        projectId: asset.projectId,
        path: asset.path,
        type: asset.type,
        durationSec: asset.durationSec,
        durationSeconds: asset.durationSec,
        transcript: asset.transcript,
        transcription: asset.transcript,
        createdAt: asset.createdAt.toISOString(),
      })),
      exports: prismaProject.exports?.map((exp: any) => ({
        id: exp.id,
        projectId: exp.projectId,
        clipId: exp.clipId,
        preset: exp.preset,
        status: exp.status,
        progress: exp.progress,
        downloadUrl: exp.downloadUrl,
        error: exp.error,
        createdAt: exp.createdAt.toISOString(),
        completedAt: exp.completedAt?.toISOString(),
      })),
    };
  }
}
