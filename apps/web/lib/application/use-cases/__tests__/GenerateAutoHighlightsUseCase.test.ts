/**
 * Unit tests for GenerateAutoHighlightsUseCase
 */

import { GenerateAutoHighlightsUseCase } from '../GenerateAutoHighlightsUseCase';
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { TranscriptionService } from '@/lib/domain/services/TranscriptionService';
import type { AIAnalysisService } from '@/lib/domain/services/AIAnalysisService';
import type { ClipExtractionService } from '@/lib/domain/services/ClipExtractionService';

describe('GenerateAutoHighlightsUseCase', () => {
  let useCase: GenerateAutoHighlightsUseCase;
  let mockProjectRepo: jest.Mocked<IProjectRepository>;
  let mockAssetRepo: jest.Mocked<IAssetRepository>;
  let mockClipRepo: jest.Mocked<IClipRepository>;
  let mockTranscriptionService: jest.Mocked<TranscriptionService>;
  let mockAIAnalysisService: jest.Mocked<AIAnalysisService>;
  let mockClipExtractionService: jest.Mocked<ClipExtractionService>;

  beforeEach(() => {
    // Create mocks
    mockProjectRepo = {
      findById: jest.fn(),
      exists: jest.fn(),
    } as any;

    mockAssetRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    } as any;

    mockClipRepo = {
      createMany: jest.fn(),
      deleteByProjectId: jest.fn(),
      countByProjectId: jest.fn(),
      findTopByViralityScore: jest.fn(),
    } as any;

    mockTranscriptionService = {
      transcribe: jest.fn(),
      parseTranscript: jest.fn(),
      probeDuration: jest.fn(),
    } as any;

    mockAIAnalysisService = {
      generateHighlights: jest.fn(),
      determineOptimalClipCount: jest.fn(),
    } as any;

    mockClipExtractionService = {
      extractClips: jest.fn(),
      getTranscriptSegment: jest.fn(),
    } as any;

    useCase = new GenerateAutoHighlightsUseCase(
      mockProjectRepo,
      mockAssetRepo,
      mockClipRepo,
      mockTranscriptionService,
      mockAIAnalysisService,
      mockClipExtractionService
    );
  });

  it('should generate highlights successfully', async () => {
    // Setup mocks
    const mockAsset = {
      id: 'asset-1',
      projectId: 'project-1',
      path: '/path/to/video.mp4',
      type: 'video',
      durationSec: 120,
      transcript: 'This is a transcript',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const mockProject = {
      id: 'project-1',
      userId: 'user-1',
      title: 'Test Project',
      topic: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      clips: [],
      assets: [],
      exports: [],
    };

    const mockTranscription = {
      text: 'This is a transcript',
      segments: [
        {
          id: 0,
          start: 0,
          end: 10,
          text: 'This is a transcript',
          words: [],
        },
      ],
    };

    const mockSuggestions = [
      {
        startSec: 5,
        endSec: 15,
        reason: 'Great hook',
        summary: 'Test highlight',
        viralityScore: 85,
        viralityFactors: { hookStrength: 9 },
      },
    ];

    const mockExtractedClips = [
      {
        startMs: 5000,
        endMs: 15000,
        title: 'Clip 1',
        summary: 'Test highlight',
        callToAction: 'Subscribe',
        viralityScore: 85,
        viralityFactors: { hookStrength: 9 },
      },
    ];

    const mockCreatedClips = [
      {
        id: 'clip-1',
        projectId: 'project-1',
        assetId: 'asset-1',
        ...mockExtractedClips[0],
        captionSrt: null,
        previewPath: null,
      },
    ];

    mockAssetRepo.findById.mockResolvedValue(mockAsset);
    mockProjectRepo.exists.mockResolvedValue(true);
    mockProjectRepo.findById.mockResolvedValue(mockProject);
    mockTranscriptionService.parseTranscript.mockReturnValue(mockTranscription);
    mockAIAnalysisService.determineOptimalClipCount.mockReturnValue(6);
    mockAIAnalysisService.generateHighlights.mockResolvedValue({
      suggestions: mockSuggestions,
      model: 'gemini-2.0-flash-exp',
      requestedCount: 6,
      receivedCount: 1,
    });
    mockClipExtractionService.extractClips.mockReturnValue(mockExtractedClips);
    mockClipRepo.deleteByProjectId.mockResolvedValue(0);
    mockClipRepo.createMany.mockResolvedValue(mockCreatedClips);
    mockClipRepo.countByProjectId.mockResolvedValue(1);
    mockClipRepo.findTopByViralityScore.mockResolvedValue([mockCreatedClips[0]]);

    // Execute
    const result = await useCase.execute({
      assetId: 'asset-1',
      userId: 'user-1',
      options: {
        targetClipCount: 6,
        model: 'gemini-2.0-flash-exp',
        audience: 'creators',
        tone: 'energetic',
        brief: 'Focus on tips',
        callToAction: 'Subscribe',
      },
    });

    // Assertions
    expect(result.assetId).toBe('asset-1');
    expect(result.clips).toHaveLength(1);
    expect(result.clips[0].id).toBe('clip-1');
    expect(result.analytics).toBeDefined();
    expect(result.analytics.totalClipsGenerated).toBe(1);
    expect(result.analytics.averageViralityScore).toBe(85);

    // Verify services were called correctly
    expect(mockAssetRepo.findById).toHaveBeenCalledWith('asset-1');
    expect(mockProjectRepo.exists).toHaveBeenCalledWith('project-1');
    expect(mockAIAnalysisService.generateHighlights).toHaveBeenCalledWith({
      transcript: 'This is a transcript',
      durationSec: 120,
      targetCount: 6,
      model: 'gemini-2.0-flash-exp',
      audience: 'creators',
      tone: 'energetic',
      brief: 'Focus on tips',
      callToAction: 'Subscribe',
    });
    expect(mockClipExtractionService.extractClips).toHaveBeenCalled();
    expect(mockClipRepo.createMany).toHaveBeenCalled();
  });

  it('should throw error if asset not found', async () => {
    mockAssetRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        assetId: 'non-existent',
        userId: 'user-1',
        options: {},
      })
    ).rejects.toThrow('Asset not found');
  });

  it('should throw error if project not found', async () => {
    const mockAsset = {
      id: 'asset-1',
      projectId: 'project-1',
      path: '/path/to/video.mp4',
      type: 'video',
      durationSec: 120,
      transcript: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    mockAssetRepo.findById.mockResolvedValue(mockAsset);
    mockProjectRepo.exists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        assetId: 'asset-1',
        userId: 'user-1',
        options: {},
      })
    ).rejects.toThrow('Project not found');
  });

  it('should throw error if user does not own project', async () => {
    const mockAsset = {
      id: 'asset-1',
      projectId: 'project-1',
      path: '/path/to/video.mp4',
      type: 'video',
      durationSec: 120,
      transcript: 'Transcript',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const mockProject = {
      id: 'project-1',
      userId: 'different-user',
      title: 'Test Project',
      topic: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      clips: [],
      assets: [],
      exports: [],
    };

    mockAssetRepo.findById.mockResolvedValue(mockAsset);
    mockProjectRepo.exists.mockResolvedValue(true);
    mockProjectRepo.findById.mockResolvedValue(mockProject);

    await expect(
      useCase.execute({
        assetId: 'asset-1',
        userId: 'user-1',
        options: {},
      })
    ).rejects.toThrow('User does not own this project');
  });

  it('should handle missing transcript by transcribing', async () => {
    const mockAsset = {
      id: 'asset-1',
      projectId: 'project-1',
      path: '/path/to/video.mp4',
      type: 'video',
      durationSec: null,
      transcript: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const mockProject = {
      id: 'project-1',
      userId: 'user-1',
      title: 'Test Project',
      topic: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      clips: [],
      assets: [],
      exports: [],
    };

    const mockTranscription = {
      text: 'New transcript',
      segments: [],
    };

    mockAssetRepo.findById.mockResolvedValue(mockAsset);
    mockProjectRepo.exists.mockResolvedValue(true);
    mockProjectRepo.findById.mockResolvedValue(mockProject);
    mockTranscriptionService.probeDuration.mockResolvedValue(120);
    mockTranscriptionService.transcribe.mockResolvedValue(mockTranscription);
    mockAssetRepo.update.mockResolvedValue({ ...mockAsset, transcript: 'New transcript', durationSec: 120 });
    mockAIAnalysisService.determineOptimalClipCount.mockReturnValue(6);
    mockAIAnalysisService.generateHighlights.mockResolvedValue({
      suggestions: [],
      model: 'auto',
      requestedCount: 6,
      receivedCount: 0,
    });
    mockClipExtractionService.extractClips.mockReturnValue([]);
    mockClipRepo.deleteByProjectId.mockResolvedValue(0);
    mockClipRepo.createMany.mockResolvedValue([]);
    mockClipRepo.countByProjectId.mockResolvedValue(0);
    mockClipRepo.findTopByViralityScore.mockResolvedValue([]);

    const result = await useCase.execute({
      assetId: 'asset-1',
      userId: 'user-1',
      options: {},
    });

    expect(mockTranscriptionService.transcribe).toHaveBeenCalledWith('/path/to/video.mp4');
    expect(mockAssetRepo.update).toHaveBeenCalled();
    expect(result.clips).toBeDefined();
  });
});
