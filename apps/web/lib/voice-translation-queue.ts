/**
 * Voice Translation Queue
 *
 * Handles background job processing for video voice translation.
 * Uses the existing @clippers/jobs queue system.
 *
 * Workflow:
 * 1. Get asset and text translation details
 * 2. Extract audio from original video
 * 3. Generate TTS audio from translated text
 * 4. Replace audio in video
 * 5. Update status in database
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles job queuing
 * - Open/Closed: Can be extended for different job types
 *
 * @module voice-translation-queue
 */

import { enqueueRender } from '@clippers/jobs';
import { prisma } from '@/lib/prisma';
import { extractAudio, replaceAudio } from '@/lib/ffmpeg';
import { logger } from '@/lib/logger';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';

export interface VoiceTranslationJobParams {
  voiceTranslationId: string;
  assetId: string;
  language: string;
  voiceId?: string;
}

/**
 * Queue a voice translation job for background processing
 */
export function queueVoiceTranslationJob(params: VoiceTranslationJobParams): void {
  const { voiceTranslationId, assetId, language, voiceId } = params;

  logger.info('Queueing voice translation job', {
    voiceTranslationId,
    assetId,
    language,
  });

  enqueueRender({
    exportId: voiceTranslationId,
    handler: async () => {
      const startTime = Date.now();

      try {
        // Step 1: Get voice translation record
        const voiceTranslation = await prisma.voiceTranslation.findUnique({
          where: { id: voiceTranslationId },
          include: {
            asset: true,
          },
        });

        if (!voiceTranslation) {
          throw new Error('Voice translation record not found');
        }

        // Step 2: Get text translation
        const textTranslation = await prisma.transcriptTranslation.findUnique({
          where: {
            assetId_language: {
              assetId,
              language,
            },
          },
        });

        if (!textTranslation) {
          throw new Error('Text translation not found');
        }

        const asset = voiceTranslation.asset;
        if (!asset) {
          throw new Error('Asset not found');
        }

        logger.info('Processing voice translation job', {
          voiceTranslationId,
          assetId,
          language,
          assetPath: asset.storagePath,
        });

        // Step 3: Create temporary directory
        const tempDir = path.join(
          process.cwd(),
          'tmp',
          'voice-translations',
          assetId
        );
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Step 4: Extract original audio
        const originalAudioPath = path.join(tempDir, 'original-audio.mp3');
        await extractAudio({
          videoPath: asset.storagePath,
          outputPath: originalAudioPath,
        });

        logger.info('Audio extracted from video', {
          voiceTranslationId,
          originalAudioPath,
        });

        // Step 5: Generate TTS audio
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const ttsVoiceId = voiceId || getVoiceForLanguage(language);

        const ttsResponse = await openai.audio.speech.create({
          model: 'tts-1-hd',
          voice: ttsVoiceId as any,
          input: textTranslation.transcript,
          response_format: 'mp3',
        });

        const ttsBuffer = Buffer.from(await ttsResponse.arrayBuffer());
        const ttsAudioPath = path.join(tempDir, `tts-${language}.mp3`);
        fs.writeFileSync(ttsAudioPath, ttsBuffer);

        logger.info('TTS audio generated', {
          voiceTranslationId,
          ttsAudioPath,
          fileSize: ttsBuffer.length,
        });

        // Step 6: Replace audio in video
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
          videoPath: asset.storagePath,
          audioPath: ttsAudioPath,
          outputPath,
        });

        logger.info('Audio replaced in video', {
          voiceTranslationId,
          outputPath,
        });

        // Step 7: Cleanup temporary files
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          logger.info('Temporary files cleaned up', { tempDir });
        } catch (error) {
          logger.warn('Failed to cleanup temporary files', { error, tempDir });
        }

        const processingTime = Date.now() - startTime;
        const publicUrl = `/voice-translations/${assetId}/${outputFileName}`;

        // Update voice translation record with success
        await prisma.voiceTranslation.update({
          where: { id: voiceTranslationId },
          data: {
            audioUrl: publicUrl,
            status: 'completed',
            processingTime,
            error: null,
          },
        });

        logger.info('Voice translation job completed successfully', {
          voiceTranslationId,
          processingTime,
          publicUrl,
        });
      } catch (error) {
        logger.error('Voice translation job failed', {
          error,
          voiceTranslationId,
        });

        // Update voice translation record with error
        await prisma.voiceTranslation.update({
          where: { id: voiceTranslationId },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        throw error;
      }
    },
    onStatusChange: async (status, error) => {
      logger.info('Voice translation job status change', {
        voiceTranslationId,
        status,
        error,
      });

      // Update status in database
      await prisma.voiceTranslation.update({
        where: { id: voiceTranslationId },
        data: {
          status: status === 'processing' ? 'processing' : status,
          error:
            status === 'failed' && error
              ? error instanceof Error
                ? error.message
                : String(error)
              : null,
        },
      });
    },
  });

  logger.info('Voice translation job enqueued', {
    voiceTranslationId,
    assetId,
    language,
  });
}

/**
 * Get recommended voice ID for a given language
 */
function getVoiceForLanguage(language: string): string {
  const voiceMap: Record<string, string> = {
    en: 'alloy',
    es: 'nova',
    fr: 'shimmer',
    de: 'fable',
    it: 'onyx',
    pt: 'echo',
    ru: 'onyx',
    zh: 'nova',
    ja: 'shimmer',
    ko: 'nova',
    hi: 'nova',
    ar: 'onyx',
  };

  return voiceMap[language] || 'alloy';
}
