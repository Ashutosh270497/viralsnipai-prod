/**
 * Dependency Injection Container
 *
 * Configures and exports the InversifyJS container with all bindings.
 * Enables loose coupling and testability through dependency injection.
 *
 * @module DI Container
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types';

// Repository Interfaces
import type { IProjectRepository } from '@/lib/domain/repositories/IProjectRepository';
import type { IClipRepository } from '@/lib/domain/repositories/IClipRepository';
import type { IAssetRepository } from '@/lib/domain/repositories/IAssetRepository';
import type { IExportRepository } from '@/lib/domain/repositories/IExportRepository';
import type { ITranscriptTranslationRepository } from '@/lib/domain/repositories/ITranscriptTranslationRepository';
import type { ICaptionTranslationRepository } from '@/lib/domain/repositories/ICaptionTranslationRepository';
import type { IVoiceTranslationRepository } from '@/lib/domain/repositories/IVoiceTranslationRepository';

// Repository Implementations
import { PrismaProjectRepository } from '@/lib/infrastructure/repositories/PrismaProjectRepository';
import { PrismaClipRepository } from '@/lib/infrastructure/repositories/PrismaClipRepository';
import { PrismaAssetRepository } from '@/lib/infrastructure/repositories/PrismaAssetRepository';
import { PrismaExportRepository } from '@/lib/infrastructure/repositories/PrismaExportRepository';
import { PrismaTranscriptTranslationRepository } from '@/lib/infrastructure/repositories/PrismaTranscriptTranslationRepository';
import { PrismaCaptionTranslationRepository } from '@/lib/infrastructure/repositories/PrismaCaptionTranslationRepository';
import { PrismaVoiceTranslationRepository } from '@/lib/infrastructure/repositories/PrismaVoiceTranslationRepository';
import { prisma } from '@/lib/prisma';

// Domain Services
import { TranscriptionService } from '@/lib/domain/services/TranscriptionService';
import { TranslationService } from '@/lib/domain/services/TranslationService';
import { AIAnalysisService } from '@/lib/domain/services/AIAnalysisService';
import { ClipExtractionService } from '@/lib/domain/services/ClipExtractionService';
import { CaptionGenerationService } from '@/lib/domain/services/CaptionGenerationService';
import { CaptionExportService } from '@/lib/domain/services/CaptionExportService';
import { VideoExtractionService } from '@/lib/domain/services/VideoExtractionService';
import { YouTubeDownloadService } from '@/lib/domain/services/YouTubeDownloadService';
import { ExportQueueService } from '@/lib/domain/services/ExportQueueService';
import { ClipManipulationService } from '@/lib/domain/services/ClipManipulationService';
import { NaturalLanguageSearchService } from '@/lib/domain/services/NaturalLanguageSearchService';
import { ChapterSegmentationService } from '@/lib/domain/services/ChapterSegmentationService';
import { CompositeClipService } from '@/lib/domain/services/CompositeClipService';
import { ThumbnailGenerationService } from '@/lib/domain/services/ThumbnailGenerationService';
import { TextToSpeechService } from '@/lib/domain/services/TextToSpeechService';
import { VoiceTranslationService } from '@/lib/domain/services/VoiceTranslationService';

// Infrastructure Services
import { VideoStorageService } from '@/lib/infrastructure/services/VideoStorageService';
import { VideoStitchingService } from '@/lib/infrastructure/services/VideoStitchingService';

// Use Cases
import { GenerateAutoHighlightsUseCase } from '@/lib/application/use-cases/GenerateAutoHighlightsUseCase';
import { GenerateCaptionsUseCase } from '@/lib/application/use-cases/GenerateCaptionsUseCase';
import { TranslateTranscriptUseCase } from '@/lib/application/use-cases/TranslateTranscriptUseCase';
import { ExportCaptionsUseCase } from '@/lib/application/use-cases/ExportCaptionsUseCase';
import { IngestYouTubeVideoUseCase } from '@/lib/application/use-cases/IngestYouTubeVideoUseCase';
import { QueueExportUseCase } from '@/lib/application/use-cases/QueueExportUseCase';
import { SplitClipUseCase } from '@/lib/application/use-cases/SplitClipUseCase';
import { TrimClipUseCase } from '@/lib/application/use-cases/TrimClipUseCase';
import { UpdateClipUseCase } from '@/lib/application/use-cases/UpdateClipUseCase';
import { UpdateProjectClipOrderUseCase } from '@/lib/application/use-cases/UpdateProjectClipOrderUseCase';
import { SearchClipsUseCase } from '@/lib/application/use-cases/SearchClipsUseCase';
import { SegmentChaptersUseCase } from '@/lib/application/use-cases/SegmentChaptersUseCase';
import { CreateCompositeClipUseCase } from '@/lib/application/use-cases/CreateCompositeClipUseCase';
import { TranslateVideoVoiceUseCase } from '@/lib/application/use-cases/TranslateVideoVoiceUseCase';

/**
 * Global IoC container instance
 */
