/**
 * Text-to-Speech Service (Domain Layer)
 *
 * Provides AI-powered text-to-speech generation for voice translation.
 * Uses OpenAI TTS API for high-quality voice synthesis.
 *
 * SOLID Principles:
 * - Dependency Inversion: Depends on ITTSProvider interface
 * - Single Responsibility: Only handles TTS generation
 * - Open/Closed: Can be extended with different TTS providers
 *
 * @module TextToSpeechService
 */

import { injectable, optional } from 'inversify';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

export interface TTSOptions {
  text: string;
  language: string;
  voiceId?: string;
  outputPath: string;
}

export interface ITTSProvider {
  generateSpeech(options: TTSOptions): Promise<string>;
}

/**
 * OpenAI TTS Provider Implementation
 */
@injectable()
export class OpenAITTSProvider implements ITTSProvider {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateSpeech(options: TTSOptions): Promise<string> {
    const { text, voiceId = 'alloy', outputPath } = options;

    logger.info('Generating TTS audio', {
      language: options.language,
      voiceId,
      textLength: text.length,
    });

    const startTime = Date.now();

    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: voiceId as any,
        input: text,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, buffer);

      const duration = Date.now() - startTime;
      logger.info('TTS audio generated', {
        outputPath,
        duration,
        fileSize: buffer.length,
      });

      return outputPath;
    } catch (error) {
      logger.error('TTS generation failed', { error });
      throw error;
    }
  }
}

/**
 * Text-to-Speech Service
 *
 * Main service for generating speech from text.
 * Supports multiple languages and voice profiles.
 */
@injectable()
export class TextToSpeechService {
  private provider: ITTSProvider;

  constructor() {
    this.provider = new OpenAITTSProvider();
  }

  /**
   * Generate speech from text
   */
  async generateSpeech(options: TTSOptions): Promise<string> {
    return this.provider.generateSpeech(options);
  }

  /**
   * Get recommended voice ID for a given language
   *
   * OpenAI Voices:
   * - alloy: Neutral, balanced (good for general use)
   * - echo: Male, clear
   * - fable: British, warm
   * - onyx: Deep, authoritative
   * - nova: Female, young
   * - shimmer: Female, soft
   */
  getVoiceForLanguage(language: string): string {
    const voiceMap: Record<string, string> = {
      en: 'alloy', // English - neutral
      es: 'nova', // Spanish - warm female
      fr: 'shimmer', // French - soft female
      de: 'fable', // German - warm male
      it: 'onyx', // Italian - authoritative
      pt: 'echo', // Portuguese - clear male
      ru: 'onyx', // Russian - deep
      zh: 'nova', // Chinese - young female
      ja: 'shimmer', // Japanese - soft
      ko: 'nova', // Korean - young female
      hi: 'nova', // Hindi - female
      ar: 'onyx', // Arabic - authoritative
    };

    return voiceMap[language] || 'alloy';
  }

  /**
   * Get all available voices
   */
  getAvailableVoices(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'alloy',
        name: 'Alloy',
        description: 'Neutral, balanced voice for general use',
      },
      { id: 'echo', name: 'Echo', description: 'Male, clear and articulate' },
      { id: 'fable', name: 'Fable', description: 'British, warm and engaging' },
      {
        id: 'onyx',
        name: 'Onyx',
        description: 'Deep, authoritative male voice',
      },
      { id: 'nova', name: 'Nova', description: 'Young, energetic female voice' },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft, gentle female voice' },
    ];
  }

  /**
   * Validate voice ID
   */
  isValidVoiceId(voiceId: string): boolean {
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    return validVoices.includes(voiceId);
  }
}
