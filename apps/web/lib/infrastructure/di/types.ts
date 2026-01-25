/**
 * Dependency Injection Types
 *
 * Defines symbols for dependency injection container.
 * Use these symbols to inject dependencies via @inject decorator.
 *
 * @module DI Types
 */

export const TYPES = {
  // Repositories
  IProjectRepository: Symbol.for('IProjectRepository'),
  IClipRepository: Symbol.for('IClipRepository'),
  IAssetRepository: Symbol.for('IAssetRepository'),
  IExportRepository: Symbol.for('IExportRepository'),
  ITranscriptTranslationRepository: Symbol.for('ITranscriptTranslationRepository'),
  ICaptionTranslationRepository: Symbol.for('ICaptionTranslationRepository'),
  IVoiceTranslationRepository: Symbol.for('IVoiceTranslationRepository'),

  // Domain Services
  TranscriptionService: Symbol.for('TranscriptionService'),
  TranslationService: Symbol.for('TranslationService'),
  AIAnalysisService: Symbol.for('AIAnalysisService'),
  ClipExtractionService: Symbol.for('ClipExtractionService'),
  ViralityAnalysisService: Symbol.for('ViralityAnalysisService'),
  CaptionGenerationService: Symbol.for('CaptionGenerationService'),
  CaptionExportService: Symbol.for('CaptionExportService'),
  VideoExtractionService: Symbol.for('VideoExtractionService'),
  YouTubeDownloadService: Symbol.for('YouTubeDownloadService'),
  ExportQueueService: Symbol.for('ExportQueueService'),
  ClipManipulationService: Symbol.for('ClipManipulationService'),
  NaturalLanguageSearchService: Symbol.for('NaturalLanguageSearchService'),
  ChapterSegmentationService: Symbol.for('ChapterSegmentationService'),
  CompositeClipService: Symbol.for('CompositeClipService'),
  ThumbnailGenerationService: Symbol.for('ThumbnailGenerationService'),
  TextToSpeechService: Symbol.for('TextToSpeechService'),
  VoiceTranslationService: Symbol.for('VoiceTranslationService'),

  // Infrastructure Services
  VideoStorageService: Symbol.for('VideoStorageService'),
  VideoStitchingService: Symbol.for('VideoStitchingService'),
  AIService: Symbol.for('AIService'),
  CacheService: Symbol.for('CacheService'),

  // Use Cases
  GenerateAutoHighlightsUseCase: Symbol.for('GenerateAutoHighlightsUseCase'),
  GenerateCaptionsUseCase: Symbol.for('GenerateCaptionsUseCase'),
  TranslateTranscriptUseCase: Symbol.for('TranslateTranscriptUseCase'),
  ExportCaptionsUseCase: Symbol.for('ExportCaptionsUseCase'),
  IngestYouTubeVideoUseCase: Symbol.for('IngestYouTubeVideoUseCase'),
  QueueExportUseCase: Symbol.for('QueueExportUseCase'),
  SplitClipUseCase: Symbol.for('SplitClipUseCase'),
  TrimClipUseCase: Symbol.for('TrimClipUseCase'),
  UpdateClipUseCase: Symbol.for('UpdateClipUseCase'),
  UpdateProjectClipOrderUseCase: Symbol.for('UpdateProjectClipOrderUseCase'),
  SearchClipsUseCase: Symbol.for('SearchClipsUseCase'),
  SegmentChaptersUseCase: Symbol.for('SegmentChaptersUseCase'),
  CreateCompositeClipUseCase: Symbol.for('CreateCompositeClipUseCase'),
  CreateProjectUseCase: Symbol.for('CreateProjectUseCase'),
  CreateClipUseCase: Symbol.for('CreateClipUseCase'),
  ExportClipUseCase: Symbol.for('ExportClipUseCase'),
  TranslateVideoVoiceUseCase: Symbol.for('TranslateVideoVoiceUseCase'),

  // Common
  PrismaClient: Symbol.for('PrismaClient'),
};