const container = new Container({
  defaultScope: 'Singleton',
  skipBaseClassChecks: true,
});

/**
 * Bind all repositories
 */
function bindRepositories(): void {
  container.bind<IProjectRepository>(TYPES.IProjectRepository).to(PrismaProjectRepository);
  container.bind<IClipRepository>(TYPES.IClipRepository).to(PrismaClipRepository);
  container.bind<IAssetRepository>(TYPES.IAssetRepository).to(PrismaAssetRepository);
  container.bind<IExportRepository>(TYPES.IExportRepository).to(PrismaExportRepository);

  // Multi-Language Support Repositories
  container
    .bind<ITranscriptTranslationRepository>(TYPES.ITranscriptTranslationRepository)
    .to(PrismaTranscriptTranslationRepository);
  container
    .bind<ICaptionTranslationRepository>(TYPES.ICaptionTranslationRepository)
    .to(PrismaCaptionTranslationRepository);
  container
    .bind<IVoiceTranslationRepository>(TYPES.IVoiceTranslationRepository)
    .to(PrismaVoiceTranslationRepository);

  // Common
  container.bind(TYPES.PrismaClient).toConstantValue(prisma);
}

/**
 * Bind all domain services
 */
function bindDomainServices(): void {
  container.bind(TYPES.TranscriptionService).to(TranscriptionService);
  container.bind(TYPES.TranslationService).to(TranslationService);
  container.bind(TYPES.AIAnalysisService).to(AIAnalysisService);
  container.bind(TYPES.ClipExtractionService).to(ClipExtractionService);
  container.bind(TYPES.CaptionGenerationService).to(CaptionGenerationService);
  container.bind(TYPES.CaptionExportService).to(CaptionExportService);
  container.bind(TYPES.VideoExtractionService).to(VideoExtractionService);
  container.bind(TYPES.YouTubeDownloadService).to(YouTubeDownloadService);
  container.bind(TYPES.ExportQueueService).to(ExportQueueService);
  container.bind(TYPES.ClipManipulationService).to(ClipManipulationService);
  container.bind(TYPES.NaturalLanguageSearchService).to(NaturalLanguageSearchService);
  container.bind(TYPES.ChapterSegmentationService).to(ChapterSegmentationService);
  container.bind(TYPES.CompositeClipService).to(CompositeClipService);
  container.bind(TYPES.ThumbnailGenerationService).to(ThumbnailGenerationService);
  container.bind(TYPES.TextToSpeechService).to(TextToSpeechService);
  container.bind(TYPES.VoiceTranslationService).to(VoiceTranslationService);
}

/**
 * Bind all infrastructure services
 */
function bindInfrastructureServices(): void {
  container.bind(TYPES.VideoStorageService).to(VideoStorageService);
  container.bind(TYPES.VideoStitchingService).to(VideoStitchingService);

  // Will be added in Phase 4 (caching):
  // container.bind(TYPES.CacheService).to(RedisCacheService);
}

/**
 * Bind all use cases
 */
function bindUseCases(): void {
  container.bind(TYPES.GenerateAutoHighlightsUseCase).to(GenerateAutoHighlightsUseCase);
  container.bind(TYPES.GenerateCaptionsUseCase).to(GenerateCaptionsUseCase);
  container.bind(TYPES.TranslateTranscriptUseCase).to(TranslateTranscriptUseCase);
  container.bind(TYPES.ExportCaptionsUseCase).to(ExportCaptionsUseCase);
  container.bind(TYPES.IngestYouTubeVideoUseCase).to(IngestYouTubeVideoUseCase);
  container.bind(TYPES.QueueExportUseCase).to(QueueExportUseCase);
  container.bind(TYPES.SplitClipUseCase).to(SplitClipUseCase);
  container.bind(TYPES.TrimClipUseCase).to(TrimClipUseCase);
  container.bind(TYPES.UpdateClipUseCase).to(UpdateClipUseCase);
  container.bind(TYPES.UpdateProjectClipOrderUseCase).to(UpdateProjectClipOrderUseCase);
  container.bind(TYPES.SearchClipsUseCase).to(SearchClipsUseCase);
  container.bind(TYPES.SegmentChaptersUseCase).to(SegmentChaptersUseCase);
  container.bind(TYPES.CreateCompositeClipUseCase).to(CreateCompositeClipUseCase);
  container.bind(TYPES.TranslateVideoVoiceUseCase).to(TranslateVideoVoiceUseCase);

  // Will be added as needed:
  // container.bind(TYPES.CreateProjectUseCase).to(CreateProjectUseCase);
  // container.bind(TYPES.CreateClipUseCase).to(CreateClipUseCase);
  // container.bind(TYPES.ExportClipUseCase).to(ExportClipUseCase);
}

/**
 * Initialize all bindings
 */
function initializeContainer(): void {
  bindRepositories();
  bindDomainServices();
  bindInfrastructureServices();
  bindUseCases();
}

// Initialize container on import
initializeContainer();

export { container };
