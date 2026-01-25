/**
 * Voice Translation Service (Domain Layer)
 *
 * Orchestrates the complete voice translation workflow:
 * 1. Extract original audio from video
 * 2. Generate TTS audio from translated text
 * 3. Replace audio in video
 *
 * SOLID Principles:
 * - Single Responsibility: Orchestrates voice translation workflow
 * - Dependency Inversion: Depends on abstractions (TTS service, FFmpeg)
 * - Open/Closed: Can be extended for different translation strategies
 *
 * @module VoiceTranslationService
 */

import { injectable } from 'inversify';
import path from 'path';
import fs from 'fs';
import { TextToSpeechService } from './TextToSpeechService';
import { extractAudio, replaceAudio } from '@/lib/ffmpeg';
import { logger } from '@/lib/logger';

export interface TranslateVoiceParams {
  assetId: string;
  assetPath: string;
  language: string;
  sourceLanguage: string;
  translatedText: string;
  voiceId?: string;
}

export interface VoiceTranslationResult {
  audioUrl: string;
  processingTime: number;
}

@injectable()
export class VoiceTranslationService {
  constructor(private ttsService: TextToSpeechService) {}

  /**
   * Process complete voice translation workflow
   */
  async translateVoice(params: TranslateVoiceParams): Promise<VoiceTranslationResult> {
    const {
      assetId,
      assetPath,
      language,
      sourceLanguage,
      translatedText,
      voiceId,
    } = params;

    logger.info('Starting voice translation', {
      assetId,
      language,
      sourceLanguage,
      textLength: translatedText.length,
    });

    const startTime = Date.now();

    try {
      // Step 1: Create temporary directory for processing
      const tempDir = path.join(
        process.cwd(),
        'tmp',
        'voice-translations',
        assetId
      );
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Step 2: Extract original audio from video
      const originalAudioPath = path.join(tempDir, 'original-audio.mp3');
      await extractAudio({
        videoPath: assetPath,
        outputPath: originalAudioPath,
      });

      logger.info('Audio extracted from video', {
        assetId,
        originalAudioPath,
      });

      // Step 3: Generate TTS audio from translated text
      const ttsAudioPath = path.join(tempDir, `tts-${language}.mp3`);
      const selectedVoice =
        voiceId || this.ttsService.getVoiceForLanguage(language);

      await this.ttsService.generateSpeech({
        text: translatedText,
        language,
        voiceId: selectedVoice,
        outputPath: ttsAudioPath,
      });

      logger.info('TTS audio generated', {
        assetId,
        language,
        ttsAudioPath,
      });

      // Step 4: Replace audio in video
      const outputDir = path.join(
        process.cwd(),
        'public',
        'voice-translations',
        assetId
      );
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputFileName = `${language}-${Date.now()}.mp4`;
      const outputPath = path.join(outputDir, outputFileName);

      await replaceAudio({
        videoPath: assetPath,
        audioPath: ttsAudioPath,
        outputPath,
      });

      logger.info('Audio replaced in video', {
        assetId,
        language,
        outputPath,
      });

      // Step 5: Cleanup temporary files
      this.cleanupTempFiles(tempDir);

      const processingTime = Date.now() - startTime;
      logger.info('Voice translation completed', {
        assetId,
        language,
        processingTime,
      });

      // Return public URL
      const publicUrl = `/voice-translations/${assetId}/${outputFileName}`;
      return {
        audioUrl: publicUrl,
        processingTime,
      };
    } catch (error) {
      logger.error('Voice translation failed', {
        error,
        assetId,
        language,
      });
      throw error;
    }
  }

  /**
   * Cleanup temporary files after processing
   */
  private cleanupTempFiles(tempDir: string): void {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        logger.info('Temporary files cleaned up', { tempDir });
      }
    } catch (error) {
      logger.warn('Failed to cleanup temporary files', {
        error,
        tempDir,
      });
      // Don't throw - cleanup failures shouldn't fail the translation
    }
  }

  /**
   * Validate translation parameters
   */
  validateParams(params: TranslateVoiceParams): void {
    if (!params.assetId) {
      throw new Error('Asset ID is required');
    }
    if (!params.assetPath) {
      throw new Error('Asset path is required');
    }
    if (!params.language) {
      throw new Error('Target language is required');
    }
    if (!params.translatedText) {
      throw new Error('Translated text is required');
    }
    if (params.translatedText.length > 10000) {
      throw new Error('Translated text is too long (max 10000 characters)');
    }
    if (!fs.existsSync(params.assetPath)) {
      throw new Error('Asset file not found');
    }
  }
}
