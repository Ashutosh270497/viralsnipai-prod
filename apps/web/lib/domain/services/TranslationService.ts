/**
 * Translation Service (Domain Layer)
 *
 * Handles translation of text and transcript segments using OpenRouter models
 * Preserves timing information for video synchronization
 *
 * @module TranslationService
 */

import { injectable } from 'inversify';
import { HAS_OPENROUTER_KEY, OPENROUTER_MODELS, openRouterClient } from '@/lib/openrouter-client';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';

export interface TranslateTextOptions {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  context?: string; // Optional context for better translation
}

export interface TranscriptSegment {
  id: number;
  start: number; // seconds
  end: number; // seconds
  text: string;
}

@injectable()
export class TranslationService {
  private languageNames: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    gu: 'Gujarati',
  };

  /**
   * Translate plain text to target language
   */
  async translateText(options: TranslateTextOptions): Promise<string> {
    const { text, targetLanguage, sourceLanguage = 'en', context } = options;

    if (!text || text.trim().length === 0) {
      throw AppError.badRequest('Text to translate cannot be empty');
    }

    if (process.env.OPENROUTER_ENABLED !== 'true' || !HAS_OPENROUTER_KEY || !openRouterClient) {
      throw AppError.internal('OpenRouter is not configured');
    }

    logger.info('Translating text', {
      sourceLanguage,
      targetLanguage,
      textLength: text.length,
    });

    try {
      const systemPrompt = this.buildTranslationPrompt(
        sourceLanguage,
        targetLanguage,
        context
      );

      const response = await openRouterClient.chat.completions.create({
        model: OPENROUTER_MODELS.captions,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3, // Lower for consistent translations
      });

      const translation = response.choices?.[0]?.message?.content;

      if (!translation) {
        throw new Error('OpenRouter returned empty translation');
      }

      logger.info('Translation completed', {
        sourceLength: text.length,
        targetLength: translation.length,
        targetLanguage,
      });

      return translation;
    } catch (error: any) {
      logger.error('Translation failed', {
        error: error.message,
        sourceLanguage,
        targetLanguage,
      });
      throw AppError.internal(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Translate transcript segments while preserving timing
   */
  async translateTranscriptSegments(
    segments: TranscriptSegment[],
    targetLanguage: string,
    sourceLanguage: string = 'en'
  ): Promise<TranscriptSegment[]> {
    if (!segments || segments.length === 0) {
      return [];
    }

    if (process.env.OPENROUTER_ENABLED !== 'true' || !HAS_OPENROUTER_KEY || !openRouterClient) {
      throw AppError.internal('OpenRouter is not configured');
    }

    logger.info('Translating transcript segments', {
      segmentCount: segments.length,
      targetLanguage,
      totalWords: segments.reduce((sum, s) => sum + s.text.split(' ').length, 0),
    });

    try {
      // Translate all segments in parallel for speed
      const translationPromises = segments.map((seg) =>
        this.translateText({
          text: seg.text,
          targetLanguage,
          sourceLanguage,
          context: 'video transcript segment',
        })
      );

      const translatedTexts = await Promise.all(translationPromises);

      // Return segments with translated text but preserved timing
      return segments.map((seg, idx) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: translatedTexts[idx],
      }));
    } catch (error: any) {
      logger.error('Segment translation failed', {
        error: error.message,
        segmentCount: segments.length,
      });
      throw error;
    }
  }

  /**
   * Build translation prompt with language-specific instructions
   */
  private buildTranslationPrompt(
    sourceLanguage: string,
    targetLanguage: string,
    context?: string
  ): string {
    const sourceName = this.languageNames[sourceLanguage] || sourceLanguage;
    const targetName = this.languageNames[targetLanguage] || targetLanguage;

    let prompt = `You are a professional translator specializing in Indian languages.

Translate the following ${sourceName} text to ${targetName}.

IMPORTANT RULES:
1. Preserve the meaning and tone exactly
2. Maintain cultural context and idioms where possible
3. Use natural ${targetName} that native speakers would use
4. Keep technical terms consistent
5. Return ONLY the translated text, nothing else
6. Do not add explanations or notes`;

    if (context) {
      prompt += `\n7. Context: This is ${context}`;
    }

    return prompt;
  }

  /**
   * Detect language of given text
   */
  async detectLanguage(text: string): Promise<string> {
    if (process.env.OPENROUTER_ENABLED !== 'true' || !HAS_OPENROUTER_KEY || !openRouterClient) {
      throw AppError.internal('OpenRouter is not configured');
    }

    try {
      const response = await openRouterClient.chat.completions.create({
        model: OPENROUTER_MODELS.captions,
        messages: [
          {
            role: 'system',
            content:
              "Detect the language of the following text. Respond with ONLY the ISO 639-1 language code (e.g., 'en', 'hi', 'ta').",
          },
          {
            role: 'user',
            content: text.substring(0, 500), // First 500 chars
          },
        ],
        temperature: 0,
        max_tokens: 5,
      });

      const detected = response.choices?.[0]?.message?.content?.trim().toLowerCase();
      if (!detected) {
        throw new Error('OpenRouter returned empty language detection');
      }
      return detected;
    } catch (error) {
      logger.error('Language detection failed', { error });
      throw error;
    }
  }
}
