import { UpdateClipUseCase } from "@/lib/application/use-cases/UpdateClipUseCase";
import type { IClipRepository } from "@/lib/domain/repositories/IClipRepository";
import type { IProjectRepository } from "@/lib/domain/repositories/IProjectRepository";
import type { Clip, Project } from "@/lib/types";

function buildClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "clip_1",
    projectId: "project_1",
    assetId: "asset_1",
    startMs: 10_000,
    endMs: 20_000,
    createdAt: new Date().toISOString(),
    viralityFactors: {
      hookStrength: 50,
      emotionalPeak: 40,
      storyArc: 45,
      pacing: 48,
      transcriptQuality: 30,
      metadata: {},
    },
    ...overrides,
  };
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project_1",
    userId: "user_1",
    title: "Demo",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("UpdateClipUseCase", () => {
  it("normalizes transcript edit ranges and returns normalized payload", async () => {
    const clip = buildClip();
    const project = buildProject();
    const updatedClip = buildClip({
      viralityFactors: {
        ...clip.viralityFactors!,
        metadata: {
          transcriptEditRangesMs: [
            { startMs: 10_000, endMs: 11_000 },
            { startMs: 11_050, endMs: 13_000 },
          ],
        },
      },
    });

    const clipRepo: jest.Mocked<IClipRepository> = {
      findById: jest.fn().mockResolvedValue(clip),
      findByProjectId: jest.fn(),
      findMany: jest.fn(),
      findTopByViralityScore: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn().mockResolvedValue(updatedClip),
      delete: jest.fn(),
      deleteByProjectId: jest.fn(),
      countByProjectId: jest.fn(),
    };

    const projectRepo: jest.Mocked<IProjectRepository> = {
      findById: jest.fn().mockResolvedValue(project),
      findByUserId: jest.fn(),
      findSummariesByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(project),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    const useCase = new UpdateClipUseCase(clipRepo, projectRepo);

    const output = await useCase.execute({
      clipId: clip.id,
      userId: project.userId,
      updates: {
        transcriptEditRangesMs: [
          { startMs: 9_000, endMs: 10_550 }, // clamped
          { startMs: 11_000, endMs: 11_100 }, // dropped (short)
          { startMs: 11_200, endMs: 12_000 },
          { startMs: 12_050, endMs: 13_000 }, // merged with previous
        ],
      },
    });

    expect(clipRepo.update).toHaveBeenCalledTimes(1);
    const [, updatePayload] = clipRepo.update.mock.calls[0];
    const metadata = (updatePayload.viralityFactors?.metadata ?? {}) as Record<string, unknown>;
    expect(metadata.transcriptEditRangesMs).toEqual([
      { startMs: 10_000, endMs: 10_550 },
      { startMs: 11_200, endMs: 13_000 },
    ]);
    expect((updatePayload as { transcriptEditRangesMs?: unknown }).transcriptEditRangesMs).toBeUndefined();

    expect(output.normalizedTranscriptEditRangesMs).toEqual([
      { startMs: 10_000, endMs: 10_550 },
      { startMs: 11_200, endMs: 13_000 },
    ]);
  });
});
